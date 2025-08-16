import { searchDocuments } from '../../../../lib/documents/search';

export async function POST(
  req: Request,
  { params }: { params: { documentId: string } }
) {
  const { q, limit, offset } = await req.json().catch(() => ({}));
  if (typeof q !== 'string' || !q.trim()) {
    return Response.json({ error: 'q required', code: 400 }, { status: 400 });
  }

  const { documentId } = params;
  if (!documentId) {
    return Response.json(
      { error: 'documentId required', code: 400 },
      { status: 400 }
    );
  }

  try {
    const results = await searchDocuments(
      q,
      Number(limit) || 25,
      Number(offset) || 0,
      documentId // Restrict search to this document only
    );

    return Response.json(results);
  } catch (error) {
    console.error('Document search error:', error);
    return Response.json(
      { error: 'Search failed', code: 500 },
      { status: 500 }
    );
  }
}
