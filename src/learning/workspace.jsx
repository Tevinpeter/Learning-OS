import React, {
  createContext, forwardRef, useCallback, useContext, useEffect,
  useImperativeHandle, useLayoutEffect, useMemo, useRef, useState
} from "react";
import { blockAt, bookmarkPosition, buildTimeline, planSwitch, transcriptBlocks, validateRelationships } from "./core.mjs";
import "./workspace.css";

export const LessonContext = createContext(null);
export const PlaybackContext = createContext(null);
export function useLesson() {
  const value = useContext(LessonContext);
  if (!value) throw new Error("Missing WorkspaceProvider");
  return value;
}
export function usePlayback() {
  const value = useContext(PlaybackContext);
  if (!value) throw new Error("Missing WorkspaceProvider");
  return value;
}

// Remount this provider with key={lesson.lessonId + ":" + lesson.revision}
// when changing lesson/revision. Pass validated, immutable lesson JSON.
// initialProgress is the per-format tracks object, scoped to this user + lesson revision.
export function WorkspaceProvider({
  lesson, initialFormat = "video", initialProgress = {},
  onProgressChange = () => {}, children
}) {
  const firstFormat = lesson.media[initialFormat] ? initialFormat : Object.keys(lesson.media)[0];
  const [session, setSession] = useState(() => ({
    id: 1, format: firstFormat,
    position: bookmarkPosition(initialProgress, firstFormat), shouldPlay: false
  }));
  const sessionRef = useRef(session);
  const playerRef = useRef(null);
  const progressRef = useRef(initialProgress); // snapshots only, never a playback clock
  const [progress, setProgress] = useState(initialProgress);
  const [currentBlockId, setCurrentBlockId] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const switchingRef = useRef(true); // initially loading
  const progressSink = useRef(onProgressChange);
  useEffect(() => { progressSink.current = onProgressChange; }, [onProgressChange]);

  const timelines = useMemo(() => {
    validateRelationships(lesson);
    return Object.fromEntries(Object.keys(lesson.media).map(format =>
      [format, buildTimeline(lesson.blocks, format, lesson.transcripts)]));
  }, [lesson]);

  const commitProgress = useCallback(next => {
    progressRef.current = next; // synchronous: switching cannot read stale state
    setProgress(next);
    // Supply a persistence adapter; media event handlers never await a server.
    try {
      Promise.resolve(progressSink.current(next)).catch(() =>
        setError("Could not save progress. Your current bookmarks remain in memory."));
    } catch {
      setError("Could not save progress. Your current bookmarks remain in memory.");
    }
  }, []);

  const updateBlock = useCallback((id, position) => {
    if (id !== sessionRef.current.id) return; // ignore outgoing media events
    const format = sessionRef.current.format;
    const next = blockAt(timelines[format], position);
    setCurrentBlockId(previous => previous === next ? previous : next);
  }, [timelines]);

  const checkpoint = useCallback(() => {
    const player = playerRef.current;
    const active = sessionRef.current;
    if (!player || player.sessionId !== active.id || !player.isReady()) return;
    commitProgress({
      ...progressRef.current,
      [active.format]: { position: player.getCurrentTime(), updatedAt: new Date().toISOString() }
    });
  }, [commitProgress]);

  const switchFormat = useCallback(nextFormat => {
    const from = sessionRef.current;
    if (nextFormat === from.format || !lesson.media[nextFormat] || switchingRef.current) return false;
    const player = playerRef.current;
    if (!player || player.sessionId !== from.id || !player.isReady()) return false;

    switchingRef.current = true; // synchronous guard against double clicks
    // Capture BEFORE pausing/unmounting. No block mapping participates here.
    const snapshot = {
      position: player.getCurrentTime(),
      playing: player.isPlaying()
    };
    player.pause();
    const transition = planSwitch(
      from.format, nextFormat, snapshot, progressRef.current, new Date().toISOString()
    );
    commitProgress(transition.progress);
    const next = { id: from.id + 1, ...transition.destination };
    sessionRef.current = next; // old callbacks immediately become stale
    setCurrentBlockId(null);
    setReady(false);
    setError(null);
    setSession(next); // key change in MediaStage destroys the old player
    return true;
  }, [lesson, commitProgress]);

  const onReady = useCallback((id, position) => {
    if (id !== sessionRef.current.id) return;
    switchingRef.current = false;
    setReady(true);
    updateBlock(id, position);
  }, [updateBlock]);
  const onPlayerError = useCallback((id, message) => {
    if (id !== sessionRef.current.id) return;
    switchingRef.current = false;
    setReady(false);
    setError(message);
  }, []);
  const onPlayBlocked = useCallback((id, message) => {
    if (id === sessionRef.current.id) setError(message);
  }, []);

  // Sparse persistence: pause/end + periodic checkpoints + page lifecycle.
  // Durable remote saving needs retries/server validation in the supplied adapter.
  useEffect(() => {
    const timer = window.setInterval(checkpoint, 15000);
    const visibility = () => { if (document.visibilityState === "hidden") checkpoint(); };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", checkpoint);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", checkpoint);
    };
  }, [checkpoint]);

  const lessonValue = useMemo(() => ({
    lesson, blocks: lesson.blocks, transcript: transcriptBlocks(lesson, session.format),
    activeFormat: session.format, progress, switchFormat
  }), [lesson, session.format, progress, switchFormat]);
  const playbackValue = useMemo(() => ({
    playerRef, session, currentBlockId, ready, error,
    onReady, onPlayerError, onPlayBlocked, updateBlock, checkpoint
  }), [session, currentBlockId, ready, error, onReady, onPlayerError, onPlayBlocked, updateBlock, checkpoint]);

  return (
    <LessonContext.Provider value={lessonValue}>
      <PlaybackContext.Provider value={playbackValue}>{children}</PlaybackContext.Provider>
    </LessonContext.Provider>
  );
}

