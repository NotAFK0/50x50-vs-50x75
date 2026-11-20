// Exact nominal section data for AS/NZS 1163 Grade C350L0 cold-formed hollow sections.
// All lengths are mm, forces N, stresses MPa unless the name says otherwise.

export const FY = 350; // MPa, minimum yield strength (C350L0)
export const E_MOD = 200_000; // MPa, elastic modulus
export const STEEL_DENSITY = 7850; // kg/m³
export const PHI = 0.9; // strength reduction factor used for the screening checks
export const DEFLECTION_DIVISOR = 250; // serviceability limit: span / 250

export type SectionId = 'SHS50' | 'RHS75';
export type Orientation = 'deep' | 'wide';

export interface AxisProps {
  I: number; // second moment of area, mm⁴
  Z: number; // elastic section modulus, mm³
  S: number; // plastic section modulus, mm³
  r: number; // radius of gyration, mm
}

export interface SectionDef {
  id: SectionId;
  name: string;
  shape: 'SHS' | 'RHS';
  deep: number; // mm, the larger dimension (75 for the RHS, 50 for the SHS)
  wide: number; // mm, the smaller dimension
  t: number; // mm, wall thickness
  massPerM: number; // kg/m, nominal
  area: number; // mm²
  /** Properties when the 'deep' dimension is vertical (bending about x-x for the RHS). */
  bendDeep: AxisProps;
  /** Properties when the 'wide' dimension is vertical (bending about y-y for the RHS). */
  bendWide: AxisProps;
  /** Stated flat-wall width-to-thickness ratio, b/t. */
  statedWallRatio: number;
}

export const SECTIONS: Record<SectionId, SectionDef> = {
  SHS50: {
    id: 'SHS50',
    name: '50 × 50 × 2.0 SHS',
    shape: 'SHS',
    deep: 50,
    wide: 50,
    t: 2.0,
    massPerM: 2.93,
    area: 373,
    bendDeep: { I: 141_000, Z: 5_640, S: 6_660, r: 19.4 },
    bendWide: { I: 141_000, Z: 5_640, S: 6_660, r: 19.4 },
    statedWallRatio: 21.0,
  },
  RHS75: {
    id: 'RHS75',
    name: '75 × 50 × 1.6 RHS',
    shape: 'RHS',
    deep: 75,
    wide: 50,
    t: 1.6,
    massPerM: 2.97,
    area: 378,
    bendDeep: { I: 295_000, Z: 7_870, S: 9_350, r: 27.9 }, // major axis, 75 mm vertical / on edge
    bendWide: { I: 156_000, Z: 6_260, S: 7_160, r: 20.3 }, // minor axis, 50 mm vertical / laid flat
    statedWallRatio: 42.9,
  },
};

export const SECTION_IDS: SectionId[] = ['SHS50', 'RHS75'];

export const SECTION_COLORS: Record<SectionId, string> = {
  SHS50: '#22d3ee', // cyan
  RHS75: '#f59e0b', // amber
};

export const ORIENTATION_LABELS = {
  upright: { deep: '75 mm face in frame plane', wide: '75 mm face perpendicular' },
  rafter: { deep: 'On edge (75 mm vertical)', wide: 'Flat (50 mm vertical)' },
  rail: { deep: 'On edge (75 mm vertical)', wide: 'Flat (50 mm vertical)' },
} as const;

// ---------------------------------------------------------------------------
// Engineering glossary
// ---------------------------------------------------------------------------

export type GlossaryId =
  | 'bending-moment'
  | 'second-moment'
  | 'section-modulus'
  | 'plastic-modulus'
  | 'deflection'
  | 'span-limit'
  | 'radius-gyration'
  | 'slenderness'
  | 'euler-buckling'
  | 'local-buckling'
  | 'yield-strength'
  | 'elastic-modulus'
  | 'neutral-axis'
  | 'extreme-fibre'
  | 'utilisation'
  | 'effective-length'
  | 'tributary-width'
  | 'uplift'
  | 'purlin'
  | 'base-rail';

