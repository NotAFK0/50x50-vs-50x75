import { useMemo, useState } from 'react';
import { Gauge, Scale, Sigma, Waves } from 'lucide-react';
import { GlossaryProvider, Term } from './components/GlossaryDrawer';
import { ControlPanel } from './components/ControlPanel';
import { CarportScene3D, type CameraPreset, type VizMode } from './components/CarportScene3D';
import { InspectorPanel } from './components/InspectorPanel';
import { analyseCarport, type Assignment, type CarportInputs, type MemberKey, type MemberChoice } from './utils/structuralMath';
import { SECTIONS } from './data/steelSections';

const DEFAULT_INPUTS: CarportInputs = {
  spanM: 3.0,
  heightM: 2.4,
  bayM: 2.0,
  loadKpa: 0.3,
  loadMode: 'gravity',
  railPointKn: 0.5,
};

const DEFAULT_ASSIGNMENT: Assignment = {
  rafters: { section: 'RHS75', orient: 'deep' },
  uprights: { section: 'SHS50', orient: 'deep' },
  rails: { section: 'SHS50', orient: 'deep' },
};

function Kpi({ icon, label, value, sub, ok }: { icon: React.ReactNode; label: React.ReactNode; value: string; sub: string; ok: boolean }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <div className={`rounded-md p-2 ${ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-slate-500">{label}</div>
        <div className={`font-mono text-lg font-semibold ${ok ? 'text-slate-100' : 'text-rose-200'}`}>{value}</div>
        <div className="truncate font-mono text-[10px] text-slate-500">{sub}</div>
      </div>
    </div>
  );
}

export default function App() {
  const [inputs, setInputs] = useState<CarportInputs>(DEFAULT_INPUTS);
  const [assignment, setAssignment] = useState<Assignment>(DEFAULT_ASSIGNMENT);
  const [viz, setViz] = useState<VizMode>('realistic');
  const [preset, setPreset] = useState<CameraPreset>('full');
  const [exaggeration, setExaggeration] = useState(5);
  const [selected, setSelected] = useState<MemberKey | null>(null);

  const analysis = useMemo(() => analyseCarport(inputs, assignment), [inputs, assignment]);
  const { rafter, upright, rail } = analysis;

  const patchInputs = (patch: Partial<CarportInputs>) => setInputs((prev) => ({ ...prev, ...patch }));
  const setMember = (key: keyof Assignment, value: MemberChoice) => setAssignment((prev) => ({ ...prev, [key]: value }));

  return (
    <GlossaryProvider>
      <div className="min-h-screen bg-slate-950 text-slate-200 blueprint-grid">
        <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <h1 className="text-base font-semibold tracking-tight text-white sm:text-lg">
                Carport hollow-section comparator
              </h1>
              <p className="font-mono text-[11px] text-slate-500">
                AS/NZS 1163 · C350L0 · <Term id="yield-strength">f<sub>y</sub></Term> 350 MPa · E 200,000 MPa · ρ 7,850 kg/m³
              </p>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="rounded-md border border-cyan-500/40 px-2 py-1 text-cyan-200">{SECTIONS.SHS50.name}</span>
              <span className="text-slate-600">vs</span>
              <span className="rounded-md border border-amber-500/40 px-2 py-1 text-amber-200">{SECTIONS.RHS75.name}</span>
            </div>
          </div>
        </header>

        <main className="mx-auto grid max-w-[1600px] gap-4 p-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="order-2 lg:order-none lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-1">
            <ControlPanel
              inputs={inputs}
              onInputs={patchInputs}
              assignment={assignment}
              onAssignment={setMember}
              exaggeration={exaggeration}
              onExaggeration={setExaggeration}
              onReset={() => {
                setInputs(DEFAULT_INPUTS);
                setAssignment(DEFAULT_ASSIGNMENT);
                setExaggeration(5);
              }}
            />
          </aside>

          <section className="order-1 flex min-w-0 flex-col gap-4 lg:order-none">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi
                icon={<Waves size={18} />}
                label={<Term id="deflection">Rafter deflection</Term>}
                value={`${rafter.deltaMm.toFixed(1)} mm`}
                sub={`limit ${rafter.limitMm.toFixed(1)} mm · ${rafter.section.def.name}`}
                ok={rafter.deflectionUtil <= 1}
              />
              <Kpi
                icon={<Sigma size={18} />}
                label={<Term id="utilisation">Rafter bending</Term>}
                value={`${(rafter.capacityUtil * 100).toFixed(0)} %`}
                sub={`M ${(rafter.M / 1e6).toFixed(2)} kN·m · φMs ${(rafter.phiMs / 1e6).toFixed(2)}`}
                ok={rafter.capacityUtil <= 1}
              />
              <Kpi
                icon={<Gauge size={18} />}
                label={<Term id="euler-buckling">Upright utilisation</Term>}
                value={`${(upright.util * 100).toFixed(0)} %`}
                sub={`P_cr ${(upright.Pcr / 1000).toFixed(1)} kN · ${upright.govAxis === 'in' ? 'sway' : 'out-of-plane'} axis`}
                ok={upright.pass}
              />
              <Kpi
                icon={<Scale size={18} />}
                label={<Term id="base-rail">Base rail deflection</Term>}
                value={`${rail.deltaMm.toFixed(2)} mm`}
                sub={`${(rail.stressUtil * 100).toFixed(0)} % of f_y · ${rail.section.def.name}`}
                ok={rail.pass}
              />
            </div>

            <div className="h-[520px] min-h-[360px]">
              <CarportScene3D
                inputs={inputs}
                assignment={assignment}
                analysis={analysis}
                viz={viz}
                onVizChange={setViz}
                preset={preset}
                onPresetChange={setPreset}
                exaggeration={exaggeration}
                selected={selected}
                onSelect={setSelected}
              />
            </div>

            <InspectorPanel inputs={inputs} />
          </section>
        </main>

        <footer className="mx-auto max-w-[1600px] px-4 pb-6 text-[11px] text-slate-600">
          Screening model for education and comparison. Not a substitute for a certified structural design.
        </footer>
      </div>
    </GlossaryProvider>
  );
}
