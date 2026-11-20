import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BookOpen, Search, X } from 'lucide-react';
import { GLOSSARY, getTerm, type GlossaryEntry, type GlossaryId } from '../data/steelSections';

interface GlossaryContextValue {
  activeId: GlossaryId | null;
  openTerm: (id: GlossaryId) => void;
  closeTerm: () => void;
}

const GlossaryContext = createContext<GlossaryContextValue | null>(null);

export function GlossaryProvider({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState<GlossaryId | null>(null);
  const value = useMemo<GlossaryContextValue>(
    () => ({ activeId, openTerm: setActiveId, closeTerm: () => setActiveId(null) }),
    [activeId],
  );
  return (
    <GlossaryContext.Provider value={value}>
      {children}
      <GlossaryDrawer termId={activeId} onClose={() => setActiveId(null)} />
    </GlossaryContext.Provider>
  );
}

export function useGlossary(): GlossaryContextValue {
  const ctx = useContext(GlossaryContext);
  if (!ctx) throw new Error('useGlossary must be used inside <GlossaryProvider>');
  return ctx;
}

/** Inline, clickable engineering term. Opens the glossary drawer for that term. */
export function Term({ id, children }: { id: GlossaryId; children: ReactNode }) {
  const { openTerm } = useGlossary();
  return (
    <button
      type="button"
      onClick={() => openTerm(id)}
      className="cursor-help font-medium text-cyan-200 underline decoration-cyan-400/70 decoration-dotted underline-offset-4 transition hover:text-white"
    >
      {children}
    </button>
  );
}

function TermCard({ entry }: { entry: GlossaryEntry }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-slate-300">
      <div>
        <div className="flex flex-wrap items-baseline gap-2">
          <h3 className="text-lg font-semibold text-white">{entry.term}</h3>
          {entry.symbol && (
            <span className="font-mono text-cyan-300">
              {entry.symbol}
              {entry.unit && entry.unit !== '—' ? <span className="text-slate-500"> [{entry.unit}]</span> : null}
            </span>
          )}
        </div>
      </div>
      <Block label="Plain English">{entry.plain}</Block>
      <Block label="Technical">{entry.technical}</Block>
      {entry.formula && (
        <div className="rounded-md border border-slate-800 bg-slate-900/80 px-3 py-2">
          <div className="mb-1 text-[10px] uppercase tracking-widest text-slate-500">Formula</div>
          <div className="font-mono text-base text-emerald-300">{entry.formula}</div>
        </div>
      )}
      <Block label="Carport analogy">{entry.analogy}</Block>
    </div>
  );
}

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-widest text-slate-500">{label}</div>
      <p>{children}</p>
    </div>
  );
}

/** Slide-over drawer showing a single term. */
export function GlossaryDrawer({ termId, onClose }: { termId: GlossaryId | null; onClose: () => void }) {
  useEffect(() => {
    if (!termId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [termId, onClose]);

  if (!termId) return null;
  const entry = getTerm(termId);
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Close glossary" className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative h-full w-full max-w-md overflow-y-auto border-l border-cyan-500/30 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs uppercase tracking-widest text-cyan-400">
            <BookOpen size={14} /> Engineering glossary
          </span>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {entry ? <TermCard entry={entry} /> : <p className="text-slate-400">Term not found.</p>}
      </aside>
    </div>
  );
}

/** Searchable inline dictionary of every term (used in the inspector). */
export function GlossaryDictionary() {
  const { openTerm } = useGlossary();
  const [query, setQuery] = useState('');
  const filtered = GLOSSARY.filter((e) => {
    const q = query.trim().toLowerCase();
    return !q || e.term.toLowerCase().includes(q) || e.plain.toLowerCase().includes(q) || (e.symbol ?? '').toLowerCase().includes(q);
  });
  return (
    <div className="space-y-3">
      <label className="relative block">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search terms, symbols or meaning…"
          className="w-full rounded-md border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
        />
      </label>
      <ul className="grid gap-2 md:grid-cols-2">
        {filtered.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => openTerm(e.id)}
              className="w-full rounded-md border border-slate-800 bg-slate-900/60 p-3 text-left transition hover:border-cyan-500/50 hover:bg-slate-900"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-slate-100">{e.term}</span>
                {e.symbol && <span className="font-mono text-xs text-cyan-300">{e.symbol}</span>}
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-slate-400">{e.plain}</p>
            </button>
          </li>
        ))}
        {filtered.length === 0 && <li className="text-sm text-slate-500">No matching terms.</li>}
      </ul>
    </div>
  );
}
