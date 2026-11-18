import lesson from './lesson.json';
import audio from './audio.transcript.json';
import video from './video.transcript.json';
export default {
  ...lesson,
  transcripts: { audio: audio.segments, video: video.segments },
  blocks: lesson.blocks.map(block => {
    if (block.id === 'node') return { ...block, timestamps: {audio:63.88,video:139} };
    if (block.id === 'react') return { ...block, timestamps: {audio:133.48,video:257} };
    return block;
  })
};
