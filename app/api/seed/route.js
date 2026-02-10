import { sql } from "@vercel/postgres";

export const runtime = "nodejs";

export async function GET() {
  await sql`
    INSERT INTO profile (name, "resumeText", "customPrompt", "pdfTemplate")
    VALUES
      ('bran chembah', '', '', 1),
      ('felix gabriel', '', '', 1)
    ON CONFLICT (name) DO NOTHING;
  `;

  return Response.json({ seeded: true });
}
