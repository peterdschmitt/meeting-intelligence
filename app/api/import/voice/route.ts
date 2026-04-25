import { NextRequest, NextResponse } from 'next/server';
import { toFile } from 'openai';
import { getOpenAI } from '@/lib/openai';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioEntry = formData.get('audio');

    if (!audioEntry || typeof audioEntry === 'string') {
      return NextResponse.json({ error: 'audio file is required' }, { status: 400 });
    }

    const audioFile = audioEntry as File;
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const file = await toFile(buffer, audioFile.name || 'audio.webm', {
      type: audioFile.type || 'audio/webm',
    });

    const transcription = await getOpenAI().audio.transcriptions.create({
      file,
      model: 'whisper-1',
      response_format: 'text',
    });

    return NextResponse.json({ transcript: transcription });
  } catch (error) {
    console.error('[POST /api/import/voice]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
