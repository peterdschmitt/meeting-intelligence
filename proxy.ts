import { NextRequest, NextResponse } from 'next/server';

// TEMPORARY auth stub. Replace with NextAuth session check once NextAuth is
// wired up (next-auth@5 is already in package.json, just not configured yet).
//
// Behavior:
//   - All /api/* routes require `Authorization: Bearer <API_TOKEN>` when
//     `API_TOKEN` is set in the environment.
//   - The done-token route (action-item completion via email link) is
//     intentionally public.
//   - When `API_TOKEN` is unset, requests pass through with a console warning
//     so local dev keeps working. DO NOT deploy without setting API_TOKEN.

const PUBLIC_API_PATTERNS = [
  // public-by-design: assignees click these from email
  /^\/api\/done\/[^/]+\/?$/,
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith('/api/')) return NextResponse.next();
  if (PUBLIC_API_PATTERNS.some((rx) => rx.test(pathname))) return NextResponse.next();

  const expected = process.env.API_TOKEN;
  if (!expected) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'API_TOKEN not configured on server' },
        { status: 503 },
      );
    }
    // dev fallthrough
    return NextResponse.next();
  }

  const provided = request.headers
    .get('authorization')
    ?.replace(/^Bearer\s+/i, '');
  if (provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
