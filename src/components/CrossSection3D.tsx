import { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Edges, Html, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { SECTIONS, SECTION_COLORS, type Orientation, type SectionId } from '../data/steelSections';
import { analyseRafter, orientSection, type CarportInputs } from '../utils/structuralMath';
import { Term } from './GlossaryDrawer';

const MM_TO_SCENE = 0.01; // 1 scene unit = 100 mm
const EXTRUDE_MM = 150;

/** Hollow rectangle profile in mm, extruded along z and centred. */
function profileGeometry(outerW: number, outerH: number, t: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-outerW / 2, -outerH / 2);
  shape.lineTo(outerW / 2, -outerH / 2);
  shape.lineTo(outerW / 2, outerH / 2);
  shape.lineTo(-outerW / 2, outerH / 2);
  shape.closePath();
  const hole = new THREE.Path();
  const iw = outerW / 2 - t;
  const ih = outerH / 2 - t;
  hole.moveTo(-iw, -ih);
  hole.lineTo(iw, -ih);
  hole.lineTo(iw, ih);
  hole.lineTo(-iw, ih);
  hole.closePath();
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: EXTRUDE_MM, bevelEnabled: false, steps: 1 });
  geo.translate(0, 0, -EXTRUDE_MM / 2);
  return geo;
}

function ProfileMesh({ id, outerW, outerH, t, x }: { id: SectionId; outerW: number; outerH: number; t: number; x: number }) {
  const geo = useMemo(() => profileGeometry(outerW, outerH, t), [outerW, outerH, t]);
  const color = SECTION_COLORS[id];
  return (
    <group position={[x, 0, 0]} scale={MM_TO_SCENE}>
      <mesh geometry={geo}>
        <meshStandardMaterial color={color} metalness={0.45} roughness={0.4} transparent opacity={0.85} />
        <Edges color={color} />
      </mesh>
    </group>
  );
}

function CrossScene({ rhsOrient, inputs }: { rhsOrient: Orientation; inputs: CarportInputs }) {
  const shs = SECTIONS.SHS50;
  const rhs = SECTIONS.RHS75;
  const rhsW = rhsOrient === 'deep' ? rhs.wide : rhs.deep;
  const rhsH = rhsOrient === 'deep' ? rhs.deep : rhs.wide;
  const xShs = -0.7;
  const xRhs = 0.7;
  const zNA = EXTRUDE_MM * MM_TO_SCENE * 0.5 + 0.12;
  const naY = 0;
  const rhsCentroid = xRhs;
  void inputs;

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 4, 5]} intensity={1.1} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.1} minDistance={1} maxDistance={8} target={[0, 0, 0]} />

      <ProfileMesh id="SHS50" outerW={shs.wide} outerH={shs.deep} t={shs.t} x={xShs} />
      <ProfileMesh id="RHS75" outerW={rhsW} outerH={rhsH} t={rhs.t} x={xRhs} />

      {/* Neutral axis through both centroids */}
      <Line
        points={[
          [-1.35, naY, zNA],
          [1.35, naY, zNA],
        ]}
        color="#e2e8f0"
        lineWidth={1.5}
        dashed
        dashSize={0.06}
        gapSize={0.04}
      />
      <Html position={[-1.25, naY + 0.05, zNA]} center style={{ pointerEvents: 'none' }}>
        <span className="whitespace-nowrap rounded bg-slate-950/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-200">neutral axis</span>
      </Html>

      {/* Extreme fibre distance y for each section */}
      {[
        { x: xShs, h: shs.deep, w: shs.wide, label: `y = ${(shs.deep / 2).toFixed(1)} mm`, color: SECTION_COLORS.SHS50 },
        { x: rhsCentroid, h: rhsH, w: rhsW, label: `y = ${(rhsH / 2).toFixed(1)} mm`, color: SECTION_COLORS.RHS75 },
      ].map((d) => {
        const xDim = d.x + (d.w / 2) * MM_TO_SCENE + 0.22;
        const yTop = (d.h / 2) * MM_TO_SCENE;
        return (
          <group key={d.label + d.x}>
            <Line points={[[xDim, naY, zNA], [xDim, yTop, zNA]]} color={d.color} lineWidth={2} />
            <Line points={[[d.x + (d.w / 2) * MM_TO_SCENE, yTop, zNA], [xDim + 0.06, yTop, zNA]]} color={d.color} lineWidth={1} />
            <Html position={[xDim + 0.08, yTop / 2, zNA]} style={{ pointerEvents: 'none' }}>
              <span className="whitespace-nowrap rounded bg-slate-950/85 px-1.5 py-0.5 font-mono text-[10px]" style={{ color: d.color }}>
                {d.label}
              </span>
            </Html>
          </group>
        );
      })}

      {/* Labels */}
      <Html position={[xShs, -(shs.deep / 2) * MM_TO_SCENE - 0.22, 0]} center style={{ pointerEvents: 'none' }}>
        <span className="whitespace-nowrap font-mono text-[11px] text-cyan-200">50×50×2.0 SHS</span>
      </Html>
      <Html position={[xRhs, -(rhsH / 2) * MM_TO_SCENE - 0.22, 0]} center style={{ pointerEvents: 'none' }}>
        <span className="whitespace-nowrap font-mono text-[11px] text-amber-200">
          75×50×1.6 RHS · {rhsOrient === 'deep' ? 'on edge' : 'flat'}
        </span>
      </Html>
      <Html position={[xShs, (shs.deep / 2) * MM_TO_SCENE + 0.1, zNA]} center style={{ pointerEvents: 'none' }}>
        <span className="whitespace-nowrap rounded bg-slate-950/80 px-1 font-mono text-[10px] text-slate-300">t = {shs.t} mm</span>
      </Html>
      <Html position={[xRhs - (rhsW / 2) * MM_TO_SCENE - 0.12, (rhsH / 2) * MM_TO_SCENE + 0.1, zNA]} center style={{ pointerEvents: 'none' }}>
        <span className="whitespace-nowrap rounded bg-slate-950/80 px-1 font-mono text-[10px] text-slate-300">t = {rhs.t} mm</span>
      </Html>
    </>
  );
}

