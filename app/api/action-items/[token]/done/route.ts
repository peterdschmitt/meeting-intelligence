import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { actionItems } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const [item] = await db
      .select()
      .from(actionItems)
      .where(eq(actionItems.doneToken, token))
      .limit(1);

    if (!item) {
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Not Found</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #0f172a; color: #94a3b8; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; }
    .card { text-align: center; padding: 2rem; }
    h1 { font-size: 1.5rem; color: #f87171; margin-bottom: 0.5rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Token not found</h1>
    <p>This link may have already been used or is invalid.</p>
  </div>
</body>
</html>`;
      return new Response(html, {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Mark as done
    await db
      .update(actionItems)
      .set({ status: 'done', completedAt: new Date(), updatedAt: new Date() })
      .where(eq(actionItems.doneToken, token));

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Action Item Done</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 1rem;
      padding: 2.5rem 3rem;
      text-align: center;
      max-width: 480px;
      width: 90%;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
    }
    .icon {
      font-size: 3.5rem;
      line-height: 1;
      margin-bottom: 1rem;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 700;
      color: #34d399;
      margin: 0 0 0.75rem;
    }
    .title {
      font-size: 1rem;
      color: #94a3b8;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 0.5rem;
      padding: 0.75rem 1rem;
      margin-top: 1rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <h1>Action item marked as done ✓</h1>
    <p class="title">${escapeHtml(item.title)}</p>
  </div>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    console.error('[GET /api/action-items/[token]/done]', error);
    const html = `<!DOCTYPE html><html><body style="background:#0f172a;color:#f87171;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
      <div style="text-align:center"><h1>Something went wrong</h1><p>Please try again later.</p></div>
    </body></html>`;
    return new Response(html, {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
