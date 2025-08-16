'use client';

import { useEffect, useMemo, useState } from 'react';

type APIDoc = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  createdAt: string;
  updatedAt: string;
};

type SearchResult = {
  id: string;
  name: string;
  snippet: string;
  score?: number;
};

export default function Page() {
  const [docs, setDocs] = useState<APIDoc[]>([]);
  const [pending, setPending] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');

  const [q, setQ] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [apiPreview, setApiPreview] = useState('');

  async function loadDocs() {
    const r = await fetch('/api/documents');
    if (!r.ok) return;
    const data: APIDoc[] = await r.json();
    setDocs(data);
  }
  useEffect(() => {
    loadDocs();
  }, []);

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
      const settled = await Promise.allSettled(tasks);
      const succeeded = settled.filter(x => x.status === 'fulfilled').length;
      const failed = settled.length - succeeded;
      setUploadMsg(`${succeeded} uploaded, ${failed} failed.`);
      setPending([]);
      await loadDocs();
    } catch (e) {
      setUploadMsg(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }

  async function onSearch(ev: React.FormEvent) {
    ev.preventDefault();
    setIsSearching(true);
    setResults([]);

    const payload = { q, k: 10 };
    setApiPreview(JSON.stringify(payload, null, 2));

    const r = await fetch('/api/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    setResults(Array.isArray(data) ? data : []);

    setIsSearching(false);
  }

  const totalSize = useMemo(
    () => docs.reduce((a, d) => a + (d.sizeBytes || 0), 0),
    [docs]
  );

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Redline Playground</h1>
      <p className="text-sm text-gray-500 -mt-1">
        Left: upload & list. Right: search across all uploaded documents.
        Results below.
      </p>

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

          {apiPreview && (
            <pre className="mt-3 bg-gray-50 p-3 rounded-xl text-xs overflow-auto max-h-40 text-black">
              {apiPreview}
            </pre>
          )}
        </div>
      </section>

      {/* RESULTS BELOW */}
      <section className="border rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-medium">Results</h2>
          <span className="text-sm text-gray-500">
            {results.length} match{results.length === 1 ? '' : 'es'}
          </span>
        </div>
        {results.length === 0 ? (
          <p className="text-sm text-gray-500">
            No results yet. Enter a query and click Search.
          </p>
        ) : (
          <ul className="space-y-3">
            {results.map((r, i) => (
              <li key={i} className="p-3 rounded-xl bg-gray-50 text-black">
                <p className="text-xs text-gray-500 mb-1">{r.name}</p>
                <p className="text-sm whitespace-pre-wrap">{r.snippet}</p>
                {typeof r.score === 'number' && (
                  <p className="text-xs text-gray-500 mt-1">
                    score: {r.score.toFixed(3)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="text-xs text-gray-500">
        Search now calls <code>/api/search</code>. Text search works for plain
        text uploads; PDFs/DOCX will need extractors next.
      </footer>
    </main>
  );
}
