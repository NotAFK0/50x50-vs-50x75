import { Fragment, useState, type ReactNode } from 'react';
import { ROLE_VERDICTS, SECTION_COLORS, type GlossaryId, type Orientation, type SectionId } from '../data/steelSections';
import {
  analyseRafter,
  analyseRail,
  analyseUpright,
  localSlenderness,
  orientSection,
  type CarportInputs,
} from '../utils/structuralMath';
import { SECTIONS } from '../data/steelSections';
import { CrossSection3D } from './CrossSection3D';
import { GlossaryDictionary, Term } from './GlossaryDrawer';

type Tab = 'verdicts' | 'section' | 'glossary';

const TABS: { id: Tab; label: string }[] = [
  { id: 'verdicts', label: 'Carport verdicts' },
  { id: 'section', label: '3D cross-section' },
  { id: 'glossary', label: 'Terms dictionary' },
];

/** Auto-links technical phrases in verdict prose to their glossary entries. */
const LINKS: Array<{ pattern: RegExp; id: GlossaryId }> = [
  { pattern: /second moment of area/i, id: 'second-moment' },
  { pattern: /section modulus/i, id: 'section-modulus' },
  { pattern: /radius of gyration|r_x|r_y|r = /i, id: 'radius-gyration' },
  { pattern: /bending moment/i, id: 'bending-moment' },
  { pattern: /buckling|buckle/i, id: 'euler-buckling' },
  { pattern: /deflection|sag/i, id: 'deflection' },
  { pattern: /yield/i, id: 'yield-strength' },
  { pattern: /uplift/i, id: 'uplift' },
  { pattern: /purlins?/i, id: 'purlin' },
  { pattern: /denting|crush/i, id: 'local-buckling' },
  { pattern: /weakest axis/i, id: 'radius-gyration' },
];

function linkify(text: string): ReactNode[] {
  const alternation = new RegExp(`(${LINKS.map((l) => l.pattern.source).join('|')})`, 'gi');
  const parts = text.split(alternation);
  return parts.map((part, i) => {
    if (!part) return null;
    const hit = LINKS.find((l) => l.pattern.test(part));
    return hit ? (
      <Term key={i} id={hit.id}>
        {part}
      </Term>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    );
  });
}

function Pill({ children, color }: { children: ReactNode; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px]" style={{ borderColor: color, color }}>
      {children}
    </span>
  );
}

function Candidate({ label, id, orient }: { label: string; id: SectionId; orient: Orientation }) {
  return { label, id, orient } as const;
}

const CANDIDATES: Array<ReturnType<typeof Candidate>> = [
  Candidate({ label: '50×50×2.0 SHS', id: 'SHS50', orient: 'deep' }),
  Candidate({ label: '75×50×1.6 RHS · on edge', id: 'RHS75', orient: 'deep' }),
  Candidate({ label: '75×50×1.6 RHS · flat', id: 'RHS75', orient: 'wide' }),
];

function NumCell({ children, good }: { children: ReactNode; good?: boolean }) {
  return <td className={`px-2 py-1.5 text-right font-mono text-[11px] ${good === undefined ? 'text-slate-300' : good ? 'text-emerald-300' : 'text-rose-300'}`}>{children}</td>;
}

