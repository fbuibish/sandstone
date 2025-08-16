import { prisma } from '../../lib/prisma';

function extractSnippet(text: string, query: string, radius = 80) {
  const phrase = (query.match(/\"([^\"]+)\"/) || [])[1];
  const hay = text.toLowerCase();
  let startIdx = -1,
    endIdx = -1;
  if (phrase) {
    const n = phrase.toLowerCase();
    startIdx = hay.indexOf(n);
    if (startIdx !== -1) endIdx = startIdx + n.length;
  } else {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    for (const t of terms) {
      const i = hay.indexOf(t);
      if (i !== -1) {
        startIdx = i;
        endIdx = i + t.length;
        break;
      }
    }
  }
  if (startIdx === -1) return '';
  const a = Math.max(0, startIdx - radius);
  const b = Math.min(text.length, endIdx + radius);
  const prefix = a > 0 ? '…' : '';
  const suffix = b < text.length ? '…' : '';
  return prefix + text.slice(a, b) + suffix;
}

function countOccurrences(hay: string, query: string) {
  const phrase = (query.match(/\"([^\"]+)\"/) || [])[1];
  const lower = hay.toLowerCase();
  if (phrase) {
    const n = phrase.toLowerCase();
    return lower.split(n).length - 1;
  }
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  let c = 0;
  for (const t of terms) c += lower.split(t).length - 1;
  return c;
}

export async function POST(req: Request) {
  const { q, k = 10 } = await req.json().catch(() => ({}));
  if (typeof q !== 'string' || !q.trim())
    return Response.json({ error: 'q required', code: 400 }, { status: 400 });

  const phrase = (q.match(/\"([^\"]+)\"/) || [])[1];
  const terms = phrase ? [phrase] : q.trim().split(/\s+/).filter(Boolean);

  // Use Prisma ORM instead of raw SQL for better compatibility
  const documents = await prisma.document.findMany({
    include: {
      DocumentText: true,
    },
    where: {
      AND: terms.map(term => ({
        OR: [
          {
            name: {
              contains: term,
              mode: 'insensitive',
            },
          },
          {
            DocumentText: {
              some: {
                text: {
                  contains: term,
                  mode: 'insensitive',
                },
              },
            },
          },
        ],
      })),
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 200,
  });

  // Transform to match expected format
  const rows = documents.map(doc => ({
    id: doc.id,
    name: doc.name,
    text: doc.DocumentText[0]?.text || null,
  }));

  // Rank + snippet in JS (simple, good enough for take-home)
  const ranked = rows
    .map(r => {
      const nameScore = countOccurrences(r.name || '', q) * 2; // name is more important
      const textScore = r.text ? countOccurrences(r.text, q) : 0;
      const score = nameScore + textScore;
      const snippet = r.text ? extractSnippet(r.text, q, 90) : r.name;
      return { id: r.id, name: r.name, score, snippet };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(50, Number(k) || 10)));

  return Response.json(ranked);
}
