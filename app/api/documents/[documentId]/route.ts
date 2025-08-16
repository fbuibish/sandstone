// app/api/documents/[id]/route.ts
export const runtime = 'nodejs';

import { prisma } from '../../../lib/prisma';

type Change = {
  operation: 'replace';
  range: { start: number; end: number };
  text: string; // replacement
};

function isInteger(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n);
}

function validateChanges(changes: Change[], textLen: number) {
  if (!Array.isArray(changes) || changes.length === 0) {
    return 'changes[] required';
  }
  for (let i = 0; i < changes.length; i++) {
    const ch = changes[i];
    if (!ch || ch.operation !== 'replace')
      return `changes[${i}].operation must be "replace"`;
    if (!ch.range || !isInteger(ch.range.start) || !isInteger(ch.range.end)) {
      return `changes[${i}].range.start/end must be integers`;
    }
    if (
      ch.range.start < 0 ||
      ch.range.end < 0 ||
      ch.range.start > ch.range.end ||
      ch.range.end > textLen
    ) {
      return `changes[${i}].range out of bounds (0..${textLen})`;
    }
    if (typeof ch.text !== 'string')
      return `changes[${i}].text must be a string`;
  }
  return null;
}

/**
 * Apply position-based replacements to a string.
 * Applies changes from RIGHT to LEFT so indexes remain stable.
 * If ranges overlap, earlier items in the input array take precedence.
 */
function applyPositionReplacements(source: string, changes: Change[]) {
  let updated = source;
  // apply in reverse input order to avoid index shifting
  for (let i = changes.length - 1; i >= 0; i--) {
    const ch = changes[i];
    const { start, end } = ch.range;
    updated = updated.slice(0, start) + ch.text + updated.slice(end);
  }
  return updated;
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const body = await req.json().catch(() => ({}));
    const { changes } = body as { changes: Change[] };

    // Ensure doc exists
    const doc = await prisma.document.findUnique({
      where: { id },
      select: { id: true, version: true },
    });
    if (!doc) {
      return Response.json({ error: 'not found', code: 404 }, { status: 404 });
    }

    // Load editable text (normalized text we index/search)
    const dt = await prisma.documentText.findUnique({
      where: { documentId: id },
      select: { text: true },
    });
    if (!dt) {
      // You can choose to create an empty row instead; for now we signal conflict.
      return Response.json(
        {
          error:
            'document has no editable text (e.g., binary-only or extraction missing)',
          code: 409,
        },
        { status: 409 }
      );
    }

    // Validate payload against current text length
    const err = validateChanges(changes, dt.text.length);
    if (err) return Response.json({ error: err, code: 400 }, { status: 400 });

    // Apply changes (right-to-left)
    const updatedText = applyPositionReplacements(dt.text, changes);

    // Persist atomically: update text + bump version
    const updated = await prisma.$transaction(async tx => {
      await tx.documentText.update({
        where: { documentId: id },
        data: { text: updatedText },
      });
      const doc2 = await tx.document.update({
        where: { id },
        data: { version: { increment: 1 } },
        select: { id: true, version: true },
      });
      return doc2;
    });

    return Response.json({
      id,
      version: updated.version,
      updatedText,
      changesApplied: changes.length,
    });
  } catch (e) {
    console.error(e);
    return Response.json(
      { error: e instanceof Error ? e.message : 'server error', code: 500 },
      { status: 500 }
    );
  }
}
