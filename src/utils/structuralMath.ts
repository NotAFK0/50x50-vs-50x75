// Real-time screening calculations for the two hollow sections.
// Units: mm, N, MPa. Line loads are N/mm (numerically equal to kN/m).
// These are simplified, serviceability-focused screening checks, not a substitute for a
// full AS 4100 / AS/NZS 1170 design. Assumptions are listed beside each function.

import {
  DEFLECTION_DIVISOR,
  E_MOD,
  FY,
  PHI,
  SECTIONS,
  type AxisProps,
  type Orientation,
  type SectionDef,
  type SectionId,
} from '../data/steelSections';

/** Effective length factor for in-plane sway (portal column, free top). */
export const K_SWAY = 2.0;
/** Effective length factor for out-of-plane buckling (assumes girt / cladding restraint). */
export const K_BRACED = 1.0;
/** Imperfection factor for the AS 4100-style column curve (conservative choice for cold-formed hollow sections). */
export const IMPERFECTION_ALPHA = 0.49;
/** Indicative compact-section screening limit for flat walls, λp ≈ 1600/√fy. Confirm against AS 4100 classification. */
export const LOCAL_LIMIT = 1600 / Math.sqrt(FY);

export type LoadMode = 'gravity' | 'wind';
export type MemberKey = 'rafter' | 'upright' | 'rail' | 'purlin';

export interface CarportInputs {
  spanM: number; // rafter span between column centres, m
  heightM: number; // column height, m
  bayM: number; // frame (bay) spacing = rafter tributary width, m
  loadKpa: number; // applied pressure, kPa
  loadMode: LoadMode;
  railPointKn: number; // concentrated boot / anchor load on the base rail, kN
}

export interface MemberChoice {
  section: SectionId;
  orient: Orientation;
}

export interface Assignment {
  uprights: MemberChoice;
  rafters: MemberChoice;
  rails: MemberChoice;
}

export interface OrientedSection {
  def: SectionDef;
  orient: Orientation;
  area: number;
  massPerM: number;
  /** Properties about the axis that bending in the member's primary direction uses. */
  bend: AxisProps;
  /** Properties about the other axis. */
  other: AxisProps;
  /** Dimension in the bending plane (vertical for rafters and rails). */
  depthMm: number;
  /** Dimension perpendicular to the bending plane. */
  widthMm: number;
  t: number;
}

export function orientSection(id: SectionId, orient: Orientation): OrientedSection {
  const def = SECTIONS[id];
  const deep = orient === 'deep';
  return {
    def,
    orient,
    area: def.area,
    massPerM: def.massPerM,
    bend: deep ? def.bendDeep : def.bendWide,
    other: deep ? def.bendWide : def.bendDeep,
    depthMm: deep ? def.deep : def.wide,
    widthMm: deep ? def.wide : def.deep,
    t: def.t,
  };
}

/** Uniform line load from the applied pressure over the tributary width, N/mm. */
export function lineLoad(inputs: CarportInputs): number {
  return inputs.loadKpa * inputs.bayM; // kN/m² × m = kN/m = N/mm
}

// ---------------------------------------------------------------------------
// Rafter: simply supported, uniform load (assumption: pin-ended between column centres)
// ---------------------------------------------------------------------------

export interface RafterResult {
  section: OrientedSection;
  spanMm: number;
  w: number; // N/mm
  EI: number; // N·mm²
  M: number; // N·mm, peak mid-span moment
  sigma: number; // MPa, elastic peak stress
  stressUtil: number; // σ / fy
  phiMs: number; // N·mm, design moment capacity φ·fy·S
  capacityUtil: number; // M / φMs
  deltaMm: number; // mid-span deflection magnitude
  limitMm: number; // L / 250
  deflectionUtil: number; // δ / limit
  maxSpanServiceMm: number; // largest span meeting L/250
  maxSpanStrengthMm: number; // largest span meeting φMs
  massKg: number; // mass of one rafter
  pass: boolean;
}

export function analyseRafter(section: OrientedSection, inputs: CarportInputs): RafterResult {
  const L = inputs.spanM * 1000;
  const w = lineLoad(inputs);
  const EI = E_MOD * section.bend.I;
  const M = (w * L * L) / 8;
  const sigma = M / section.bend.Z;
  const phiMs = PHI * FY * section.bend.S;
  const deltaMm = (5 * w * L ** 4) / (384 * EI);
  const limitMm = L / DEFLECTION_DIVISOR;
  const maxSpanServiceMm = w > 0 ? Math.cbrt((384 * EI) / (DEFLECTION_DIVISOR * 5 * w)) : Infinity;
  const maxSpanStrengthMm = w > 0 ? Math.sqrt((8 * phiMs) / w) : Infinity;
  const capacityUtil = M / phiMs;
  const deflectionUtil = deltaMm / limitMm;
  return {
    section,
    spanMm: L,
    w,
    EI,
    M,
    sigma,
    stressUtil: sigma / FY,
    phiMs,
    capacityUtil,
    deltaMm,
    limitMm,
    deflectionUtil,
    maxSpanServiceMm,
    maxSpanStrengthMm,
    massKg: section.massPerM * inputs.spanM,
    pass: capacityUtil <= 1 && deflectionUtil <= 1,
  };
}

