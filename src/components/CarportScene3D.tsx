import { useEffect, useMemo, useRef, type ComponentRef, type ReactNode, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Box, Flame, Layers, Maximize, Ruler, Waves } from 'lucide-react';
import { FY, SECTION_COLORS } from '../data/steelSections';
import {
  analyseRafter,
  orientSection,
  rafterMomentAt,
  rafterSagMm,
  railMomentAt,
  swayAt,
  uprightStressAt,
  utilisationRamp,
  type Assignment,
  type CarportAnalysis,
  type CarportInputs,
  type MemberKey,
  type RafterResult,
} from '../utils/structuralMath';
import { buildTubeGeometry } from '../utils/geometry';
import { Term } from './GlossaryDrawer';

export type VizMode = 'realistic' | 'deflection' | 'stress';
export type CameraPreset = 'full' | 'mid' | 'column' | 'ghost';

export interface CarportScene3DProps {
  inputs: CarportInputs;
  assignment: Assignment;
  analysis: CarportAnalysis;
  viz: VizMode;
  onVizChange: (v: VizMode) => void;
  preset: CameraPreset;
  onPresetChange: (p: CameraPreset) => void;
  exaggeration: number;
  selected: MemberKey | null;
  onSelect: (m: MemberKey | null) => void;
}

type Vec3 = [number, number, number];
type CameraGoal = { pos: THREE.Vector3; look: THREE.Vector3 };
type ControlsRef = ComponentRef<typeof OrbitControls>;

const MEMBER_COLOR = {
  upright: '#22d3ee', // cyan
  rafter: '#f59e0b', // amber
  rail: '#34d399', // emerald
  ghostA: '#67e8f9',
  ghostB: '#fbbf24',
};

const RAFTER_STATIONS = 40;
const COLUMN_STATIONS = 24;
const RAIL_STATIONS = 24;

function heatColor(u: number): THREE.Color {
  const [r, g, b] = utilisationRamp(Math.min(Math.max(u, 0), 1));
  return new THREE.Color(r, g, b);
}

/** One colour per station: stress heatmap when enabled, otherwise the member's base colour. */
function stationColors(count: number, heatmap: boolean, base: string, utilAt: (i: number) => number): THREE.Color[] {
  const baseColor = new THREE.Color(base);
  return Array.from({ length: count }, (_, i) => (heatmap ? heatColor(utilAt(i)) : baseColor));
}

function cameraGoals(inputs: CarportInputs, rafterDepth: number): Record<CameraPreset, CameraGoal> {
  const L = inputs.spanM;
  const H = inputs.heightM;
  const zf = inputs.bayM / 2;
  const d = Math.max(L, inputs.bayM * 1.5, H * 1.5, 2.5);
  return {
    full: { pos: new THREE.Vector3(d * 1.0, d * 0.75, d * 1.15), look: new THREE.Vector3(0, H * 0.8, 0) },
    mid: { pos: new THREE.Vector3(0.2, H + rafterDepth + 0.35, zf + 1.1), look: new THREE.Vector3(0, H + rafterDepth, zf) },
    column: { pos: new THREE.Vector3(L / 2 + 0.9, 0.9, zf + 1.3), look: new THREE.Vector3(L / 2, 0.4, zf) },
    ghost: { pos: new THREE.Vector3(0, H * 0.95, zf + Math.max(1.8, L * 0.6)), look: new THREE.Vector3(0, H + rafterDepth * 0.5, zf) },
  };
}

/** Animates the camera and orbit target to the chosen preset. Orbiting afterwards is free. */
function CameraRig({
  preset,
  goals,
  controlsRef,
}: {
  preset: CameraPreset;
  goals: Record<CameraPreset, CameraGoal>;
  controlsRef: RefObject<ControlsRef | null>;
}) {
  const { camera } = useThree();
  const animating = useRef(true);
  const goalsRef = useRef(goals);

  useEffect(() => {
    goalsRef.current = goals;
  }, [goals]);

  useEffect(() => {
    animating.current = true;
  }, [preset]);

  useFrame((_, dt) => {
    const goal = goalsRef.current[preset];
    if (!animating.current || !goal) return;
    const k = 1 - Math.exp(-dt * 6);
    camera.position.lerp(goal.pos, k);
    const controls = controlsRef.current;
    if (controls) {
      controls.target.lerp(goal.look, k);
      controls.update();
    }
    const settled =
      camera.position.distanceTo(goal.pos) < 0.005 && (!controls || controls.target.distanceTo(goal.look) < 0.005);
    if (settled) animating.current = false;
  });
  return null;
}

