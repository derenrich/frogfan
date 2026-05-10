export interface Point2D {
  u: number;
  v: number;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface CameraView {
  u: number;
  v: number;
  coefs: number[];
}

function solve2x2(a: number, b: number, e: number, c: number, d: number, f: number) {
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-10) return null;
  return {
    x: (e * d - b * f) / det,
    y: (a * f - e * c) / det
  };
}

export function project3DTo2D(coefs: number[], x: number, y: number, z: number): Point2D {
  const denom = coefs[8] * x + coefs[9] * y + coefs[10] * z + 1;
  return {
    u: (coefs[0] * x + coefs[1] * y + coefs[2] * z + coefs[3]) / denom,
    v: (coefs[4] * x + coefs[5] * y + coefs[6] * z + coefs[7]) / denom
  };
}

export function getEpipolarLine(sourceCoefs: number[], targetCoefs: number[], sourceU: number, sourceV: number): { start: Point2D, end: Point2D } | null {
  const L = sourceCoefs;
  const u = sourceU;
  const v = sourceV;

  const a = L[0] - u * L[8];
  const b = L[1] - u * L[9];
  const c = L[4] - v * L[8];
  const d = L[5] - v * L[9];

  // Pick two arbitrary Z planes to define the ray
  const getRayPoint = (Z: number) => {
    const e = u * (L[10] * Z + 1) - L[2] * Z - L[3];
    const f = v * (L[10] * Z + 1) - L[6] * Z - L[7];
    const pt = solve2x2(a, b, e, c, d, f);
    if (!pt) return null;
    return { x: pt.x, y: pt.y, z: Z };
  };

  const p0 = getRayPoint(0);
  const p1 = getRayPoint(1);

  if (!p0 || !p1) return null;

  const start2D = project3DTo2D(targetCoefs, p0.x, p0.y, p0.z);
  const end2D = project3DTo2D(targetCoefs, p1.x, p1.y, p1.z);

  const dx = end2D.u - start2D.u;
  const dy = end2D.v - start2D.v;

  if (Math.abs(dx) < 1e-5 && Math.abs(dy) < 1e-5) return null;

  return {
    start: { u: start2D.u - dx * 10000, v: start2D.v - dy * 10000 },
    end: { u: end2D.u + dx * 10000, v: end2D.v + dy * 10000 }
  };
}

export function triangulate(cameras: CameraView[]): Point3D | null {
  const N = cameras.length;
  if (N < 2) return null;

  const A: number[][] = [];
  const B: number[] = [];

  for (const cam of cameras) {
    const { u, v, coefs: L } = cam;
    A.push([ L[0] - u*L[8], L[1] - u*L[9], L[2] - u*L[10] ]);
    B.push(u - L[3]);
    
    A.push([ L[4] - v*L[8], L[5] - v*L[9], L[6] - v*L[10] ]);
    B.push(v - L[7]);
  }

  // M = A^T * A  (3x3)
  const M = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];
  // V = A^T * B  (3x1)
  const V = [0, 0, 0];

  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let sum = 0;
      for (let k = 0; k < 2 * N; k++) {
        sum += A[k][i] * A[k][j];
      }
      M[i][j] = sum;
    }
    let sumV = 0;
    for (let k = 0; k < 2 * N; k++) {
      sumV += A[k][i] * B[k];
    }
    V[i] = sumV;
  }

  const detM = 
    M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
    M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
    M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);

  if (Math.abs(detM) < 1e-10) return null;

  const detX = 
    V[0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
    M[0][1] * (V[1] * M[2][2] - M[1][2] * V[2]) +
    M[0][2] * (V[1] * M[2][1] - M[1][1] * V[2]);

  const detY = 
    M[0][0] * (V[1] * M[2][2] - M[1][2] * V[2]) -
    V[0] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
    M[0][2] * (M[1][0] * V[2] - V[1] * M[2][0]);

  const detZ = 
    M[0][0] * (M[1][1] * V[2] - V[1] * M[2][1]) -
    M[0][1] * (M[1][0] * V[2] - V[1] * M[2][0]) +
    V[0] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);

  return {
    x: detX / detM,
    y: detY / detM,
    z: detZ / detM
  };
}