export const TrackPlayer = forwardRef(function TrackPlayer({
  session, track, onReady, onPlayerError, onPlayBlocked, updateBlock, checkpoint
}, ref) {
  const mediaRef = useRef(null);
  const restored = useRef(false);
  const alive = useRef(false);
  const pendingSeek = useRef(null);
  const { id, format, position, shouldPlay } = session;
  const bindElement = useCallback(element => { mediaRef.current = element; }, []);

  const seek = useCallback(seconds => {
    if (!Number.isFinite(seconds) || seconds < 0) return;
    const element = mediaRef.current;
    if (!element || !restored.current) {
      pendingSeek.current = seconds;
      return;
    }
    const target = Number.isFinite(element.duration)
      ? Math.min(seconds, element.duration) : seconds;
    element.currentTime = target;
    updateBlock(id, target);
  }, [id, updateBlock]);

  useImperativeHandle(ref, () => ({
    sessionId: id,
    play: () => mediaRef.current
      ? mediaRef.current.play() : Promise.reject(new Error("Player is not mounted")),
    pause: () => mediaRef.current?.pause(),
    seek,
    getCurrentTime: () => mediaRef.current?.currentTime ?? 0,
    isPlaying: () => !!mediaRef.current && !mediaRef.current.paused && !mediaRef.current.ended,
    isReady: () => restored.current,
    getElement: () => mediaRef.current
  }), [id, seek]);

  useLayoutEffect(() => {
    alive.current = true;
    const element = mediaRef.current;
    return () => {
      alive.current = false;
      element?.pause(); // stop outgoing audio even while play() is pending
    };
  }, []);

  function restore(event) {
    if (restored.current || !alive.current) return;
    const element = event.currentTarget;
    const savedPosition = pendingSeek.current ?? position;
    const target = Number.isFinite(element.duration)
      ? Math.min(savedPosition, element.duration) : savedPosition;
    try {
      element.currentTime = target;
      pendingSeek.current = null;
      restored.current = true;
      onReady(id, target);
      if (shouldPlay) {
        element.play().catch(() => {
          if (alive.current) onPlayBlocked(id, "Playback did not resume. Press Play to continue.");
        });
      }
    } catch {
      onPlayerError(id, "Could not restore this track. Check the media file.");
    }
  }

  const properties = {
    ref: bindElement,
    src: track.src,
    controls: true,
    preload: "metadata",
    onLoadedMetadata: restore,
    onTimeUpdate: event => {
      if (restored.current) updateBlock(id, event.currentTarget.currentTime);
    },
    onSeeked: event => {
      if (restored.current) updateBlock(id, event.currentTarget.currentTime);
    },
    onPause: checkpoint,
    onEnded: checkpoint,
    onError: () => onPlayerError(id, "This track could not be loaded.")
  };
  return format === "video"
    ? <video {...properties} playsInline aria-label="Lesson video" />
    : <audio {...properties} aria-label="Lesson audio" />;
});