function Arrow({ from, to, color }: { from: Vec3; to: Vec3; color: string }) {
  const dir = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const length = dir.length();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  const mid: Vec3 = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2];
  const head = Math.min(0.07, length * 0.35);
  const r = 0.009;
  return (
    <group position={mid} quaternion={quaternion}>
      <mesh position={[0, -head / 2, 0]}>
        <cylinderGeometry args={[r, r, length - head, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[0, length / 2 - head / 2, 0]}>
        <coneGeometry args={[r * 3, head, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

/** A vertex-coloured steel member that can be clicked to select its group. */
function Member({
  geometry,
  selected,
  onSelect,
  opacity = 1,
}: {
  geometry: THREE.BufferGeometry;
  selected: boolean;
  onSelect?: () => void;
  opacity?: number;
}) {
  return (
    <mesh
      geometry={geometry}
      onClick={
        onSelect
          ? (e) => {
              e.stopPropagation();
              onSelect();
            }
          : undefined
      }
      onPointerOver={
        onSelect
          ? (e) => {
              e.stopPropagation();
              document.body.style.cursor = 'pointer';
            }
          : undefined
      }
      onPointerOut={() => {
        document.body.style.cursor = '';
      }}
    >
      <meshStandardMaterial
        vertexColors
        roughness={0.4}
        metalness={0.5}
        emissive={selected ? '#334155' : '#000000'}
        transparent={opacity < 1}
        opacity={opacity}
        depthWrite={opacity >= 1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function Label({ position, children, className = '' }: { position: Vec3; children: ReactNode; className?: string }) {
  return (
    <Html position={position} center style={{ pointerEvents: 'none' }}>
      <span className={`whitespace-nowrap rounded bg-slate-950/85 px-1.5 py-0.5 font-mono text-[11px] ${className}`}>{children}</span>
    </Html>
  );
}

function CarportModel(props: CarportScene3DProps) {
  const { inputs, analysis, viz, preset, exaggeration, selected, onSelect } = props;
  const L = inputs.spanM;
  const H = inputs.heightM;
  const B = inputs.bayM;
  const zf = B / 2;
  const heatmap = viz === 'stress';

  const rafter = analysis.rafter;
  const upright = analysis.upright;
  const rail = analysis.rail;
  const rafterDepth = rafter.section.depthMm / 1000;
  const rafterTop = H + rafterDepth;

  // Deflection display: exaggerated in deflection mode, and always on for the ghost comparison.
  const showDeflection = viz === 'deflection' || preset === 'ghost';
  const mult = showDeflection ? exaggeration : 0;
  const sign = inputs.loadMode === 'gravity' ? -1 : 1; // gravity sags down, uplift lifts up

  const goals = useMemo(() => cameraGoals(inputs, rafterDepth), [inputs, rafterDepth]);
  const controlsRef = useRef<ControlsRef | null>(null);

  // ---- Rafters (both frames share the assignment) ----
  const makeRafter = (r: RafterResult, zc: number, base?: string) => {
    const path = Array.from({ length: RAFTER_STATIONS + 1 }, (_, i) => {
      const xf = i / RAFTER_STATIONS;
      const sag = (rafterSagMm(xf, r) / 1000) * mult * sign;
      return new THREE.Vector3((xf - 0.5) * L, H + r.section.depthMm / 2000 + sag, zc);
    });
    const colors = stationColors(RAFTER_STATIONS + 1, heatmap && !base, base ?? MEMBER_COLOR.rafter, (i) =>
      rafterMomentAt(i / RAFTER_STATIONS, r) / r.section.bend.Z / FY,
    );
    return buildTubeGeometry({
      path,
      sideRef: new THREE.Vector3(0, 0, 1),
      halfSide: r.section.widthMm / 2000,
      halfUp: r.section.depthMm / 2000,
      colors,
    });
  };

  const rafterFront = useMemo(() => makeRafter(rafter, zf), [rafter, zf, L, H, mult, sign, heatmap]); // eslint-disable-line react-hooks/exhaustive-deps
  const rafterBack = useMemo(() => makeRafter(rafter, -zf), [rafter, zf, L, H, mult, sign, heatmap]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ghost candidates (front rafter line): SHS and RHS on edge
  const ghostA = useMemo(() => analyseRafter(orientSection('SHS50', 'deep'), inputs), [inputs]);
  const ghostB = useMemo(() => analyseRafter(orientSection('RHS75', 'deep'), inputs), [inputs]);
  const ghostGeoA = useMemo(() => makeRafter(ghostA, zf, MEMBER_COLOR.ghostA), [ghostA, zf, L, H, mult, sign]); // eslint-disable-line react-hooks/exhaustive-deps
  const ghostGeoB = useMemo(() => makeRafter(ghostB, zf, MEMBER_COLOR.ghostB), [ghostB, zf, L, H, mult, sign]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Uprights (four columns) ----
  const uprightGeos = useMemo(() => {
    const amp = Math.min(upright.bucklingMidMm, 0.25 * upright.heightMm);
    return [-L / 2, L / 2].flatMap((xc) =>
      [-zf, zf].map((zc) => {
        const path: THREE.Vector3[] = [];
        for (let i = 0; i <= COLUMN_STATIONS; i++) {
          const f = i / COLUMN_STATIONS;
          let dx = 0;
          let dz = 0;
          if (mult > 0) {
            if (inputs.loadMode === 'wind') {
              dx = (swayAt(f, upright) / 1000) * mult;
            } else if (Number.isFinite(amp)) {
              const off = (amp / 1000) * Math.sin(Math.PI * f) * mult;
              if (upright.govAxis === 'in') dx = off;
              else dz = off;
            }
          }
          path.push(new THREE.Vector3(xc + dx, f * H, zc + dz));
        }
        const colors = stationColors(COLUMN_STATIONS + 1, heatmap, MEMBER_COLOR.upright, (i) =>
          uprightStressAt(i / COLUMN_STATIONS, upright) / FY,
        );
        return buildTubeGeometry({
          path,
          sideRef: new THREE.Vector3(1, 0, 0),
          halfSide: upright.section.depthMm / 2000,
          halfUp: upright.section.widthMm / 2000,
          colors,
        });
      }),
    );
  }, [upright, L, H, zf, mult, heatmap, inputs.loadMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Base rails: four perimeter ties at slab level ----
  const railYc = 0.1 + rail.section.depthMm / 2000;
  const railGeos = useMemo(() => {
    const tie = (path: THREE.Vector3[], sideRef: THREE.Vector3, colors: THREE.Color[]) =>
      buildTubeGeometry({
        path,
        sideRef,
        halfSide: rail.section.widthMm / 2000,
        halfUp: rail.section.depthMm / 2000,
        colors,
      });
    const base = MEMBER_COLOR.rail;
    const alongX = [-zf, zf].map((zc) => {
      const path = [new THREE.Vector3(-L / 2, railYc, zc), new THREE.Vector3(L / 2, railYc, zc)];
      return tie(path, new THREE.Vector3(0, 0, 1), stationColors(2, false, base, () => 0));
    });
    const alongZ = [-L / 2, L / 2].map((xc) => {
      const path = [new THREE.Vector3(xc, railYc, -zf), new THREE.Vector3(xc, railYc, zf)];
      return tie(path, new THREE.Vector3(1, 0, 0), stationColors(2, false, base, () => 0));
    });
    return { alongX, alongZ };
  }, [rail.section, L, zf, railYc]);

  // Heatmap version of the front rail (the one whose point-load stress is analysed)
  const railStressGeo = useMemo(() => {
    const path = Array.from({ length: RAIL_STATIONS + 1 }, (_, i) => new THREE.Vector3(-L / 2 + (i / RAIL_STATIONS) * L, railYc, zf));
    const colors = stationColors(RAIL_STATIONS + 1, heatmap, MEMBER_COLOR.rail, (i) =>
      railMomentAt(i / RAIL_STATIONS, rail) / rail.section.bend.Z / FY,
    );
    return buildTubeGeometry({
      path,
      sideRef: new THREE.Vector3(0, 0, 1),
      halfSide: rail.section.widthMm / 2000,
      halfUp: rail.section.depthMm / 2000,
      colors,
    });
  }, [rail, L, zf, railYc, heatmap]);

  // ---- Bending moment diagram floating over the front rafter (stress mode) ----
  const bmd = useMemo(() => {
    const base = rafterTop + 0.22;
    const pts: Vec3[] = Array.from({ length: 41 }, (_, i) => {
      const xf = i / 40;
      return [(xf - 0.5) * L, base + (rafterMomentAt(xf, rafter) / rafter.M) * 0.34, zf];
    });
    return { pts, base, MkNm: rafter.M / 1e6 };
  }, [rafter, L, rafterTop, zf]);

  // ---- Purlins: excluded from comparison, muted, following the sagging rafter top ----
  const purlinCount = Math.max(3, Math.round(L / 0.9) + 1);
  const purlins = useMemo(
    () =>
      Array.from({ length: purlinCount }, (_, i) => {
        const xf = i / (purlinCount - 1);
        const sag = (rafterSagMm(xf, rafter) / 1000) * mult * sign;
        return { x: (xf - 0.5) * L, y: H + rafter.section.depthMm / 1000 + sag + 0.06 };
      }),
    [rafter, purlinCount, L, H, mult, sign],
  );

  const isSel = (k: MemberKey) => selected === k;
  const arrowLen = 0.28 * Math.min(1.5, Math.max(0.5, inputs.loadKpa));
  const dimY = rafterTop + 0.32;
  const dashed = { dashed: true, dashSize: 0.05, gapSize: 0.03, lineWidth: 1, color: '#67e8f9' };

  return (
    <>
      <CameraRig preset={preset} goals={goals} controlsRef={controlsRef} />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={0.6}
        maxDistance={40}
        target={[0, H * 0.5, 0]}
      />

      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#bae6fd', '#0f172a', 0.5]} />
      <directionalLight position={[5, 8, 5]} intensity={1.1} />
      <directionalLight position={[-6, 4, -3]} intensity={0.3} color="#67e8f9" />
      <gridHelper args={[40, 40, '#0e7490', '#1e293b']} position={[0, -0.101, 0]} />

      {/* Concrete slab and base plates */}
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[L + 1.6, 0.1, B + 1.6]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} />
      </mesh>
      {[-L / 2, L / 2].flatMap((xc) =>
        [-zf, zf].map((zc) => (
          <mesh key={`bp-${xc}-${zc}`} position={[xc, 0.006, zc]}>
            <boxGeometry args={[0.16, 0.012, 0.16]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.35} />
          </mesh>
        )),
      )}

      {/* Uprights */}
      {uprightGeos.map((geo, i) => (
        <Member key={`up-${i}`} geometry={geo} selected={isSel('upright')} onSelect={() => onSelect('upright')} />
      ))}

      {/* Base rails */}
      {railGeos.alongX.map((geo, i) =>
        i === 1 && heatmap ? (
          <Member key="rail-front" geometry={railStressGeo} selected={isSel('rail')} onSelect={() => onSelect('rail')} />
        ) : (
          <Member key={`rail-x-${i}`} geometry={geo} selected={isSel('rail')} onSelect={() => onSelect('rail')} />
        ),
      )}
      {railGeos.alongZ.map((geo, i) => (
        <Member key={`rail-z-${i}`} geometry={geo} selected={isSel('rail')} onSelect={() => onSelect('rail')} />
      ))}

      {/* Rafters (hidden on the front frame while the ghost overlay is active) */}
      {preset !== 'ghost' && (
        <Member geometry={rafterFront} selected={isSel('rafter')} onSelect={() => onSelect('rafter')} />
      )}
      <Member geometry={rafterBack} selected={isSel('rafter')} onSelect={() => onSelect('rafter')} />

      {/* Ghost overlay: both candidate sections on the same front rafter line */}
      {preset === 'ghost' && (
        <>
          <Member geometry={ghostGeoA} selected={false} opacity={0.55} />
          <Member geometry={ghostGeoB} selected={false} opacity={0.55} />
          <Html
            position={[0, H + 0.4, zf + 0.25]}
            center
            style={{ pointerEvents: 'none' }}
          >
            <div className="whitespace-nowrap rounded border border-cyan-500/50 bg-slate-950/85 px-2 py-1 font-mono text-[11px] text-cyan-200">
              A · 50×50×2.0 SHS · δ {ghostA.deltaMm.toFixed(1)} mm
            </div>
          </Html>
          <Html position={[0, rafterTop + 0.5, zf + 0.25]} center style={{ pointerEvents: 'none' }}>
            <div className="whitespace-nowrap rounded border border-amber-500/50 bg-slate-950/85 px-2 py-1 font-mono text-[11px] text-amber-200">
              B · 75×50×1.6 RHS · δ {ghostB.deltaMm.toFixed(1)} mm
            </div>
          </Html>
        </>
      )}

      {/* Purlins (excluded from comparison) */}
      {purlins.map((p, i) => (
        <mesh key={`pl-${i}`} position={[p.x, p.y, 0]}>
          <boxGeometry args={[0.05, 0.09, B]} />
          <meshStandardMaterial color="#64748b" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      ))}

      {/* Dimensions */}
      <Line points={[[-L / 2, dimY, zf + 0.25], [L / 2, dimY, zf + 0.25]]} {...dashed} />
      <Line points={[[-L / 2 - 0.3, 0, zf + 0.25], [-L / 2 - 0.3, H, zf + 0.25]]} {...dashed} />
      <Line points={[[L / 2 + 0.3, H, -zf], [L / 2 + 0.3, H, zf]]} {...dashed} />
      <Label position={[0, dimY + 0.1, zf + 0.25]} className="text-cyan-200">L = {L.toFixed(2)} m</Label>
      <Label position={[-L / 2 - 0.3, H / 2, zf + 0.25]} className="text-cyan-200">H = {H.toFixed(2)} m</Label>
      <Label position={[L / 2 + 0.3, H + 0.12, 0]} className="text-cyan-200">s = {B.toFixed(2)} m</Label>

      {/* Loads */}
      {inputs.loadMode === 'gravity' &&
        [-zf, zf].flatMap((zc) =>
          Array.from({ length: 7 }, (_, i) => {
            const x = (i / 6 - 0.5) * L;
            return <Arrow key={`g-${zc}-${i}`} from={[x, rafterTop + arrowLen, zc]} to={[x, rafterTop + 0.02, zc]} color="#fbbf24" />;
          }),
        )}
      {inputs.loadMode === 'wind' &&
        [-zf, zf].flatMap((zc) =>
          Array.from({ length: 7 }, (_, i) => {
            const x = (i / 6 - 0.5) * L;
            return <Arrow key={`u-${zc}-${i}`} from={[x, rafterTop + 0.15, zc]} to={[x, rafterTop + 0.15 + arrowLen, zc]} color="#fb7185" />;
          }),
        )}
      {inputs.loadMode === 'wind' &&
        [0.3, 0.6, 0.9].map((f) => (
          <Arrow key={`w-${f}`} from={[-L / 2 - 0.75, H * f, zf]} to={[-L / 2 - 0.12, H * f, zf]} color="#fb7185" />
        ))}

      {/* BMD */}
      {heatmap && (selected === null || selected === 'rafter') && (
        <>
          <Line points={[[-L / 2, bmd.base, zf], [L / 2, bmd.base, zf]]} color="#64748b" lineWidth={1} dashed dashSize={0.04} gapSize={0.03} />
          <Line points={bmd.pts} color="#f472b6" lineWidth={2.5} />
          <Label position={[0, bmd.base + 0.4, zf]} className="border border-pink-400/50 text-pink-200">
            BMD · M<sub>max</sub> = {bmd.MkNm.toFixed(3)} kN·m
          </Label>
        </>
      )}
      {heatmap && (
        <Label position={[-L / 2, 0.45, -zf]} className="text-slate-300">
          upright base σ = {uprightStressAt(0, upright).toFixed(0)} MPa
        </Label>
      )}
    </>
  );
}

const VIZ_OPTIONS: { id: VizMode; label: string; icon: ReactNode }[] = [
  { id: 'realistic', label: 'Realistic frame', icon: <Box size={14} /> },
  { id: 'deflection', label: 'Deflection & buckling', icon: <Waves size={14} /> },
  { id: 'stress', label: 'Stress & BMD', icon: <Flame size={14} /> },
];

const PRESET_OPTIONS: { id: CameraPreset; label: string; icon: ReactNode }[] = [
  { id: 'full', label: 'Full carport', icon: <Maximize size={14} /> },
  { id: 'mid', label: 'Rafter mid-span', icon: <Ruler size={14} /> },
  { id: 'column', label: 'Column & base plate', icon: <Layers size={14} /> },
  { id: 'ghost', label: 'Ghost overlay', icon: <Layers size={14} /> },
];

function selectedLabel(k: MemberKey | null): string {
  switch (k) {
    case 'rafter':
      return 'Rafters';
    case 'upright':
      return 'Uprights';
    case 'rail':
      return 'Base rails';
    case 'purlin':
      return 'Purlins (excluded)';
    default:
      return 'none — click a member';
  }
}

export function CarportScene3D(props: CarportScene3DProps) {
  const { analysis, viz, onVizChange, preset, onPresetChange, exaggeration, selected, onSelect, inputs, assignment } = props;
  const rafter = analysis.rafter;
  const rafterColor = SECTION_COLORS[assignment.rafters.section];

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 blueprint-grid">
      <Canvas
        camera={{ position: [6, 4, 7], fov: 36 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        onPointerMissed={() => onSelect(null)}
      >
        <CarportModel {...props} />
      </Canvas>

      <div className="absolute left-3 top-3 max-w-[calc(100%-1.5rem)] space-y-2">
        <div className="flex flex-wrap gap-1 rounded-lg border border-slate-700 bg-slate-950/90 p-1 backdrop-blur">
          {VIZ_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onVizChange(o.id)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition ${
                viz === o.id ? 'bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/60' : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {o.icon}
              {o.label}
            </button>
          ))}
        </div>
        <div className="max-w-xs rounded-md border border-slate-800 bg-slate-950/85 px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-slate-400 backdrop-blur">
          {viz === 'realistic' && 'True proportions. Click a member to inspect it.'}
          {viz === 'deflection' &&
            `Exaggerated ${exaggeration}×. Rafter sag δ = 5wL⁴/384EI; uprights ${
              inputs.loadMode === 'wind' ? 'sway under wind' : 'bow at Euler buckling'
            }.`}
          {viz === 'stress' && `Heatmap: blue → green → yellow → red at f_y = ${FY} MPa.`}
        </div>
      </div>

      <div className="absolute right-3 top-3 flex max-w-[calc(100%-1.5rem)] flex-wrap justify-end gap-1 rounded-lg border border-slate-700 bg-slate-950/90 p-1 backdrop-blur">
        {PRESET_OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onPresetChange(o.id)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition ${
              preset === o.id ? 'bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/60' : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            {o.icon}
            {o.label}
          </button>
        ))}
      </div>

      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-md border border-dashed border-slate-600 bg-slate-950/85 px-2.5 py-1.5 text-[11px] text-slate-400 backdrop-blur">
        <span className="h-2 w-2 rounded-full bg-slate-500" />
        Purlins — Excluded from comparison (separate cold-formed section)
      </div>

      <div className="absolute bottom-3 right-3 space-y-1 rounded-md border border-slate-800 bg-slate-950/90 px-3 py-2 font-mono text-[11px] text-slate-300 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500">Rafter</span>
          <span style={{ color: rafterColor }}>{rafter.section.def.name}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500">
            <Term id="deflection">δ</Term> / <Term id="span-limit">L/250</Term>
          </span>
          <span className={rafter.deflectionUtil <= 1 ? 'text-emerald-300' : 'text-rose-300'}>
            {rafter.deltaMm.toFixed(1)} / {rafter.limitMm.toFixed(1)} mm
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500">Selected</span>
          <span className="text-cyan-200">{selectedLabel(selected)}</span>
        </div>
      </div>
    </div>
  );
}