function VerdictTable({ inputs, role }: { inputs: CarportInputs; role: 'rafters' | 'uprights' | 'rails' }) {
  const rows = CANDIDATES.map((c) => {
    const sec = orientSection(c.id, c.orient);
    if (role === 'rafters') {
      const r = analyseRafter(sec, inputs);
      return { c, cells: [`${r.deltaMm.toFixed(1)} mm`, `${(r.deflectionUtil * 100).toFixed(0)}%`, `${(r.capacityUtil * 100).toFixed(0)}%`, `${(r.maxSpanServiceMm / 1000).toFixed(2)} m`], key: r.deltaMm, good: r.deflectionUtil <= 1 };
    }
    if (role === 'uprights') {
      const u = analyseUpright(sec, inputs);
      return { c, cells: [`${(u.Pcr / 1000).toFixed(1)} kN`, `${(u.Nc / 1000).toFixed(1)} kN`, `${sec.bend.r.toFixed(1)} mm`, `${(u.util * 100).toFixed(0)}%`], key: -u.Pcr, good: u.pass };
    }
    const rail = analyseRail(sec, inputs);
    const ls = localSlenderness(sec.def);
    return { c, cells: [`${rail.deltaMm.toFixed(2)} mm`, `${(rail.stressUtil * 100).toFixed(0)}%`, `${ls.governing.toFixed(1)}`], key: rail.deltaMm, good: rail.pass };
  });
  const best = rows.reduce((a, b) => (b.key < a.key ? b : a));
  const headers =
    role === 'rafters'
      ? ['δ (mid-span)', 'δ / L/250', 'M / φMs', 'Max span @ L/250']
      : role === 'uprights'
        ? ['Euler P_cr', 'Design N_c', 'r (bend axis)', 'Utilisation']
        : ['δ under point load', 'σ / f_y', 'b/t (worst face)'];

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="w-full min-w-[440px] border-collapse">
        <thead className="bg-slate-900/80">
          <tr>
            <th className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-slate-500">Candidate</th>
            {headers.map((h) => (
              <th key={h} className="px-2 py-1.5 text-right text-[10px] font-medium uppercase tracking-wider text-slate-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((r) => (
            <tr key={r.c.label} className={r === best ? 'bg-emerald-500/5' : ''}>
              <td className="px-2 py-1.5 text-[11px] text-slate-200">
                <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: SECTION_COLORS[r.c.id] }} />
                {r.c.label}
                {r === best && <span className="ml-2 text-[10px] text-emerald-300">best</span>}
              </td>
              {r.cells.map((cell, i) => (
                <NumCell key={i} good={i === 0 && role === 'rafters' ? r.good : undefined}>
                  {cell}
                </NumCell>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VerdictsTab({ inputs }: { inputs: CarportInputs }) {
  return (
    <div className="space-y-6">
      {ROLE_VERDICTS.map((v) => (
        <article key={v.role} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">{v.title}</h3>
            <Pill color={v.role === 'rafters' ? '#f59e0b' : v.role === 'uprights' ? '#22d3ee' : '#34d399'}>
              {v.role === 'rafters' ? 'Span & sag' : v.role === 'uprights' ? 'Buckling & sway' : 'Ground & clamping'}
            </Pill>
          </div>
          <p className="text-sm font-medium text-cyan-100">{linkify(v.headline)}</p>
          <VerdictTable inputs={inputs} role={v.role} />
          <div className="space-y-2 text-sm leading-relaxed text-slate-300">
            {v.paragraphs.map((p, i) => (
              <p key={i}>{linkify(p)}</p>
            ))}
          </div>
        </article>
      ))}
      <p className="rounded-md border border-slate-800 bg-slate-900/60 p-3 text-[11px] leading-relaxed text-slate-500">
        Screening only. Uses service-level uniform loads, simply supported rafters, a cantilever column model (conservative for wind), K = 2.0 for
        in-plane sway and K = 1.0 for out-of-plane restraint, and an indicative local-slenderness limit of 1600/√f_y. Confirm with a full AS 4100 / AS/NZS 1170
        design before construction. Local wall slenderness: SHS b/t = {localSlenderness(SECTIONS.SHS50).governing.toFixed(1)}, RHS b/t ={' '}
        {localSlenderness(SECTIONS.RHS75).governing.toFixed(1)} (stated {SECTIONS.RHS75.statedWallRatio}).
      </p>
    </div>
  );
}

export function InspectorPanel({ inputs }: { inputs: CarportInputs }) {
  const [tab, setTab] = useState<Tab>('verdicts');
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60">
      <div className="flex gap-1 overflow-x-auto border-b border-slate-800 p-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs transition ${
              tab === t.id ? 'bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/50' : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="p-4">
        {/* Panels stay mounted and are hidden rather than unmounted: unmounting the 3D canvas
            while drei Html overlays are attached throws a DOM removeChild error. */}
        <div className={tab === 'verdicts' ? 'block' : 'hidden'}>
          <VerdictsTab inputs={inputs} />
        </div>
        <div className={tab === 'section' ? 'block' : 'hidden'}>
          <CrossSection3D inputs={inputs} />
        </div>
        <div className={tab === 'glossary' ? 'block' : 'hidden'}>
          <GlossaryDictionary />
        </div>
      </div>
    </section>
  );
}
