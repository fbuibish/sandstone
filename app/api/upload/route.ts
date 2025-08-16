// app/api/upload/route.ts
export const runtime = 'nodejs';

import { prisma } from '../../lib/prisma';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { createRequire } from 'module';

const require = createRequire(process.cwd() + '/');
const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');

function sanitizeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}
async function ensureDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

function looksPlainText(mime: string, name: string) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (mime?.startsWith('text/')) return true;
  return ['txt', 'md', 'csv', 'json', 'log'].includes(ext);
}
function isPdf(mime: string, name: string) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  return mime === 'application/pdf' || ext === 'pdf';
}

async function loadPdfParse() {
  // Works for both ESM and CJS builds of pdf-parse
  try {
    const mod = await import('pdf-parse'); // ESM path
    return mod.default as typeof import('pdf-parse');
  } catch {
    // Fallback to CJS require (some environments bundle differently)
    return require('pdf-parse');
  }
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const f = form.get('file');
    if (!f || typeof f === 'string') {
      return Response.json(
        { error: 'file field required', code: 400 },
        { status: 400 }
      );
    }

    const file = f as File;
    const id = randomUUID();
    const originalName = sanitizeName(file.name || 'upload.bin');
    // NOTE: some browsers send empty type for drag/drop; we still detect by extension
    const mimeType = file.type || 'application/octet-stream';
    const sizeBytes = file.size ?? 0;

    await ensureDir();
    const key = `${id}_${originalName}`;
    const dest = path.join(UPLOAD_DIR, key);

    // Save the raw bytes
    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(dest, buf);

    // Create the DB row
    const doc = await prisma.document.create({
      data: { id, name: originalName, mimeType, sizeBytes, storageKey: key },
    });

    // Extract searchable text
    let extracted = '';
    try {
      if (looksPlainText(mimeType, originalName)) {
        const MAX = 5 * 1024 * 1024; // guard demo size
        extracted = buf.slice(0, MAX).toString('utf8');
      } else if (isPdf(mimeType, originalName)) {
        const pdfParse = await loadPdfParse();

        // Try BUFFER first (the correct way)
        try {
          const out = await pdfParse(buf); // IMPORTANT: pass ONLY the Buffer
          extracted = (out?.text || '').trim();
        } catch (e) {
          // Fallback: pass the actual saved file path
          console.warn(
            'pdf-parse buffer path failed; retrying with filename',
            e
          );
          const out2 = await pdfParse(dest);
          extracted = (out2?.text || '').trim();
        }
      }
    } catch (e) {
      console.warn('PDF/text extraction failed for', originalName, e);
    }

    if (extracted) {
      const MAXTXT = 2 * 1024 * 1024;
      const text = extracted
        .replace(/\u0000/g, ' ')
        .replace(/[\t ]+/g, ' ')
        .slice(0, MAXTXT);
      await prisma.documentText.upsert({
        where: { documentId: doc.id },
        update: { text },
        create: { documentId: doc.id, text },
      });
    }

    return Response.json(doc, { status: 201 });
  } catch (e) {
    console.error(e);
    return Response.json(
      { error: e instanceof Error ? e.message : 'upload failed', code: 500 },
      { status: 500 }
    );
  }
}
