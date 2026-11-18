import React, { useCallback, useState } from "react";
import { WorkspaceProvider, LessonWorkspace, usePlayback } from "./learning/workspace.jsx";
import lesson from "./learning/lesson-data.mjs";
const storageKey = "learningos:" + lesson.lessonId + ":" + lesson.revision;
function readProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
    return Object.fromEntries(["video","audio"].filter(format =>
      Number.isFinite(saved?.[format]?.position) && saved[format].position >= 0
    ).map(format => [format,saved[format]]));
  } catch { return {}; }
}
function Study({ onBack }) {
  const { checkpoint } = usePlayback();
  return <>
    <button className="back" onClick={() => { checkpoint(); onBack(); }}>← Your library</button>
    <p className="notice">Timed transcript draft: click a passage to seek, or turn on Follow playback. Audio and video keep independent bookmarks. Timing still needs playback spot-checks.</p>
    <LessonWorkspace />
  </>;
}
export default function App() {
  const [mode, setMode] = useState(null);
  const saveProgress = useCallback(tracks => localStorage.setItem(storageKey,JSON.stringify(tracks)),[]);
  return <>
    <header className="topbar">
      <a href="#" className="brand" onClick={event => {event.preventDefault(); if (!mode) setMode(null);}}>LEARNING<span>OS</span></a>
      <span className="top-label">YOUR PERSONAL LEARNING LIBRARY</span>
      <span className="local">Local preview</span>
    </header>
    {mode ? <WorkspaceProvider key={lesson.lessonId + ":" + lesson.revision}
      lesson={lesson} initialFormat={mode} initialProgress={readProgress()} onProgressChange={saveProgress}>
      <Study onBack={() => setMode(null)} />
    </WorkspaceProvider> :
    <div className="library">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">WEB DEVELOPMENT · LESSON 001</p>
          <h1>The chain<br/>of escalation<span>.</span></h1>
          <p className="subtitle">Building the modern web</p>
          <p className="description">Every tool began with a problem. Follow the story from JavaScript to Node.js, npm, React and Vite—then explain it in your own words.</p>
          <div className="hero-actions">
            <button className="primary" onClick={() => setMode("video")}>▶ Watch lesson</button>
            <button className="secondary" onClick={() => setMode("audio")}>♫ Listen instead</button>
          </div>
          <p className="format-note">Independent video and audio bookmarks · Script · Recall practice</p>
        </div>
        <div className="hero-art" aria-hidden="true"><div className="orbit one"></div><div className="orbit two"></div><div className="technology">JS<span>→ NODE → NPM</span><strong>REACT</strong><span>→ VITE → YOUR APP</span></div></div>
      </section>
      <section className="shelf">
        <div className="shelf-heading"><h2>Your learning path</h2><span>1 lesson</span></div>
        <button className="lesson-card" onClick={() => setMode("video")}>
          <div className="card-art"><span>001</span><strong>FROM JAVASCRIPT<br/>TO THE MODERN WEB</strong><b>▶</b></div>
          <div className="card-copy"><small>WEB DEVELOPMENT</small><h3>The Chain of Escalation</h3><p>Watch · Listen · Read · Practice</p></div>
        </button>
      </section>
      <footer>Choose a lesson. Understand the problem. Test what you remember.</footer>
    </div>}
  </>;
}