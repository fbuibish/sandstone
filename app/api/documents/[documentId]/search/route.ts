import { searchDocuments } from '../../../../lib/documents/search';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
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

  const { documentId } = await params;
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