export function MediaStage() {
  const { lesson, activeFormat } = useLesson();
  const playback = usePlayback();
  return (
    <section aria-label="Media player">
      <TrackPlayer key={playback.session.id} ref={playback.playerRef}
        session={playback.session} track={lesson.media[activeFormat]}
        onReady={playback.onReady} onPlayerError={playback.onPlayerError}
        onPlayBlocked={playback.onPlayBlocked} updateBlock={playback.updateBlock}
        checkpoint={playback.checkpoint} />
      <DirectProgressBar />
      {playback.error && <p role="status">{playback.error}</p>}
    </section>
  );
}

export function FormatSwitcher() {
  const { lesson, activeFormat, switchFormat } = useLesson();
  const { ready } = usePlayback();
  return (
    <div role="group" aria-label="Media format">
      {Object.keys(lesson.media).map(format =>
        <button key={format} type="button" aria-pressed={format === activeFormat}
          disabled={!ready} onClick={() => switchFormat(format)}>
          {format === "video" ? "Watch" : "Listen"}
        </button>
      )}
    </div>
  );
}

// Direct media subscription: time never enters React state or Context.
export function DirectProgressBar() {
  const { playerRef, session } = usePlayback();
  const inputRef = useRef(null);
  const labelRef = useRef(null);
  useEffect(() => {
    const element = playerRef.current?.getElement();
    const input = inputRef.current;
    if (!element || !input) return;
    function update() {
      const duration = element.duration;
      input.disabled = !Number.isFinite(duration) || duration <= 0;
      input.max = String(Number.isFinite(duration) && duration > 0 ? duration : 1);
      input.value = String(element.currentTime);
      if (labelRef.current) labelRef.current.textContent =
        Math.floor(element.currentTime) + " seconds";
    }
    const events = ["timeupdate", "loadedmetadata", "durationchange", "seeked"];
    events.forEach(name => element.addEventListener(name, update));
    update();
    return () => events.forEach(name => element.removeEventListener(name, update));
  }, [playerRef, session.id]);
  return <div>
    <input ref={inputRef} aria-label="Playback position" type="range"
      min="0" max="1" step="0.1" defaultValue="0"
      onChange={event => playerRef.current?.seek(Number(event.target.value))} />
    <span ref={labelRef} />
  </div>;
}

