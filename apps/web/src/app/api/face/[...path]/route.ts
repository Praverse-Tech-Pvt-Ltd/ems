import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function proxy(req: NextRequest, path: string[]) {
  const endpoint = `${API_BASE}/api/v1/face/${path.join('/')}`;

  const headers: HeadersInit = {
    'Content-Type': req.headers.get('content-type') ?? 'application/json',
  };

  const auth = req.headers.get('authorization');
  if (auth) headers['authorization'] = auth;

  const body =
    req.method !== 'GET' && req.method !== 'DELETE' ? await req.text() : undefined;

  const res = await fetch(endpoint, { method: req.method, headers, body });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  return proxy(req, params.path);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  return proxy(req, params.path);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  return proxy(req, params.path);
}
