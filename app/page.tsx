'use client';

import { useEffect, useMemo, useState } from 'react';

// ---- Types from API ----
type APIDoc = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  createdAt: string;
  updatedAt: string;
};

type SearchHit = {
  docId: string;
  name: string;
  start: number;
  end: number;
  snippetHtml: string; // server highlights term already
};

// For internal bookkeeping in UI
type UIHit = SearchHit & { key: string };

export default function Page() {
  // Documents list / uploads
  const [docs, setDocs] = useState<APIDoc[]>([]);
  const [pending, setPending] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');

  // Global search
  const [q, setQ] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<UIHit[]>([]);

  // Selection + patching
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [replaceText, setReplaceText] = useState('');
  const [applyMsg, setApplyMsg] = useState('');
  const selectedCount = useMemo(
    () => Object.values(checked).filter(Boolean).length,
    [checked]
  );

  // Load current docs
  async function loadDocs() {
    const r = await fetch('/api/documents');
    if (!r.ok) return;
    const data: APIDoc[] = await r.json();
    setDocs(data);
  }
  useEffect(() => {
    loadDocs();
  }, []);

  // Upload handlers
  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setPending(prev => [...prev, ...files]);
    e.target.value = '';
  }
  function removePending(name: string, lastModified: number) {
    setPending(prev =>
      prev.filter(f => !(f.name === name && f.lastModified === lastModified))
    );
  }
  async function uploadAll() {
    if (!pending.length) return;
    setIsUploading(true);
    setUploadMsg('');
    try {
      const tasks = pending.map(async file => {
        const fd = new FormData();
        fd.append('file', file);
        const r = await fetch('/api/upload', { method: 'POST', body: fd });
        const text = await r.text();
        if (!r.ok) throw new Error(text || 'upload failed');
        return JSON.parse(text) as APIDoc;
      });
      await Promise.allSettled(tasks);
      setUploadMsg('Upload complete.');
      setPending([]);
      await loadDocs();
    } catch (e: unknown) {
      setUploadMsg(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }

  // Search
  async function onSearch(ev: React.FormEvent) {
    ev.preventDefault();
    setIsSearching(true);
    setResults([]);
    setChecked({});

    const payload = { q, k: 500 }; // ask for many; UI will filter/limit visually if needed
    const r = await fetch('/api/documents/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    const list: UIHit[] = Array.isArray(data)
      ? data.map((h: SearchHit, index: number) => ({
          ...h,
          key: `${h.docId}:${h.start}:${h.end}:${index}`,
        }))
      : [];
    setResults(list);
    console.log(
      'Search results with keys:',
      list.map(h => ({ name: h.name, key: h.key, start: h.start, end: h.end }))
    );
    setIsSearching(false);
  }

  // Selection helpers
  function toggleOne(key: string) {
    console.log('toggleOne called with key:', key);
    setChecked(prev => {
      const newState = { ...prev, [key]: !prev[key] };
      console.log('Previous state:', prev);
      console.log('New state:', newState);
      return newState;
    });
  }
  function toggleAll() {
    const allSelected = results.length && results.every(h => checked[h.key]);
    if (allSelected) {
      setChecked({});
    } else {
      const next: Record<string, boolean> = {};
      results.forEach(h => {
        next[h.key] = true;
      });
      setChecked(next);
    }
  }

  // Apply selected hits as PATCH /documents/{id}
  async function applySelected() {
    setApplyMsg('');
    const chosen = results.filter(h => checked[h.key]);
    if (!chosen.length) {
      setApplyMsg('Select at least one occurrence.');
      return;
    }

    // Group by document id
    const byDoc = new Map<
      string,
      {
        docName: string;
        changes: Array<{
          operation: 'replace';
          range: { start: number; end: number };
          text: string;
        }>;
      }
    >();
    for (const h of chosen) {
      const entry = byDoc.get(h.docId) || { docName: h.name, changes: [] };
      entry.changes.push({
        operation: 'replace',
        range: { start: h.start, end: h.end },
        text: replaceText,
      });
      byDoc.set(h.docId, entry);
    }

    // Send one PATCH per document
    const tasks = Array.from(byDoc.entries()).map(
      async ([docId, { changes }]) => {
        const res = await fetch(`/api/documents/${docId}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ changes }),
        });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, docId, data };
      }
    );

    const settled = await Promise.allSettled(tasks);
    const ok = settled.filter(
      x =>
        x.status === 'fulfilled' &&
        (x as PromiseFulfilledResult<{ ok: boolean }>).value.ok
    ).length;
    const fail = settled.length - ok;

    setApplyMsg(
      `${ok} document${ok === 1 ? '' : 's'} updated${fail ? `, ${fail} failed` : ''}.`
    );
    // Optional: clear selection and prompt user to re-run search (offsets may be stale after edits)
    setChecked({});
  }

  const totalSize = useMemo(
    () => docs.reduce((a, d) => a + (d.sizeBytes || 0), 0),
    [docs]
  );

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Redline Playground</h1>
      <p className="text-sm text-gray-500 -mt-1">
        Left: upload & list. Right: search across all uploaded documents. Select
        hits below and apply replacements via PATCH.
      </p>

      {/* Two Columns */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LEFT — Upload & List */}
        <div className="border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">Upload documents</h2>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              multiple
              onChange={onPickFiles}
              className="block"
            />
            <button
              onClick={uploadAll}
              disabled={!pending.length || isUploading}
              className="border rounded-xl px-4 py-2 hover:bg-gray-50 disabled:opacity-40"
            >
              {isUploading
                ? 'Uploading…'
                : `Upload${pending.length ? ` ${pending.length}` : ''}`}
            </button>
          </div>
          {!!pending.length && (
            <div className="mt-3">
              <p className="text-xs text-gray-500 mb-1">Pending:</p>
              <ul className="text-sm list-disc ml-5">
                {pending.map(f => (
                  <li
                    key={`${f.name}-${f.lastModified}`}
                    className="flex items-center justify-between"
                  >
                    <span className="truncate pr-3">{f.name}</span>
                    <button
                      onClick={() => removePending(f.name, f.lastModified)}
                      className="text-red-600 text-xs hover:underline"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {uploadMsg && (
            <p className="text-xs text-gray-600 mt-2">{uploadMsg}</p>
          )}

          <hr className="my-4" />

          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium">Uploaded documents</h3>
            <span className="text-xs text-gray-500">
              {docs.length} files • {(totalSize / 1024).toFixed(1)} KB
            </span>
          </div>

          <ul className="divide-y">
            {docs.length === 0 ? (
              <li className="py-2 text-sm text-gray-500">
                No documents uploaded yet.
              </li>
            ) : (
              docs.map(d => (
                <li
                  key={d.id}
                  className="py-2 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="truncate" title={d.name}>
                      {d.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {d.mimeType} • {(d.sizeBytes / 1024).toFixed(1)} KB • v
                      {d.version}
                    </p>
                  </div>
                  <span
                    className="text-xs text-gray-400"
                    title={new Date(d.createdAt).toLocaleString()}
                  >
                    added {new Date(d.createdAt).toLocaleDateString()}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* RIGHT — Global Search */}
        <div className="border rounded-2xl p-5 shadow-sm">
          <h2 className="font-medium mb-3">Search all documents</h2>
          <form onSubmit={onSearch} className="space-y-3">
            <div>
              <label className="text-xs text-gray-600 block mb-1">Query</label>
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder='keywords or "quoted phrase"'
                className="w-full border rounded-xl px-3 py-2"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={!q.trim() || !docs.length || isSearching}
                className="border rounded-xl px-4 py-2 hover:bg-gray-50 disabled:opacity-40"
              >
                {isSearching ? 'Searching…' : 'Search'}
              </button>
              <span className="text-xs text-gray-500">
                {docs.length
                  ? `Across ${docs.length} document${docs.length > 1 ? 's' : ''}.`
                  : 'Upload documents to enable search.'}
              </span>
            </div>
          </form>
        </div>
      </section>

      {/* NEW: Change Request Controls (directly below search) */}
      <section className="border rounded-2xl p-5 shadow-sm">
        <h2 className="font-medium mb-2">Change request</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-600 block mb-1">
              Replacement text
            </label>
            <input
              value={replaceText}
              onChange={e => setReplaceText(e.target.value)}
              placeholder="What should matches be replaced with?"
              className="w-full border rounded-xl px-3 py-2"
            />
          </div>
          <div className="flex items-end">
            <p className="text-xs text-gray-500">
              Select occurrences below, then apply. Empty replacement will{' '}
              <em>delete</em> the matched text.
            </p>
          </div>
        </div>
        {applyMsg && <p className="text-xs text-gray-600 mt-2">{applyMsg}</p>}
      </section>

      {/* RESULTS BELOW */}
      <section className="border rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h2 className="font-medium">Results</h2>
            {/* <button
              onClick={toggleAll}
              disabled={!results.length}
              className="border rounded-xl px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-40"
            >
              {results.length && results.every(h => checked[h.key])
                ? 'Unselect all'
                : 'Select all'}
            </button> */}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              {selectedCount} selected
            </span>
            <button
              onClick={applySelected}
              disabled={!selectedCount}
              className="border rounded-xl px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-40"
            >
              Apply to selected
            </button>
          </div>
        </div>
        {results.length === 0 ? (
          <p className="text-sm text-gray-500 text-black">
            No results yet. Enter a query and click Search.
          </p>
        ) : (
          <ul className="space-y-3">
            {results.map((r, index) => (
              <li
                key={`${r.key}-${index}`}
                className="p-3 rounded-xl bg-gray-50 flex items-start gap-3 text-black"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={!!checked[r.key]}
                  onChange={e => {
                    e.stopPropagation();
                    toggleOne(r.key);
                  }}
                />
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 mb-1">
                    {r.name} • range [{r.start},{r.end}]
                  </p>
                  <p
                    className="text-sm whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: r.snippetHtml }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="text-xs text-gray-500">
        This page posts to <code>/api/upload</code>, <code>/api/documents</code>
        , <code>/api/documents/search</code>, and per-document{' '}
        <code>PATCH /api/documents/{'{id}'}</code>.
      </footer>
    </main>
  );
}
