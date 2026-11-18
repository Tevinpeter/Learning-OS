# LearningOS

I’m building LearningOS to organize my learning materials and make reviewing them easier. It combines video, audio, interactive transcripts, and recall practice in one workspace.

## Features

- Video and audio playback with independent progress bookmarks.
- Timed transcripts with passage highlighting and optional automatic scrolling.
- Clickable transcript passages that seek to the corresponding point in the active track.
- Recall questions with links back to relevant explanations when timestamps are available.
- A responsive workspace with media and study panels.

Progress is saved locally in the browser. Each track resumes from its own bookmark when switching between video and audio.

## Run locally

1. Clone this repository and open the project folder in your terminal.
2. Install the dependencies:

   ```bash
   npm install

3. Add your lesson recordings at these paths, creating the folders if needed:
   public/media/001/video.mp4
   public/media/001/audio.wav

   
4. Start the development server:
   npm run dev

   
5. Open the local URL printed in the terminal.
Recordings and node_modules are excluded from the repository. The included transcripts correspond to the original lesson recordings. Using different media requires updating the lesson data and transcript timestamps.

SETUP_MEDIA.ps1 is an optional helper that copies the original recordings from specific locations on my Windows computer. Adjust its paths before using it on another machine.


Current limitations
Transcript timestamps are machine-generated drafts and may need adjustments. Cross-device progress, private online media storage, spaced repetition, and offline downloads are planned features.
Built with
- React
- Vite
- JavaScript
- CSS

   
