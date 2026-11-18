$mediaFolder = Join-Path $PSScriptRoot 'public\media\001'
New-Item -ItemType Directory -Path $mediaFolder -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $env:USERPROFILE 'Downloads\The_Chain_of_Escalation__Building_the_Modern_Web.mp4') -Destination (Join-Path $mediaFolder 'video.mp4') -ErrorAction Stop
Copy-Item -LiteralPath (Join-Path $env:USERPROFILE 'OneDrive\Desktop\Tevin_Learning_Library\My_Learning_Library\01_Web_Development\001_Why_JavaScript_Node_npm_React_and_Vite\audio.wav') -Destination (Join-Path $mediaFolder 'audio.wav') -ErrorAction Stop
Write-Output 'Recordings attached. Run npm install, then npm run dev from this folder.'
