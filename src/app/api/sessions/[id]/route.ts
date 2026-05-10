import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const SESSIONS_DIR = path.join(DATA_DIR, 'sessions');

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const filePath = path.join(SESSIONS_DIR, `${id}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    return NextResponse.json(JSON.parse(content));
  } catch (error) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const filePath = path.join(SESSIONS_DIR, `${id}.json`);
    
    // Validate session exists
    await fs.access(filePath);
    
    const body = await request.json();
    const session = {
      ...body,
      id, // ensure ID doesn't change
      updatedAt: Date.now()
    };
    
    await fs.writeFile(filePath, JSON.stringify(session, null, 2));
    return NextResponse.json(session);
  } catch (error) {
    console.error('Failed to update session', error);
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const filePath = path.join(SESSIONS_DIR, `${id}.json`);
    await fs.unlink(filePath);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete session', error);
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
  }
}
