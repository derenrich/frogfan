import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetPath = searchParams.get('path') || process.cwd();

  try {
    const stats = await fs.stat(targetPath);
    if (!stats.isDirectory()) {
      return NextResponse.json({ error: 'Path is not a directory' }, { status: 400 });
    }

    const entries = await fs.readdir(targetPath, { withFileTypes: true });
    
    const files = entries.map(entry => {
      const isDir = entry.isDirectory();
      const ext = path.extname(entry.name).toLowerCase();
      // Only list directories, images, videos, and mat files
      const isMedia = ['.mp4', '.mov', '.avi', '.jpg', '.jpeg', '.png', '.mat'].includes(ext);
      
      if (!isDir && !isMedia) return null;

      return {
        name: entry.name,
        path: path.join(targetPath, entry.name),
        isDirectory: isDir,
        isMedia
      };
    }).filter(Boolean);

    // Sort: directories first, then files alphabetically
    files.sort((a, b) => {
      if (a!.isDirectory && !b!.isDirectory) return -1;
      if (!a!.isDirectory && b!.isDirectory) return 1;
      return a!.name.localeCompare(b!.name);
    });

    return NextResponse.json({
      currentPath: targetPath,
      parentPath: path.dirname(targetPath),
      files
    });
  } catch (error) {
    console.error('Error reading directory:', error);
    return NextResponse.json({ error: 'Failed to read directory' }, { status: 500 });
  }
}
