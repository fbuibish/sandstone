import { prisma } from '../../lib/prisma';

export async function GET() {
  const docs = await prisma.document.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return Response.json(docs);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { name, mimeType = 'text/plain', sizeBytes = 0 } = body;
  if (!name)
    return Response.json(
      { error: 'name required', code: 400 },
      { status: 400 }
    );
  const doc = await prisma.document.create({
    data: { name, mimeType, sizeBytes, storageKey: `logical://${name}` },
  });
  return Response.json(doc, { status: 201 });
}