/** Mid-span-referenced sag magnitude at fraction xf of the span, mm (simply supported, uniform load). */
export function rafterSagMm(xf: number, r: RafterResult): number {
  const L = r.spanMm;
  const x = xf * L;
  return (r.w * x * (L ** 3 - 2 * L * x * x + x ** 3)) / (24 * r.EI);
}

/** Bending moment at fraction xf of the span, N·mm (magnitude). */
export function rafterMomentAt(xf: number, r: RafterResult): number {
  return (r.w * r.spanMm * xf * r.spanMm * (1 - xf)) / 2;
}

// ---------------------------------------------------------------------------
// Upright: cantilever column (fixed base, free top). Gravity = axial compression from
// the rafter reaction. Wind = uplift tension plus lateral cantilever bending.
// ---------------------------------------------------------------------------

export interface UprightResult {
  section: OrientedSection;
  heightMm: number;
  N: number; // N, + compression / − tension
  wLat: number; // N/mm lateral wind on the column
  Mbase: number; // N·mm base moment (wind only)
  axialStress: number;
  bendStress: number;
  stressUtil: number;
  Pin: number; // N, Euler load in the sway (in-plane) axis
  Pout: number; // N, Euler load out-of-plane
  Pcr: number; // N, governing Euler load
  govAxis: 'in' | 'out';
  lambdaN: number;
  alphaC: number;
  Nc: number; // N, design compression capacity
  compUtil: number;
  swayTopMm: number; // wind: top sway
  bucklingMidMm: number; // gravity: mid-height buckling amplitude (Infinity if N ≥ Pcr)
  util: number;
  pass: boolean;
}

export function analyseUpright(section: OrientedSection, inputs: CarportInputs): UprightResult {
  const h = inputs.heightM * 1000;
  const L = inputs.spanM * 1000;
  const w = lineLoad(inputs);
  const A = section.area;
  const reaction = (w * L) / 2; // each column carries one rafter end reaction
  const N = inputs.loadMode === 'gravity' ? reaction : -reaction;
  const wLat = inputs.loadMode === 'wind' ? (w / 2) : 0; // half the frame's lateral wind per column
  const Mbase = (wLat * h * h) / 2;

  const axialStress = Math.abs(N) / A;
  const bendStress = Mbase / section.bend.Z;
  const stressUtil = (axialStress + bendStress) / FY;

  const Pin = (Math.PI ** 2 * E_MOD * section.bend.I) / (K_SWAY * h) ** 2;
  const Pout = (Math.PI ** 2 * E_MOD * section.other.I) / (K_BRACED * h) ** 2;
  const govAxis: 'in' | 'out' = Pin <= Pout ? 'in' : 'out';
  const Pcr = Math.min(Pin, Pout);
  const Kgov = govAxis === 'in' ? K_SWAY : K_BRACED;
  const Igov = govAxis === 'in' ? section.bend.I : section.other.I;
  const rGov = Math.sqrt(Igov / A);

  const lambdaN = ((Kgov * h) / rGov / Math.PI) * Math.sqrt(FY / E_MOD);
  const eta = IMPERFECTION_ALPHA * (lambdaN - 0.2);
  const xi = 0.5 * (1 + eta + lambdaN * lambdaN);
  const alphaC = Math.min(1, 1 / (xi + Math.sqrt(Math.max(xi * xi - lambdaN * lambdaN, 0))));
  const Nc = PHI * alphaC * A * FY;
  const compUtil = N > 0 ? N / Nc : 0;

  const swayTopMm = inputs.loadMode === 'wind' ? (wLat * h ** 4) / (8 * E_MOD * section.bend.I) : 0;
  const ratio = N > 0 ? N / Pcr : 0;
  const bucklingMidMm = ratio >= 1 ? Infinity : ((h / 500) * ratio) / (1 - ratio);

  const util = Math.max(stressUtil, compUtil);
  return {
    section,
    heightMm: h,
    N,
    wLat,
    Mbase,
    axialStress,
    bendStress,
    stressUtil,
    Pin,
    Pout,
    Pcr,
    govAxis,
    lambdaN,
    alphaC,
    Nc,
    compUtil,
    swayTopMm,
    bucklingMidMm,
    util,
    pass: util <= 1,
  };
}

