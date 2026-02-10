import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sql } from "@vercel/postgres";

// GET - Fetch all profiles (public endpoint for client-side use)
export const runtime = "nodejs";

export async function GET() {
  try {
    const profiles = await prisma.profile.findMany({
      orderBy: { name: 'asc' },
      select: {
        name: true,
        resumeText: true,
        customPrompt: true,
        pdfTemplate: true,
      },
    });
    return NextResponse.json({ profiles });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to read profiles', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  await sql`
    INSERT INTO profiles (name)
    VALUES ('bran chembah'), ('felix gabriel')
    ON CONFLICT DO NOTHING
  `;

  return Response.json({ seeded: true });
}
