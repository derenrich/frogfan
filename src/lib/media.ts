import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// @ts-ignore
import ffprobeStatic from 'ffprobe-static';

// Set the ffmpeg/ffprobe binary paths
ffmpeg.setFfmpegPath(ffmpegStatic as string);
ffmpeg.setFfprobePath(ffprobeStatic.path);

const CACHE_DIR = process.env.DATA_DIR ? path.join(process.env.DATA_DIR, 'cache') : path.join(process.env.PWD || String.fromCharCode(46), 'data', 'cache');

export async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (e) {
    // ignore
  }
}

export async function getVideoMetadata(filePath: string): Promise<{ fps: number, duration: number, totalFrames: number, width: number, height: number }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      
      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      if (!videoStream) return reject(new Error('No video stream found'));
      
      const fpsStr = videoStream.r_frame_rate || videoStream.avg_frame_rate;
      let fps = 30;
      if (fpsStr && fpsStr.includes('/')) {
        const [num, den] = fpsStr.split('/');
        fps = parseInt(num) / parseInt(den);
      } else if (fpsStr) {
        fps = parseFloat(fpsStr);
      }
      
      const durationStr = videoStream.duration || metadata.format.duration;
      const duration = parseFloat(durationStr as string);
      
      let totalFrames = parseInt(videoStream.nb_frames || '0');
      if (!totalFrames && duration && fps) {
        totalFrames = Math.floor(duration * fps);
      }
      
      const width = videoStream.width || 0;
      const height = videoStream.height || 0;
      
      resolve({ fps, duration, totalFrames, width, height });
    });
  });
}

// Extract a specific frame, caching it and a few adjacent frames
export async function getFrame(filePath: string, frameIndex: number, fps?: number, signal?: AbortSignal): Promise<string> {
  await ensureCacheDir();
  
  // Create a hash for the file to use in cache directory
  const fileHash = crypto.createHash('md5').update(filePath).digest('hex');
  const fileCacheDir = path.join(CACHE_DIR, fileHash);
  await fs.mkdir(fileCacheDir, { recursive: true });
  
  const framePath = path.join(fileCacheDir, `frame_${frameIndex}.jpg`);
  
  try {
    // Check if frame already exists
    await fs.access(framePath);
    return framePath;
  } catch {
    // Need to extract. We'll extract a batch of 5 frames starting from this one to speed up forward scrubbing.
    // However, exact frame extraction in ffmpeg without re-decoding from start can be tricky.
    // The most accurate is using the select filter based on frame number (n).
    return new Promise((resolve, reject) => {
      let aborted = false;

      console.log(`Extracting frame ${frameIndex} for ${filePath}`);
      const command = ffmpeg(filePath);
      
      if (fps) {
        // Fast seek
        const timestamp = frameIndex / fps;
        command
          .inputOptions([`-ss ${timestamp}`])
          .outputOptions([
            '-vframes 1',
            '-q:v 2' // high quality jpeg
          ]);
      } else {
        // Exact but slow seek
        command
          .outputOptions([
            `-vf select='eq(n\\,${frameIndex})'`,
            '-vframes 1',
            '-q:v 2' // high quality jpeg
          ]);
      }

      command.save(framePath)
        .on('end', () => {
          if (aborted) return;
          resolve(framePath);
        })
        .on('error', (err) => {
          if (aborted) {
            return reject(new Error('Aborted'));
          }
          console.error('Error extracting frame', err);
          reject(err);
        });
        
      if (signal) {
        const onAbort = () => {
          aborted = true;
          command.kill('SIGKILL');
          reject(new Error('Aborted'));
        };
        if (signal.aborted) {
          onAbort();
        } else {
          signal.addEventListener('abort', onAbort);
        }
      }
    });
  }
}
