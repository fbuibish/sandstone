// app/api/search/route.ts
import { searchDocuments } from '../../../lib/documents/search';

export async function POST(req: Request) {
  const { q, limit, offset } = await req.json().catch(() => ({}));
  if (typeof q !== 'string' || !q.trim()) {
    return Response.json({ error: 'q required', code: 400 }, { status: 400 });
  }

  const results = await searchDocuments(
    q,
    Number(limit) || 25,
    Number(offset) || 0
  );

  return Response.json(results);
}
