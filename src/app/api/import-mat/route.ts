import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFileAsync = promisify(execFile);

export async function POST(request: Request) {
  try {
    const { filePath, pathPrefix } = await request.json();
    if (!filePath) {
      return NextResponse.json({ error: 'Missing filePath' }, { status: 400 });
    }

    const scriptPath = path.join(process.cwd(), 'src', 'lib', 'parse_mat.py');
    
    // We try to run python3 (it should be in the PATH and have h5py installed)
    // For local dev, the user's virtualenv python might be used if they activated it before running npm run dev.
    // If not, they'll need to install h5py globally or in their environment.
    let output;
    try {
      // In python virtualenv, "python" or "python3" can be used. We'll try python3 first.
      const { stdout } = await execFileAsync('python3', [scriptPath, filePath]);
      output = stdout;
    } catch (e: any) {
      return NextResponse.json({ error: `Python execution failed: ${e.message}` }, { status: 500 });
    }

    let parsedResult;
    try {
      parsedResult = JSON.parse(output.trim());
    } catch (e) {
      return NextResponse.json({ error: 'Failed to parse python output', rawOutput: output }, { status: 500 });
    }

    if (parsedResult.status === 'error') {
      return NextResponse.json({ error: parsedResult.message }, { status: 500 });
    }

    const data = parsedResult.data;
    
    // Apply path prefix substitution
    // The user said: "if the file isn't at that location we'll need to prompt for a new prefix. they user will give you a path that should be substituted at the point that the "data" is in the path e.g. /foo/bar/zar/data/... with prefix /car/war changes to /car/war/data/..."
    // "What should happen if the path doesn't contain a data segment? ask for a full path. it shouldn't happent though"
    
    // Wait, the client will send `pathPrefix`. If `pathPrefix` is provided, we map all video paths.
    // Wait, the problem is that we need to send the parsed video paths to the client FIRST so the client can decide if they need a prefix?
    // Actually, no. If the user clicks "Load from .mat file" -> selects a .mat file via FilePicker.
    // The FilePicker returns the absolute path of the selected .mat file on the server.
    // We send this path to the server. The server parses it.
    // But we don't know if the video files exist until we stat them!
    
    // Let's modify the approach: The endpoint just parses and returns the data (along with original video files).
    // The frontend will receive the data. Then the frontend checks if it needs to prompt the user?
    // How does the frontend know if the video files exist on the server?
    // We can check `fs.existsSync` on the server and include an `exists` boolean for each video file!
    
    const fs = require('fs');
    
    if (pathPrefix) {
       // Apply prefix substitution if requested by client
       let newVideoFiles = [];
       let newAnnotations = {};
       
       for (let oldPath of data.video_files) {
          let newPath = oldPath;
          if (oldPath.includes('/data/')) {
             const parts = oldPath.split('/data/');
             // keep the /data/ and everything after it
             newPath = path.join(pathPrefix, 'data', parts.slice(1).join('/data/'));
          } else {
             // Fallback if no /data/: just use the provided full paths or prefix
             // The user said "ask for a full path", we can handle this in the UI by sending an array of mapped paths if the user manually overrides them.
             newPath = path.join(pathPrefix, path.basename(oldPath));
          }
          newVideoFiles.push(newPath);
          newAnnotations[newPath] = data.annotations[oldPath] || {};
       }
       
       data.video_files = newVideoFiles;
       data.annotations = newAnnotations;
    }
    
    // Check existence
    const fileExistsStatus = {};
    let allExist = true;
    for (let vf of data.video_files) {
        const exists = fs.existsSync(vf);
        fileExistsStatus[vf] = exists;
        if (!exists) allExist = false;
    }

    return NextResponse.json({
        data,
        allExist,
        fileExistsStatus
    });

  } catch (error: any) {
    console.error('Import MAT API Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process MAT file' }, { status: 500 });
  }
}
