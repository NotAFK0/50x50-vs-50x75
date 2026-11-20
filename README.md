# Carport hollow-section comparator

Interactive engineering visualiser comparing two AS/NZS 1163 Grade C350L0 hollow sections used in an outdoor carport / shelter:

1. **50 × 50 × 2.0 SHS** (square hollow section)
2. **75 × 50 × 1.6 RHS** (rectangular hollow section)

Built with React, TypeScript, Tailwind CSS v4, Three.js, `@react-three/fiber` and `@react-three/drei`.

## Run

```bash
npm install
npm run dev        # local dev server
npm run build      # tsc -b && vite build
npx tsc --noEmit -p tsconfig.app.json
npm run lint       # oxlint
```

## Layout

| Path | Purpose |
| --- | --- |
| `src/data/steelSections.ts` | Exact nominal section properties, material constants, engineering glossary, carport role verdict text |
| `src/utils/structuralMath.ts` | Rafter, upright and base-rail checks; Euler buckling; AS 4100-style column capacity; local b/t screening; deflection and moment shapes |
| `src/utils/geometry.ts` | Flat-shaded hollow tube geometry with per-station colour (for heatmaps) |
| `src/components/CarportScene3D.tsx` | 3D carport: realistic frame, exaggerated deflection and buckling, stress heatmap with floating BMD, load arrows, camera presets, ghost overlay |
| `src/components/CrossSection3D.tsx` | Extruded cross-section comparator: neutral axis, extreme-fibre distance, wall thickness, live bar charts |
| `src/components/ControlPanel.tsx` | Span / height / bay / load sliders, load-mode switch, per-member section and orientation |
| `src/components/InspectorPanel.tsx` | Three tabs: carport verdicts with live comparison tables, 3D cross-section, terms dictionary |
| `src/components/GlossaryDrawer.tsx` | Glossary provider, clickable `<Term>` links, slide-over drawer, searchable dictionary |

## Engineering model and assumptions

This is a **screening and comparison tool**, not a design calculator. Every check is a simplified, serviceability-focused approximation.

- **Section data** are the nominal values supplied for C350L0: f_y = 350 MPa, E = 200,000 MPa, ρ = 7,850 kg/m³.
- **Rafters** are simply supported between column centres with a uniform line load `w = p × s` (kPa × bay spacing). Deflection is `δ = 5wL⁴/384EI` and the serviceability limit is `L/250`. Maximum span at the limit is `L = ∛(384EI / 1250w)`. Bending capacity is `φ·f_y·S` with φ = 0.9.
- **Uprights** are cantilevers (fixed base, free top), which is conservative for wind. Gravity gives axial compression `N = wL/2` per column. Wind gives uplift tension plus lateral cantilever bending `M = w_lat·h²/2`.
- **Column buckling** uses K = 2.0 for in-plane sway and K = 1.0 for out-of-plane restraint. The governing Euler load is the smaller of the two. Design compression capacity uses an AS 4100-style column curve with imperfection factor α = 0.49, a conservative choice for cold-formed hollow sections. Confirm this against the standard before use.
- **Base rails** are simply supported between column bases under a concentrated boot or anchor load at mid-span.
- **Local wall slenderness** uses `b/t = (b − 4t)/t`, which reproduces the stated 21.0 (SHS) and 42.9 (RHS 75 mm face). It is compared with an indicative compact limit of `1600/√f_y`. Confirm this limit against the AS 4100 section classification tables.
- **Skillion roof** is modelled with level rafters; the pitch is not represented.
- **Purlins** are drawn muted and excluded from the comparison, as they are a separate cold-formed section.

A full design needs factored (ULS) loads, load combinations, connection design, and the code's own classification and member checks.