/** Lateral sway of the cantilever at fraction zf of the height, mm (uniform lateral load). */
export function swayAt(zf: number, r: UprightResult): number {
  const h = r.heightMm;
  const z = zf * h;
  const EI = E_MOD * r.section.bend.I;
  return (r.wLat * z * z * (6 * h * h - 4 * h * z + z * z)) / (24 * EI);
}

/** Axial + bending stress at fraction zf from the base, MPa (base is the most stressed point). */
export function uprightStressAt(zf: number, r: UprightResult): number {
  const h = r.heightMm;
  const M = (r.wLat * (h - zf * h) ** 2) / 2;
  return Math.abs(r.N) / r.section.area + M / r.section.bend.Z;
}

// ---------------------------------------------------------------------------
// Base rail: simply supported between column bases, concentrated load at mid-span
// ---------------------------------------------------------------------------

export interface RailResult {
  section: OrientedSection;
  spanMm: number;
  P: number; // N
  M: number; // N·mm
  sigma: number;
  stressUtil: number;
  phiMs: number;
  capacityUtil: number;
  deltaMm: number;
  limitMm: number;
  deflectionUtil: number;
  pass: boolean;
}

export function analyseRail(section: OrientedSection, inputs: CarportInputs): RailResult {
  const L = inputs.spanM * 1000;
  const P = inputs.railPointKn * 1000;
  const EI = E_MOD * section.bend.I;
  const M = (P * L) / 4;
  const sigma = M / section.bend.Z;
  const phiMs = PHI * FY * section.bend.S;
  const deltaMm = (P * L ** 3) / (48 * EI);
  const limitMm = L / DEFLECTION_DIVISOR;
  const capacityUtil = M / phiMs;
  const deflectionUtil = deltaMm / limitMm;
  return {
    section,
    spanMm: L,
    P,
    M,
    sigma,
    stressUtil: sigma / FY,
    phiMs,
    capacityUtil,
    deltaMm,
    limitMm,
    deflectionUtil,
    pass: capacityUtil <= 1 && deflectionUtil <= 1,
  };
}

/** Rail moment at fraction xf of the span, N·mm. */
export function railMomentAt(xf: number, r: RailResult): number {
  return (r.P / 2) * Math.min(xf, 1 - xf) * r.spanMm;
}

// ---------------------------------------------------------------------------
// Local wall slenderness (flat-width-to-thickness, b/t = (b − 4t)/t)
// ---------------------------------------------------------------------------

export interface LocalResult {
  deepFace: number;
  wideFace: number;
  governing: number;
  limit: number;
  margin: number; // limit / governing; > 1 means below the screening limit
}

export function localSlenderness(def: SectionDef): LocalResult {
  const t = def.t;
  const deepFace = (def.deep - 4 * t) / t;
  const wideFace = (def.wide - 4 * t) / t;
  const governing = Math.max(deepFace, wideFace);
  return {
    deepFace,
    wideFace,
    governing,
    limit: LOCAL_LIMIT,
    margin: LOCAL_LIMIT / governing,
  };
}

// ---------------------------------------------------------------------------
// Whole carport: all member results for one assignment
// ---------------------------------------------------------------------------

export interface CarportAnalysis {
  rafter: RafterResult;
  upright: UprightResult;
  rail: RailResult;
}

export function analyseCarport(inputs: CarportInputs, assignment: Assignment): CarportAnalysis {
  return {
    rafter: analyseRafter(orientSection(assignment.rafters.section, assignment.rafters.orient), inputs),
    upright: analyseUpright(orientSection(assignment.uprights.section, assignment.uprights.orient), inputs),
    rail: analyseRail(orientSection(assignment.rails.section, assignment.rails.orient), inputs),
  };
}

/** Utilisation colour ramp for the stress heatmap: blue → green → yellow → red at fy. */
export function utilisationRamp(u: number): [number, number, number] {
  const stops: Array<[number, [number, number, number]]> = [
    [0, [0.15, 0.39, 0.92]],
    [0.35, [0.06, 0.73, 0.51]],
    [0.7, [0.98, 0.8, 0.08]],
    [1, [0.94, 0.27, 0.27]],
  ];
  if (u <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [u1, c1] = stops[i];
    if (u <= u1) {
      const [u0, c0] = stops[i - 1];
      const k = (u - u0) / (u1 - u0);
      return [0, 1, 2].map((j) => c0[j] + (c1[j] - c0[j]) * k) as [number, number, number];
    }
  }
  return stops[stops.length - 1][1];
}
