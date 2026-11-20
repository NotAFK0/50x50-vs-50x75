import * as THREE from 'three';

export interface TubeSpec {
  /** Centre-line stations in metres, in order. */
  path: THREE.Vector3[];
  /** Reference direction used to orient the section's "side" dimension. */
  sideRef: THREE.Vector3;
  /** Half-size along the side direction (m). */
  halfSide: number;
  /** Half-size along the up direction (m). */
  halfUp: number;
  /** Vertex colour per station (same length as path). */
  colors: THREE.Color[];
}

/**
 * Builds a flat-shaded hollow rectangular tube along a path, with one colour per station
 * so stress heatmaps can vary along the member.
 */
export function buildTubeGeometry(spec: TubeSpec): THREE.BufferGeometry {
  const { path, sideRef, halfSide, halfUp, colors } = spec;
  const n = path.length;
  const rings: THREE.Vector3[][] = [];

  for (let i = 0; i < n; i++) {
    const prev = path[Math.max(i - 1, 0)];
    const next = path[Math.min(i + 1, n - 1)];
    const t = next.clone().sub(prev).normalize();
    const s = sideRef.clone().sub(t.clone().multiplyScalar(sideRef.dot(t))).normalize();
    const u = new THREE.Vector3().crossVectors(t, s).normalize();
    const p = path[i];
    const hs = s.clone().multiplyScalar(halfSide);
    const hu = u.clone().multiplyScalar(halfUp);
    rings.push([
      p.clone().add(hs).add(hu),
      p.clone().add(hs).sub(hu),
      p.clone().sub(hs).sub(hu),
      p.clone().sub(hs).add(hu),
    ]);
  }

  const positions: number[] = [];
  const vertexColors: number[] = [];
  const pushVertex = (v: THREE.Vector3, c: THREE.Color) => {
    positions.push(v.x, v.y, v.z);
    vertexColors.push(c.r, c.g, c.b);
  };

  for (let i = 0; i < n - 1; i++) {
    const c0 = colors[i];
    const c1 = colors[i + 1];
    for (let k = 0; k < 4; k++) {
      const k1 = (k + 1) % 4;
      const a = rings[i][k];
      const b = rings[i][k1];
      const c = rings[i + 1][k1];
      const d = rings[i + 1][k];
      pushVertex(a, c0);
      pushVertex(b, c0);
      pushVertex(c, c1);
      pushVertex(a, c0);
      pushVertex(c, c1);
      pushVertex(d, c1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3));
  geometry.computeVertexNormals();
  return geometry;
}
