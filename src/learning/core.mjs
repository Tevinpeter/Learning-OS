// Pure functions. A timestamp is meaningful only within its own format.
export function buildTimeline(blocks, format, transcripts) {
  if (transcripts && Object.hasOwn(transcripts, format)) {
    return transcripts[format].map(segment => ({ id: segment.id, start: segment.start, end: segment.end }))
      .sort((a, b) => a.start - b.start);
  }
  return blocks
    .filter(block => Number.isFinite(block.timestamps[format]))
    .map(block => ({ id: block.id, start: block.timestamps[format] }))
    .sort((a, b) => a.start - b.start);
}
export function blockAt(timeline, time) {
  let current = null;
  for (const entry of timeline) {
    if (entry.start > time) break;
    current = entry;
  }
  return current && (current.end === undefined || time < current.end) ? current.id : null;
}
export function transcriptBlocks(lesson, format) {
  const segments = lesson.transcripts?.[format];
  if (!segments) return lesson.blocks;
  return segments.map(segment => ({
    id: segment.id,
    title: Math.floor(segment.start / 60) + ":" + String(Math.floor(segment.start % 60)).padStart(2, "0"),
    text: { [format]: segment.text },
    timestamps: { [format]: segment.start }
  }));
}
export function bookmarkPosition(progress, format) {
  const position = progress[format]?.position;
  return Number.isFinite(position) && position >= 0 ? position : 0;
}
export function planSwitch(from, to, snapshot, progress, updatedAt) {
  const nextProgress = {
    ...progress,
    [from]: { position: Math.max(0, snapshot.position), updatedAt }
  };
  return {
    progress: nextProgress,
    destination: {
      format: to,
      position: bookmarkPosition(nextProgress, to),
      shouldPlay: snapshot.playing
    }
  };
}
// JSON Schema cannot enforce these relationships; validate them on ingestion.
export function validateRelationships(lesson) {
  for (const [format, segments] of Object.entries(lesson.transcripts ?? {})) {
    if (!lesson.media[format] || !Array.isArray(segments)) throw new Error("Invalid transcript track");
    const segmentIds = new Set();
    let lastEnd = 0;
    for (const segment of segments) {
      if (typeof segment.id !== "string" || !segment.id || segmentIds.has(segment.id)) throw new Error("Invalid transcript ID");
      if (!Number.isFinite(segment.start) || !Number.isFinite(segment.end) ||
          segment.start < lastEnd || segment.end <= segment.start) throw new Error("Invalid transcript range");
      if (typeof segment.text !== "string" || !segment.text.trim()) throw new Error("Empty transcript text");
      segmentIds.add(segment.id);
      lastEnd = segment.end;
    }
  }
  const ids = new Set();
  for (const block of lesson.blocks) {
    if (ids.has(block.id)) throw new Error("Duplicate block ID: " + block.id);
    ids.add(block.id);
    for (const format of Object.keys(block.timestamps)) {
      if (!lesson.media[format]) throw new Error("Timestamp has no media: " + format);
    }
  }
  const questionIds = new Set();
  for (const question of lesson.questions) {
    if (questionIds.has(question.id)) throw new Error("Duplicate question ID");
    questionIds.add(question.id);
    if (!ids.has(question.blockId)) throw new Error("Unknown recall block");
  }
  for (const format of Object.keys(lesson.media)) {
    const starts = buildTimeline(lesson.blocks, format).map(entry => entry.start);
    if (new Set(starts).size !== starts.length) throw new Error("Ambiguous duplicate timestamps");
  }
}