export function TranscriptScroller() {
  const { transcript: blocks, activeFormat } = useLesson();
  const { playerRef, currentBlockId, ready } = usePlayback();
  const containerRef = useRef(null);
  const blockRefs = useRef(new Map());
  const [following, setFollowing] = useState(false); // opt in using Follow playback
  const followingRef = useRef(false);
  function suspendFollowing() {
    if (followingRef.current && containerRef.current) {
      containerRef.current.scrollTo({ top: containerRef.current.scrollTop, behavior: "instant" });
    }
    followingRef.current = false; // cancel even before React commits
    setFollowing(false);
  }
  useLayoutEffect(() => {
    if (!following || !followingRef.current || !currentBlockId) return;
    const container = containerRef.current;
    const block = blockRefs.current.get(currentBlockId);
    if (!container || !block) return;
    const outer = container.getBoundingClientRect();
    const inner = block.getBoundingClientRect();
    if (inner.top >= outer.top && inner.bottom <= outer.bottom) return;
    container.scrollTo({
      top: Math.max(0, container.scrollTop + inner.top - outer.top - 12),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
    });
  }, [following, currentBlockId, activeFormat]);

  return <section aria-label="Transcript">
    <button type="button" aria-pressed={following}
      onClick={() => {
        followingRef.current = !following;
        setFollowing(!following);
      }}>Follow playback: {following ? "on" : "off"}</button>
    {!following && currentBlockId && <button type="button" onClick={() => {
      followingRef.current = true;
      setFollowing(true);
    }}>Back to current passage</button>}
    <div className="transcript" ref={containerRef} tabIndex={0}
      onWheel={suspendFollowing} onTouchMove={suspendFollowing}
      onPointerDown={event => {
        // Scrollbar drag, including when the pointer is over the scrollbar gutter.
        const box = event.currentTarget.getBoundingClientRect();
        if (event.clientX >= box.left + event.currentTarget.clientWidth)
          suspendFollowing();
      }}
      onKeyDown={event => {
        if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key))
          suspendFollowing();
      }}>
      {blocks.map(block => {
        const timestamp = block.timestamps[activeFormat];
        const canSeek = Number.isFinite(timestamp);
        return <article key={block.id} data-segment-id={block.id}
          ref={element => {
            if (element) blockRefs.current.set(block.id, element);
            else blockRefs.current.delete(block.id);
          }}
          className={currentBlockId === block.id ? "active-block" : ""}
          aria-current={currentBlockId === block.id ? "true" : undefined}>
          {canSeek ? <button className="passage" type="button" disabled={!ready}
              aria-label={"Seek to " + block.title + ": " + (block.text[activeFormat] ?? block.text.shared)}
              onClick={() => playerRef.current?.seek(timestamp)}>
            <span className="passage-time">{block.title}</span>
            <span>{block.text[activeFormat] ?? block.text.shared}</span>
          </button> : <><h3>{block.title}</h3><p>{block.text[activeFormat] ?? block.text.shared ?? "No transcript for this format."}</p></>}
        </article>;
      })}
    </div>
  </section>;
}

export function RecallQuestion({ question }) {
  const { blocks, activeFormat } = useLesson();
  const { playerRef, ready } = usePlayback();
  const [result, setResult] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const block = blocks.find(item => item.id === question.blockId);
  const timestamp = block?.timestamps[activeFormat];
  const canRewatch = result === "failed" && Number.isFinite(timestamp);
  return <article>
    <h3>{question.prompt}</h3>
    <button type="button" onClick={() => setRevealed(true)}>Show answer</button>
    {revealed && <>
      <p>{question.answer}</p>
      <button type="button" onClick={() => setResult("passed")}>I recalled it</button>
      <button type="button" onClick={() => setResult("failed")}>I missed it</button>
    </>}
    {canRewatch && <button type="button" disabled={!ready}
      onClick={() => playerRef.current?.seek(timestamp)}>Rewatch</button>}
  </article>;
}

export function LessonWorkspace() {
  const { lesson } = useLesson();
  const [panel, setPanel] = useState("read");
  return <main>
    <h1>{lesson.title}</h1>
    <FormatSwitcher />
    <div className="workspace">
      <MediaStage />
      <aside aria-label="Study panel">
        <div role="group" aria-label="Study panel mode">
          <button type="button" aria-pressed={panel === "read"} onClick={() => setPanel("read")}>Read</button>
          <button type="button" aria-pressed={panel === "practice"} onClick={() => setPanel("practice")}>Practice</button>
        </div>
        {panel === "read" ? <TranscriptScroller /> : lesson.questions.map(question =>
          <RecallQuestion key={question.id} question={question} />)}
      </aside>
    </div>
  </main>;
}
