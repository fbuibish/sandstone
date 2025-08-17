// app/api/documents/search/route.ts
import { searchDocuments } from '../../../lib/documents/search';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const limit = searchParams.get('limit');
  const offset = searchParams.get('offset');

  if (typeof q !== 'string' || !q.trim()) {
    return Response.json(
      { error: 'q query parameter required', code: 400 },
      { status: 400 }
    );
  }

  const results = await searchDocuments(
    q,
    Number(limit) || 25,
    Number(offset) || 0
  );

  return Response.json(results);
}
