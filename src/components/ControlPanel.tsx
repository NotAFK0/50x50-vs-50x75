import { RotateCcw } from 'lucide-react';
import { ORIENTATION_LABELS, SECTIONS, type SectionId, type Orientation } from '../data/steelSections';
import type { Assignment, CarportInputs, LoadMode, MemberChoice } from '../utils/structuralMath';
import { Term } from './GlossaryDrawer';
import type { GlossaryId } from '../data/steelSections';

interface ControlPanelProps {
  inputs: CarportInputs;
  onInputs: (patch: Partial<CarportInputs>) => void;
  assignment: Assignment;
  onAssignment: (key: keyof Assignment, value: MemberChoice) => void;
  exaggeration: number;
  onExaggeration: (n: number) => void;
  onReset: () => void;
}

function Slider({
  label,
  term,
  value,
  min,
  max,
  step,
  unit,
  decimals = 2,
  onChange,
  hint,
}: {
  label: string;
  term?: GlossaryId;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  decimals?: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-slate-300">{term ? <Term id={term}>{label}</Term> : label}</span>
        <span className="font-mono text-cyan-200">
          {value.toFixed(decimals)} <span className="text-slate-500">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-cyan-400"
      />
      {hint && <p className="text-[10px] text-slate-500">{hint}</p>}
    </label>
  );
}

function SectionToggle({ value, onChange }: { value: SectionId; onChange: (v: SectionId) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {(Object.keys(SECTIONS) as SectionId[]).map((id) => {
        const def = SECTIONS[id];
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`rounded-md border px-2 py-2 text-left text-[11px] transition ${
              active
                ? id === 'SHS50'
                  ? 'border-cyan-400 bg-cyan-500/15 text-cyan-100'
                  : 'border-amber-400 bg-amber-500/15 text-amber-100'
                : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
            }`}
          >
            <div className="font-mono font-semibold">{def.name.split(' ').slice(0, 3).join(' ')}</div>
            <div className="text-[10px] opacity-70">{def.shape} · {def.massPerM} kg/m</div>
          </button>
        );
      })}
    </div>
  );
}

function MemberPicker({
  title,
  choice,
  onChange,
  labels,
}: {
  title: string;
  choice: MemberChoice;
  onChange: (c: MemberChoice) => void;
  labels: { deep: string; wide: string };
}) {
  const isRhs = choice.section === 'RHS75';
  return (
    <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">{title}</div>
      <SectionToggle value={choice.section} onChange={(section) => onChange({ ...choice, section })} />
      {isRhs ? (
        <div className="grid grid-cols-2 gap-1.5">
          {(['deep', 'wide'] as Orientation[]).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => onChange({ ...choice, orient: o })}
              className={`rounded-md border px-2 py-1.5 text-[11px] transition ${
                choice.orient === o
                  ? 'border-amber-400 bg-amber-500/15 text-amber-100'
                  : 'border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              {labels[o]}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-slate-500">Square section: orientation has no effect.</p>
      )}
    </div>
  );
}

export function ControlPanel({
  inputs,
  onInputs,
  assignment,
  onAssignment,
  exaggeration,
  onExaggeration,
  onReset,
}: ControlPanelProps) {
  return (
    <div className="space-y-5">
      <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-cyan-400">Geometry</h2>
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            <RotateCcw size={12} /> Reset
          </button>
        </div>
        <Slider
          label="Rafter span"
          value={inputs.spanM}
          min={2.4}
          max={6.0}
          step={0.05}
          unit="m"
          onChange={(v) => onInputs({ spanM: v })}
        />
        <Slider
          label="Column height"
          value={inputs.heightM}
          min={2.1}
          max={3.6}
          step={0.05}
          unit="m"
          onChange={(v) => onInputs({ heightM: v })}
        />
        <Slider
          label="Bay spacing"
          term="tributary-width"
          value={inputs.bayM}
          min={2.0}
          max={4.5}
          step={0.05}
          unit="m"
          hint="Frame spacing; also the rafter tributary width."
          onChange={(v) => onInputs({ bayM: v })}
        />
      </section>

      <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-cyan-400">Loads</h2>
        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              ['gravity', 'Downward roof load'],
              ['wind', 'Uplift + lateral gust'],
            ] as Array<[LoadMode, string]>
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => onInputs({ loadMode: mode })}
              className={`rounded-md border px-2 py-2 text-[11px] transition ${
                inputs.loadMode === mode
                  ? 'border-emerald-400 bg-emerald-500/15 text-emerald-100'
                  : 'border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Slider
          label="Applied load"
          value={inputs.loadKpa}
          min={0.2}
          max={1.5}
          step={0.05}
          unit="kPa"
          onChange={(v) => onInputs({ loadKpa: v })}
        />
        <Slider
          label="Boot / anchor load on base rail"
          value={inputs.railPointKn}
          min={0}
          max={5}
          step={0.1}
          unit="kN"
          decimals={1}
          onChange={(v) => onInputs({ railPointKn: v })}
        />
        <Slider
          label="Deflection exaggeration"
          value={exaggeration}
          min={1}
          max={50}
          step={1}
          unit="×"
          decimals={0}
          onChange={onExaggeration}
          hint="Used by the deflection view and the ghost overlay."
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-cyan-400">Member steel assignment</h2>
        <MemberPicker
          title="Rafters (main roof beams)"
          choice={assignment.rafters}
          onChange={(c) => onAssignment('rafters', c)}
          labels={ORIENTATION_LABELS.rafter}
        />
        <MemberPicker
          title="Uprights (columns)"
          choice={assignment.uprights}
          onChange={(c) => onAssignment('uprights', c)}
          labels={ORIENTATION_LABELS.upright}
        />
        <MemberPicker
          title="Base rails (sill ties)"
          choice={assignment.rails}
          onChange={(c) => onAssignment('rails', c)}
          labels={ORIENTATION_LABELS.rail}
        />
        <div className="rounded-lg border border-dashed border-slate-700 p-3 text-[11px] text-slate-500">
          <span className="font-semibold text-slate-400">Purlins</span> — Excluded from comparison (separate cold-formed section).
        </div>
      </section>
    </div>
  );
}
