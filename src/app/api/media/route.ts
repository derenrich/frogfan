import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getFrame, getVideoMetadata } from '@/lib/media';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mediaPath = searchParams.get('path');
  const action = searchParams.get('action'); // 'meta' or 'frame' or 'raw'
  
  if (!mediaPath) {
    return NextResponse.json({ error: 'Missing path' }, { status: 400 });
  }

  try {
    const ext = path.extname(mediaPath).toLowerCase();
    const isVideo = ['.mp4', '.mov', '.avi'].includes(ext);

    if (action === 'meta') {
      const stats = await fs.stat(mediaPath);
      if (stats.isDirectory()) {
        const files = await fs.readdir(mediaPath);
        const images = files.filter(f => /\.(jpg|jpeg|png)$/i.test(f)).sort();
        return NextResponse.json({ type: 'sequence', totalFrames: images.length, fps: 30, files: images });
      }

      if (!isVideo) {
        return NextResponse.json({ type: 'image', totalFrames: 1, fps: 30 });
      }
      const meta = await getVideoMetadata(mediaPath);
      return NextResponse.json({ type: 'video', ...meta });
    }

    if (action === 'frame') {
      const frameIndex = parseInt(searchParams.get('frame') || '0');
      
      const stats = await fs.stat(mediaPath);
      let filePathToServe = mediaPath;
      
      if (stats.isDirectory()) {
        const files = await fs.readdir(mediaPath);
        const images = files.filter(f => /\.(jpg|jpeg|png)$/i.test(f)).sort();
        if (images[frameIndex]) {
          filePathToServe = path.join(mediaPath, images[frameIndex]);
        } else {
          return NextResponse.json({ error: 'Frame out of bounds' }, { status: 404 });
        }
      } else if (isVideo) {
        const fpsParam = searchParams.get('fps');
        const fps = fpsParam ? parseFloat(fpsParam) : undefined;
        try {
          filePathToServe = await getFrame(mediaPath, frameIndex, fps, request.signal);
        } catch (e: any) {
          if (e.message === 'Aborted') {
            return new NextResponse(null, { status: 499 }); // Client Closed Request
          }
          throw e;
        }
      }

      const fileBuffer = await fs.readFile(filePathToServe);
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      });
    }

    // Serve raw file (for image sequences)
    const fileBuffer = await fs.readFile(mediaPath);
    let mime = 'image/jpeg';
    if (ext === '.png') mime = 'image/png';
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': mime
      }
    });

  } catch (error) {
    console.error('Media API Error:', error);
    return NextResponse.json({ error: 'Failed to process media' }, { status: 500 });
  }
}