function Bar({ label, a, b, unit, decimals = 0, aLabel, bLabel }: { label: React.ReactNode; a: number; b: number; unit: string; decimals?: number; aLabel: string; bLabel: string }) {
  const max = Math.max(a, b) || 1;
  const row = (value: number, color: string, name: string) => (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 font-mono text-[10px] text-slate-500">{name}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded bg-slate-800">
        <div className="h-full rounded transition-[width] duration-150" style={{ width: `${(value / max) * 100}%`, background: color }} />
      </div>
      <span className="w-24 shrink-0 text-right font-mono text-[11px] text-slate-200">
        {value.toFixed(decimals)} <span className="text-slate-500">{unit}</span>
      </span>
    </div>
  );
  return (
    <div className="space-y-1">
      <div className="text-[11px] text-slate-400">{label}</div>
      {row(a, SECTION_COLORS.SHS50, aLabel)}
      {row(b, SECTION_COLORS.RHS75, bLabel)}
    </div>
  );
}

export function CrossSection3D({ inputs }: { inputs: CarportInputs }) {
  const [rhsOrient, setRhsOrient] = useState<Orientation>('deep');
  const shsProps = orientSection('SHS50', 'deep');
  const rhsProps = orientSection('RHS75', rhsOrient);
  const shsR = analyseRafter(shsProps, inputs);
  const rhsR = analyseRafter(rhsProps, inputs);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-400">
            Drag to orbit. Neutral axis passes through the centroid; <Term id="extreme-fibre">extreme fibre distance</Term> sets the lever arm for{' '}
            <Term id="section-modulus">Z</Term>.
          </p>
          <div className="flex gap-1">
            {(['deep', 'wide'] as Orientation[]).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setRhsOrient(o)}
                className={`rounded-md border px-2 py-1 text-[11px] ${
                  rhsOrient === o ? 'border-amber-400 bg-amber-500/15 text-amber-100' : 'border-slate-700 text-slate-400'
                }`}
              >
                RHS {o === 'deep' ? 'on edge' : 'flat'}
              </button>
            ))}
          </div>
        </div>
        <div className="h-[340px] overflow-hidden rounded-xl border border-slate-800 bg-slate-950 blueprint-grid">
          <Canvas camera={{ position: [0.2, 1.1, 3.6], fov: 30 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
            <CrossScene rhsOrient={rhsOrient} inputs={inputs} />
          </Canvas>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="text-xs font-semibold uppercase tracking-widest text-cyan-400">Live comparison</div>
        <Bar label={<span>Mass per metre (kg/m)</span>} a={shsProps.massPerM} b={rhsProps.massPerM} unit="kg/m" decimals={2} aLabel="SHS" bLabel="RHS" />
        <Bar label={<><Term id="second-moment">Second moment I</Term> (bending axis)</>} a={shsProps.bend.I / 1e4} b={rhsProps.bend.I / 1e4} unit="×10⁴ mm⁴" decimals={1} aLabel="SHS" bLabel="RHS" />
        <Bar label={<><Term id="section-modulus">Section modulus Z</Term></>} a={shsProps.bend.Z} b={rhsProps.bend.Z} unit="mm³" aLabel="SHS" bLabel="RHS" />
        <Bar
          label={<><Term id="span-limit">Max span at L/250</Term> (m)</>}
          a={shsR.maxSpanServiceMm / 1000}
          b={rhsR.maxSpanServiceMm / 1000}
          unit="m"
          decimals={2}
          aLabel="SHS"
          bLabel="RHS"
        />
        <p className="border-t border-slate-800 pt-3 text-[11px] leading-relaxed text-slate-500">
          At the current load of {(inputs.loadKpa * inputs.bayM).toFixed(2)} kN/m per rafter, the RHS stiffness ratio is{' '}
          <span className="font-mono text-amber-200">{(rhsProps.bend.I / shsProps.bend.I).toFixed(2)}×</span>. Wall thickness: SHS{' '}
          {SECTIONS.SHS50.t} mm vs RHS {SECTIONS.RHS75.t} mm.
        </p>
      </div>
    </div>
  );
}
