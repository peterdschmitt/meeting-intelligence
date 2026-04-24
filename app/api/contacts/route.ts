import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { contacts, companies } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function GET(_request: NextRequest) {
  try {
    const rows = await db
      .select({
        id: contacts.id,
        fullName: contacts.fullName,
        email: contacts.email,
        role: contacts.role,
        companyId: contacts.companyId,
        companyName: companies.name,
        notes: contacts.notes,
        createdAt: contacts.createdAt,
        updatedAt: contacts.updatedAt,
      })
      .from(contacts)
      .leftJoin(companies, eq(contacts.companyId, companies.id));

    return NextResponse.json(rows);
  } catch (error) {
    console.error('[GET /api/contacts]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      fullName: string;
      email?: string;
      role?: string;
      companyId?: string;
      notes?: string;
    };

    const { fullName, email, role, companyId, notes } = body;

    if (!fullName) {
      return NextResponse.json({ error: 'fullName is required' }, { status: 400 });
    }

    const [created] = await db
      .insert(contacts)
      .values({
        fullName,
        email: email ?? null,
        role: role ?? null,
        companyId: companyId ?? null,
        notes: notes ?? null,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[POST /api/contacts]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
