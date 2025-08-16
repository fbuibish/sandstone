import { prisma } from '../prisma';

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    c =>
      (
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        }) as Record<string, string>
      )[c]
  );
}

function buildSnippetHtml(text: string, start: number, end: number) {
  const radius = 50;
  const a = Math.max(0, start - radius);
  const b = Math.min(text.length, end + radius);
  const before = escapeHtml(text.slice(a, start));
  const hit = escapeHtml(text.slice(start, end));
  const after = escapeHtml(text.slice(end, b));
  const prefix = a > 0 ? '…' : '';
  const suffix = b < text.length ? '…' : '';
  return `${prefix}${before}<mark>${hit}</mark>${after}${suffix}`;
}

function findAll(haystackLower: string, needleLower: string) {
  const out: number[] = [];
  if (!needleLower) return out;
  let i = 0;
  while (true) {
    const idx = haystackLower.indexOf(needleLower, i);
    if (idx === -1) break;
    out.push(idx);
    i = idx + needleLower.length;
  }
  return out;
}

type Hit = {
  docId: string;
  name: string;
  snippetHtml: string;
  start: number;
  end: number;
  createdAt: Date;
};

export async function searchDocuments(
  query: string,
  limit: number = 25,
  offset: number = 0,
  documentId?: string
) {
  const take = Math.max(1, Math.min(500, limit));
  const skip = Math.max(0, offset);

  // Parse query: phrase in quotes or split on whitespace
  const phrase = (query.match(/"([^"]+)"/) || [])[1];
  const terms = (phrase ? [phrase] : query.trim().split(/\s+/)).filter(Boolean);
  if (!terms.length) return [];

  // Build where clause - optionally restrict to single document
  const whereClause = {
    AND: [
      {
        OR: terms.map(t => ({
          text: { contains: t, mode: 'insensitive' as const },
        })),
      },
      ...(documentId ? [{ documentId }] : []),
    ],
  };

  // Query DocumentText rows whose text contains ANY term (OR),
  // include related Document fields for display & ordering.
  const rows = await prisma.documentText.findMany({
    where: whereClause,
    select: {
      text: true,
      document: { select: { id: true, name: true, createdAt: true } },
    },
    orderBy: { document: { createdAt: 'desc' } },
    take: take + skip, // get enough records to apply offset
  });

  // Build per-occurrence hits (one result per match)
  const hits: Hit[] = [];

  for (const r of rows) {
    if (!r.text) continue;
    const text = r.text;
    const lower = text.toLowerCase();
    const seen = new Set<string>();

    for (const t of terms) {
      const tLower = t.toLowerCase();
      for (const start of findAll(lower, tLower)) {
        const end = start + tLower.length;
        const key = `${start}-${end}`;
        if (seen.has(key)) continue; // avoid duplicates across overlapping terms
        seen.add(key);

        hits.push({
          docId: r.document.id,
          name: r.document.name,
          snippetHtml: buildSnippetHtml(text, start, end),
          start,
          end,
          createdAt: r.document.createdAt,
        });

        if (hits.length >= take + skip) break;
      }
      if (hits.length >= take + skip) break;
    }
    if (hits.length >= take + skip) break;
  }

  // Sort: newest document first, then by position
  hits.sort((a, b) => {
    if (a.createdAt < b.createdAt) return 1;
    if (a.createdAt > b.createdAt) return -1;
    return a.start - b.start;
  });

  // Apply offset and limit
  return hits.slice(skip, skip + take).map(h => ({
    docId: h.docId,
    name: h.name,
    snippetHtml: h.snippetHtml,
    startIndex: h.start,
    endIndex: h.end,
  }));
}
