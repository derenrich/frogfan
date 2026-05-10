import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.env.PWD || String.fromCharCode(46), 'data');
const SESSIONS_DIR = path.join(DATA_DIR, 'sessions');

export async function ensureSessionsDir() {
  try {
    await fs.mkdir(SESSIONS_DIR, { recursive: true });
  } catch (e) {
    // ignore
  }
}

export async function GET() {
  await ensureSessionsDir();
  try {
    const files = await fs.readdir(SESSIONS_DIR);
    const sessions = [];
    
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const content = await fs.readFile(path.join(SESSIONS_DIR, file), 'utf-8');
      try {
        const session = JSON.parse(content);
        sessions.push({
          id: session.id,
          title: session.title,
          updatedAt: session.updatedAt || Date.now()
        });
      } catch (e) {
        console.error('Invalid session file:', file);
      }
    }
    
    sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Failed to list sessions', error);
    return NextResponse.json({ error: 'Failed to list sessions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  await ensureSessionsDir();
  try {
    const body = await request.json();
    const id = body.id || Math.random().toString(36).substr(2, 9);
    
    const session = {
      ...body,
      id,
      annotations: body.annotations || {},
      updatedAt: Date.now()
    };
    
    await fs.writeFile(
      path.join(SESSIONS_DIR, `${id}.json`),
      JSON.stringify(session, null, 2)
    );
    
    return NextResponse.json(session);
  } catch (error) {
    console.error('Failed to create session', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}