export interface GlossaryEntry {
  id: GlossaryId;
  term: string;
  symbol?: string;
  unit?: string;
  plain: string;
  technical: string;
  formula?: string;
  analogy: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    id: 'bending-moment',
    term: 'Bending moment',
    symbol: 'M',
    unit: 'kN·m',
    plain: 'The internal twisting force that tries to bow a beam. It is largest in the middle of a simply supported span.',
    technical: 'Internal moment at a section from the applied loads. For a uniform load w on a simply supported span L, the peak is at mid-span.',
    formula: 'M = wL² / 8',
    analogy: 'Like holding a broom at one end: the wood bends most where your grip is farthest from the weight.',
  },
  {
    id: 'second-moment',
    term: 'Second moment of area',
    symbol: 'I',
    unit: 'mm⁴',
    plain: 'How stiff a shape is against bending. Moving steel away from the centre boosts it dramatically.',
    technical: 'Geometric property of the cross-section. For a hollow rectangle, I = (bD³ − bᵢdᵢ³)/12, so the depth D is cubed.',
    formula: 'I = (bD³ − bᵢdᵢ³) / 12',
    analogy: 'A ruler stands up far stiffer on edge than flat. Depth is what matters, and it is cubed.',
  },
  {
    id: 'section-modulus',
    term: 'Elastic section modulus',
    symbol: 'Z',
    unit: 'mm³',
    plain: 'How much bending the steel can take before its outer fibres start to yield.',
    technical: 'Elastic bending strength of the section, Z = I / y_max, where y_max is the distance to the extreme fibre.',
    formula: 'Z = I / y_max',
    analogy: 'The strength of the rafter, as opposed to its stiffness (I).',
  },
  {
    id: 'plastic-modulus',
    term: 'Plastic section modulus',
    symbol: 'S',
    unit: 'mm³',
    plain: 'The bending capacity once the whole section has yielded, allowed only for compact sections.',
    technical: 'Full-plasticity bending capacity term. Mₚ = f_y · S for a compact section. S is always at least Z.',
    formula: 'Mₚ = f_y · S',
    analogy: 'Like the rafter reaching its last usable bend, rather than just the first sign of a bow.',
  },
  {
    id: 'deflection',
    term: 'Deflection',
    symbol: 'δ',
    unit: 'mm',
    plain: 'How far a beam physically sags (or lifts under uplift) under load.',
    technical: 'Mid-span deflection of a simply supported uniformly loaded beam. It depends on load, span⁴, E and I.',
    formula: 'δ = 5wL⁴ / (384 E I)',
    analogy: 'The sag you can see in a clothesline; sagging water can pond on a roof.',
  },
  {
    id: 'span-limit',
    term: 'Span / 250 limit',
    symbol: 'L/250',
    unit: 'mm',
    plain: 'A common serviceability rule of thumb: the sag should stay below span ÷ 250.',
    technical: 'Serviceability limit on deflection for roofs and shelters. Limits are set per design code and per owner requirement.',
    formula: 'δ_limit = L / 250',
    analogy: 'A 3 m rafter should not sag more than 12 mm, or water starts to pond.',
  },
  {
    id: 'radius-gyration',
    term: 'Radius of gyration',
    symbol: 'r',
    unit: 'mm',
    plain: 'An average "distance of steel from the centre". Bigger r means the column resists buckling better.',
    technical: 'Square root of I/A. Used with the effective length in the slenderness ratio KL/r.',
    formula: 'r = √(I / A)',
    analogy: 'The thickness of a pencil versus a broomstick: the broomstick resists bending over.',
  },
  {
    id: 'slenderness',
    term: 'Slenderness ratio',
    symbol: 'KL/r',
    unit: '—',
    plain: 'How tall and skinny a column is. High values buckle sideways before the steel crushes.',
    technical: 'Effective length KL divided by the governing radius of gyration. It controls the Euler and AS 4100 style column capacity.',
    formula: 'λ = KL / r',
    analogy: 'A tall, thin tent pole bends sideways long before it snaps.',
  },
  {
    id: 'euler-buckling',
    term: 'Euler buckling load',
    symbol: 'P_cr',
    unit: 'kN',
    plain: 'The axial load at which a slender column suddenly bows sideways. It is governed by the weakest axis.',
    technical: 'Elastic critical load for a pin-ended column with effective length KL. The weakest axis (smallest I) governs.',
    formula: 'P_cr = π² E I / (KL)²',
    analogy: 'Pressing down on a plastic ruler: it snaps sideways at a load far below what it could crush.',
  },
  {
    id: 'local-buckling',
    term: 'Local wall buckling (b/t)',
    symbol: 'b/t',
    unit: '—',
    plain: 'How wide a flat wall is compared with its thickness. Wide, thin walls can ripple or dent locally.',
    technical: 'Flat-width-to-thickness ratio of a hollow section wall, taken here as (b − 4t)/t. Compared against an indicative compact-section screening limit.',
    formula: 'b/t = (b − 4t) / t',
    analogy: 'A thin drink-can wall dents under a thumb; a thick one does not.',
  },
  {
    id: 'yield-strength',
    term: 'Yield strength',
    symbol: 'f_y',
    unit: 'MPa',
    plain: 'The stress at which C350 steel stops springing back and stays permanently bent.',
    technical: 'Minimum yield stress of C350L0 hollow sections, 350 MPa. Stress utilisation is measured against this value.',
    formula: 'f_y = 350 MPa',
    analogy: 'The point past which a paperclip will not return to straight.',
  },
  {
    id: 'elastic-modulus',
    term: 'Elastic modulus',
    symbol: 'E',
    unit: 'MPa',
    plain: 'How stiff the steel material is itself. Steel is about 200,000 MPa.',
    technical: 'Ratio of stress to elastic strain. The section stiffness is E·I.',
    formula: 'E = 200,000 MPa',
    analogy: 'The same length of rubber band stretches far more than steel does.',
  },
  {
    id: 'neutral-axis',
    term: 'Neutral axis',
    unit: '—',
    plain: 'The line through a beam\'s cross-section that does not stretch or squash when the beam bends.',
    technical: 'Locus of zero bending stress through the centroid of a symmetric section. Stress increases linearly with distance from it.',
    analogy: 'The middle of a sandwich: the outside faces carry the bending, the centre hardly does.',
  },
  {
    id: 'extreme-fibre',
    term: 'Extreme fibre distance',
    symbol: 'y',
    unit: 'mm',
    plain: 'How far the outermost steel sits from the neutral axis. Bigger y means more lever arm.',
    technical: 'Distance from the neutral axis to the most stressed fibre, equal to half the depth in the bending plane. It sets Z = I / y.',
    formula: 'y_max = d / 2',
    analogy: 'Pulling a rope from far out on a lever is easier than from close in.',
  },
  {
    id: 'utilisation',
    term: 'Utilisation',
    unit: '%',
    plain: 'How much of the member\'s capacity is used. Above 100% means it fails the check.',
    technical: 'Demand divided by capacity. Stress utilisation is σ / f_y; capacity utilisation is M / (φ f_y S).',
    formula: 'U = demand / capacity',
    analogy: 'A fuel gauge: 100% means the tank is full and you need a bigger one.',
  },
  {
    id: 'effective-length',
    term: 'Effective length factor',
    symbol: 'K',
    unit: '—',
    plain: 'How much a column\'s end restraint changes its buckling length. K = 2 is a free-top sway column.',
    technical: 'Multiplier applied to the physical length to get the buckling length KL. This model uses K = 2.0 for in-plane sway and K = 1.0 for out-of-plane restraint.',
    formula: 'L_eff = K · L',
    analogy: 'A pole with its top free to wobble behaves like one twice as long as a pole held at both ends.',
  },
  {
    id: 'tributary-width',
    term: 'Tributary width',
    unit: 'm',
    plain: 'The strip of roof whose load one rafter carries. Here it equals the bay spacing.',
    technical: 'Width of floor or roof area whose load is delivered to a member. For frames at spacing s, the line load is p · s.',
    formula: 'w = p · s  (kN/m)',
    analogy: 'Each carpenter carries the planks that sit above his own bench.',
  },
  {
    id: 'uplift',
    term: 'Wind uplift',
    unit: 'kPa',
    plain: 'Suction that lifts the roof. It reverses the bending in the rafter and puts the columns in tension.',
    technical: 'Upward pressure from wind on the roof. In this model its magnitude equals the gravity line load, acting upward.',
    analogy: 'An umbrella flipping inside out.',
  },
  {
    id: 'purlin',
    term: 'Purlin',
    unit: '—',
    plain: 'Light roof battens that span between rafters and carry the roof sheeting.',
    technical: 'Secondary roof members. Excluded from this comparison because they are a separate cold-formed section.',
    analogy: 'The slats of a bed base that hold up the mattress and rest on the bed frame.',
  },
  {
    id: 'base-rail',
    term: 'Base rail (sill tie)',
    unit: '—',
    plain: 'A horizontal tube at ground level that links the column bases, stopping them moving apart.',
    technical: 'Sill tie at slab level. In this model it is checked under a concentrated boot or anchor load at mid-span.',
    analogy: 'The bottom rung of a ladder that keeps the two stiles from splaying out.',
  },
];

