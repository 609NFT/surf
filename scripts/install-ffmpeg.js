// Downloads a static ffmpeg binary if not already present
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const FFMPEG_PATH = path.join(__dirname, '..', 'bin', 'ffmpeg');

if (fs.existsSync(FFMPEG_PATH)) {
  console.log('ffmpeg already installed');
  process.exit(0);
}

fs.mkdirSync(path.dirname(FFMPEG_PATH), { recursive: true });

// Static build for linux x64
const URL = 'https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0/ffmpeg-linux-x64';

console.log('Downloading static ffmpeg...');
const file = fs.createWriteStream(FFMPEG_PATH);
https.get(URL, (res) => {
  if (res.statusCode === 302 || res.statusCode === 301) {
    https.get(res.headers.location, (res2) => {
      res2.pipe(file);
      file.on('finish', () => {
        file.close();
        fs.chmodSync(FFMPEG_PATH, 0o755);
        console.log('ffmpeg installed at', FFMPEG_PATH);
      });
    });
  } else {
    res.pipe(file);
    file.on('finish', () => {
      file.close();
      fs.chmodSync(FFMPEG_PATH, 0o755);
      console.log('ffmpeg installed at', FFMPEG_PATH);
    });
  }
}).on('error', (e) => {
  fs.unlinkSync(FFMPEG_PATH);
  console.error('Failed to download ffmpeg:', e.message);
});
