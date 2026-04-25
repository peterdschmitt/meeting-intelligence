import { NextRequest, NextResponse } from 'next/server';

// TEMPORARY auth stub. Replace with NextAuth session check once NextAuth is
// wired up (next-auth@5 is already in package.json, just not configured yet).
//
// Behavior:
//   - When `API_TOKEN` is set in the environment, all /api/* routes require
//     `Authorization: Bearer <API_TOKEN>`.
//   - When `API_TOKEN` is unset, requests pass through. A warning is logged
//     in production. SET API_TOKEN OR WIRE UP NEXTAUTH BEFORE THIS GOES LIVE.
//   - The done-token route (action-item completion via email link) is always
//     public-by-design.

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
      console.warn(
        '[proxy] API_TOKEN is not set — /api/* is unauthenticated in production. ' +
        'Set API_TOKEN or wire up NextAuth before relying on this in earnest.',
      );
    }
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