export function getTerm(id: GlossaryId): GlossaryEntry | undefined {
  return GLOSSARY.find((entry) => entry.id === id);
}

// ---------------------------------------------------------------------------
// Carport role verdicts (static engineering narrative; live numbers are added in the UI)
// ---------------------------------------------------------------------------

export interface RoleVerdict {
  role: 'rafters' | 'uprights' | 'rails';
  title: string;
  headline: string;
  paragraphs: string[];
}

export const ROLE_VERDICTS: RoleVerdict[] = [
  {
    role: 'rafters',
    title: 'Rafters (main roof beams)',
    headline: '75 × 50 × 1.6 RHS on edge is the clear winner for span.',
    paragraphs: [
      'Bending stiffness scales with the cube of depth, so moving steel to 75 mm vertical lifts the second moment of area to roughly 2.1× the SHS for almost the same weight (2.97 vs 2.93 kg/m).',
      'The section modulus rises about 40% as well, so the rafter carries more bending moment before it yields. That is the difference between a roof that stays flat and one that sags and ponds water.',
      'Warning: laid flat (50 mm vertical) the RHS loses almost all of that advantage. Always install it on edge.',
    ],
  },
  {
    role: 'uprights',
    title: 'Uprights (columns)',
    headline: 'Columns fail by buckling along their weakest axis, not by crushing.',
    paragraphs: [
      '50 × 50 × 2.0 SHS has the same radius of gyration (r = 19.4 mm) in every direction, so buckling capacity does not depend on which way the wind pushes. Its 2.0 mm wall is also more forgiving for welded base plates and bracket bolts.',
      '75 × 50 × 1.6 RHS has r_x = 27.9 mm on its major axis and r_y = 20.3 mm on its minor axis. Placed with the 75 mm face in the portal frame plane, it resists wind sway strongly; the thinner 1.6 mm wall needs crush sleeves or washers under every bracket bolt.',
    ],
  },
  {
    role: 'rails',
    title: 'Base rails (sill ties)',
    headline: '50 × 50 × 2.0 SHS is usually preferred on the slab.',
    paragraphs: [
      'The thicker 2.0 mm wall resists denting from boots, tools and vehicles, and it can take dynabolt or anchor clamping forces without the wall crushing.',
      'It welds cleanly without blow-through, and a symmetric footprint sheds water and debris equally on every side.',
    ],
  },
];
