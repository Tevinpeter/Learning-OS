# LearningOS — runnable React app

The assembled app on this computer has your recordings attached. This downloadable SOURCE ZIP excludes recordings and node_modules.

1. Extract this ZIP.
2. Copy your video to public/media/001/video.mp4 and your audio to public/media/001/audio.wav (create the folders if needed).
3. In Git Bash, cd into this folder.
4. Run npm install once, then npm run dev.
5. Open the Local URL printed in the terminal.

Alternatively, right-click SETUP_MEDIA.ps1 and run it with PowerShell to copy the recordings from their current known locations on Tevin's computer.

Video and audio bookmarks are independent and saved in this browser. Cross-device saving, online private hosting, SRS, and offline-download support are not implemented yet.

The audio narration script is included as reference reading. Verified timestamps and a video transcript are not yet available, so passage highlighting and Rewatch links remain unavailable for this lesson.

The production build was verified with Vite 6.0.3 and React 18.3.1. Browser checks confirmed both media load, playback survives switching, and audio resumes at its own bookmark.
