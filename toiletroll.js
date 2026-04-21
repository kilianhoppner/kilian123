/**
 * Procedural toilet paper roll — colours first, then TOILET_ROLL for geometry & materials.
 */
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// =============================================================================
// Colours (hex) — edit here
// =============================================================================
const COLORS = {
  paper: 0xe8e9ec,
  core: 0xAA9878,
  lightAmbient: 0xffffff,
  lightHemisphereSky: 0xffffff,
  /** Slightly cooler/darker ground for clearer underside vs lit top */
  lightHemisphereGround: 0x6e6e72,
  lightKey: 0xffffff,
  lightFill: 0xf2f4ff,
  lightRim: 0xfffcf5,
};

// =============================================================================
// Label typography (canvas → cylindrical band) — edit here
// =============================================================================
const LABEL_TYPE = {
  text: 'Up Your Ass',
  /** CSS font-weight, e.g. bold, 600, normal */
  weight: 'bold',
  sizePx: 110,
  family: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  /** Ink colour (hex) */
  color: 0x1e2328,
  /** How solid the print looks on the paper (0 = invisible, 1 = full) */
  opacity: 0.80,
  /** Soft edge on the glyphs (CSS px; 0 = sharp) */
  blurPx: 1.2,
  /** Canvas bitmap size: narrow u = around arc (keep wide enough for descenders + blur after rotation) */
  canvasWidth: 640,
  canvasHeight: 1024,
};

// =============================================================================
// Roll yaw oscillation — edit here (midpoint = face-on; see tick: baseYaw)
// =============================================================================
const ROTATION_OSC = {
  /** Max degrees left/right from the face-on rest pose */
  amplitudeDeg: 52,
  /** Seconds for one full sweep (one side → other → back) — larger = slower */
  periodSeconds: 8,
  /** Fine-tune the rest yaw in degrees (usually 0; auto base uses camera position) */
  centerOffsetDeg: 0,
};

// =============================================================================
// Label band on cylinder (3D placement) — edit here
// =============================================================================
const LABEL_BAND = {
  /** Arc length in radians around the tube */
  arcRadians: 1.38,
  /** Band height vs roll width */
  heightRatio: 0.72,
  /** Sits just outside paper to limit z-fighting */
  radialOffset: 0.0022,
  /** World-up shift so the print sits slightly higher on the roll (group local Y) */
  offsetY: 0.046,
};

// =============================================================================
// Paper end caps — stacked-layer rings (concentric bands on the flat annulus)
// =============================================================================
const PAPER_END_STACK_RINGS = {
  /** How many rings between the hole and the outer rim */
  count: 45,
  /** Stroke / band colour (hex) — typically darker than COLORS.paper */
  color: 0x9da4b0,
  /** 1 = opaque (stable when rotating). Below 1 enables transparency (may shimmer / sort badly) */
  opacity: 0.4,
  /** Vertices per ring (smoothness) */
  lineSegments: 96,
  /**
   * Stroke width: radial thickness of each ring band (world units).
   * Inner/outer radii are `centerRadius ± ringThickness/2`. Typical range ~0.0007–0.0022.
   */
  ringThickness: 0.0012,
  /** Offset along the end-cap normal (±X) so rings sit in front of the lid mesh */
  surfaceBias: 0.0028,
  /** Max radial deviation (world units). 0 = perfect circles; ~0.0012–0.0025 reads like imperfect cut paper */
  wobbleAmplitude: 0.00135,
  /** Fixes the wobble pattern per build (change for a different organic look) */
  wobbleSeed: 3.1416,
};

// =============================================================================
// Geometry, scale, texture strength (same for gallery tile + detail page)
// =============================================================================
const TOILET_ROLL = {
  outerRadius: 0.33,
  holeToOuterRatio: 0.32,
  /** Roll length along axis — one value so tile and detail match */
  rollWidth: 0.6,
  brownWall: 0.0045,
  curveSegments: 100,
  coreDepthScale: 1.002,

  rotationOsc: { ...ROTATION_OSC },

  /** Single scale for both gallery grid and detail (no compact/detail split) */
  modelScale: 1,

  paper: {
    roughness: 0.95,
    metalness: 0,
    /** Normal map XY strength (Z from texture); bump alone failed without tangents */
    normalScale: 0.85,
    /** See `PAPER_END_STACK_RINGS` at top of file */
    endStackRings: { ...PAPER_END_STACK_RINGS },
  },

  core: {
    roughness: 0.88,
    metalness: 0.04,
  },

  camera: {
    fov: 38,
    near: 0.05,
    far: 100,
    /** [x, y, z] — lower y = less top-down; a bit more z / less x = more frontal */
    position: [1.0, 0.58, 1.48],
  },

  renderer: {
    toneMappingExposure: 1.18,
    maxPixelRatio: 2,
  },

  texture: {
    bumpCanvasSize: 512,
    bumpRepeat: 7,
    roughnessCanvasSize: 256,
    roughnessRepeat: 5,
    /** Extra high-frequency grain on bump (0 = off) */
    bumpNoiseMix: 0.55,
    /** Extra variance on roughness map */
    roughnessNoiseMix: 0.65,
    /** Tiling for `paper-quilted.png` on the paper (UV repeat) */
    paperDiffuseRepeat: 4.5,
    /** Blend procedural normal with photo (lower when photo carries the emboss) */
    paperNormalScaleWithDiffuse: 0.42,
  },

  /** Curved band — typography: LABEL_TYPE; placement: LABEL_BAND */
  label: {
    ...LABEL_TYPE,
    font: `${LABEL_TYPE.weight} ${LABEL_TYPE.sizePx}px ${LABEL_TYPE.family}`,
    ...LABEL_BAND,
  },

  lights: {
    /** Balanced for relief; key vs fill sets contrast */
    ambient: { intensity: 0.38 },
    hemisphere: { intensity: 0.48 },
    key: { intensity: 1.45, position: [2.2, 4.2, 2.6] },
    fill: { intensity: 0.22, position: [-2.4, 0.4, -1.6] },
    rim: { intensity: 0.36, position: [0.5, -1.2, 2.8] },
  },
};

/** Photo albedo — `code/textures/paper-quilted.png` (quilted / scallop emboss) */
const PAPER_DIFFUSE_URL = new URL('./textures/paper-quilted.png', import.meta.url).href;

/**
 * ExtrudeGeometry stores lids + sides in separate `groups` (Three.js): group 0 = both flat ends
 * (“stacked” paper), group 1 = side walls only (outer + inner hole). Slice by vertex range.
 */
function extractExtrudeGroup(geometry, groupIndex) {
  const gr = geometry.groups[groupIndex];
  if (!gr) return null;
  const v0 = gr.start;
  const vCount = gr.count;
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const i0 = v0 * 3;
  const i1 = (v0 + vCount) * 3;
  const subPos = pos.array.slice(i0, i1);
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(subPos), 3));
  if (uv) {
    const j0 = v0 * 2;
    const j1 = (v0 + vCount) * 2;
    out.setAttribute('uv', new THREE.Float32BufferAttribute(uv.array.slice(j0, j1), 2));
  }
  out.computeVertexNormals();
  try {
    out.computeTangents();
  } catch {
    /* fine for plain */
  }
  return out;
}

/**
 * Side shell only (group 1): split outer cylindrical band (rh ~ outerR) vs inner hole wall (rh ~ innerR).
 */
function splitExtrudeSidesOuterInner(geometry, outerRadius, innerRadius) {
  const pos = geometry.attributes.position;
  const uvAttr = geometry.attributes.uv;
  const index = geometry.index;

  const outerPos = [];
  const outerUv = [];
  const innerPos = [];
  const innerUv = [];
  const outerMap = new Map();
  const innerMap = new Map();
  const outerIdx = [];
  const innerIdx = [];

  function emit(map, posBucket, uvBucket, oi) {
    let n = map.get(oi);
    if (n !== undefined) return n;
    n = posBucket.length / 3;
    posBucket.push(pos.getX(oi), pos.getY(oi), pos.getZ(oi));
    if (uvAttr) {
      uvBucket.push(uvAttr.getX(oi), uvAttr.getY(oi));
    }
    map.set(oi, n);
    return n;
  }

  function tri(ia, ib, ic) {
    const ax = pos.getX(ia);
    const ay = pos.getY(ia);
    const az = pos.getZ(ia);
    const bx = pos.getX(ib);
    const by = pos.getY(ib);
    const bz = pos.getZ(ib);
    const cx = pos.getX(ic);
    const cy = pos.getY(ic);
    const cz = pos.getZ(ic);
    const my = (ay + by + cy) / 3;
    const mz = (az + bz + cz) / 3;
    const e1x = bx - ax;
    const e1y = by - ay;
    const e1z = bz - az;
    const e2x = cx - ax;
    const e2y = cy - ay;
    const e2z = cz - az;
    let nx = e1y * e2z - e1z * e2y;
    let ny = e1z * e2x - e1x * e2z;
    let nz = e1x * e2y - e1y * e2x;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl;
    ny /= nl;
    nz /= nl;
    const rh = Math.hypot(my, mz);
    const radialYZ = Math.hypot(ny, nz);
    const tolO = Math.max(0.04, outerRadius * 0.08);
    const tolI = Math.max(0.04, innerRadius * 0.18);
    const wallLike = radialYZ > 0.72 && Math.abs(nx) < 0.52;
    const isOuterWall = wallLike && Math.abs(rh - outerRadius) < tolO;

    if (isOuterWall) {
      outerIdx.push(
        emit(outerMap, outerPos, outerUv, ia),
        emit(outerMap, outerPos, outerUv, ib),
        emit(outerMap, outerPos, outerUv, ic)
      );
    } else {
      innerIdx.push(
        emit(innerMap, innerPos, innerUv, ia),
        emit(innerMap, innerPos, innerUv, ib),
        emit(innerMap, innerPos, innerUv, ic)
      );
    }
  }

  if (index) {
    const arr = index.array;
    for (let t = 0; t < arr.length / 3; t++) {
      tri(arr[t * 3], arr[t * 3 + 1], arr[t * 3 + 2]);
    }
  } else {
    const n = pos.count;
    for (let i = 0; i < n; i += 3) {
      tri(i, i + 1, i + 2);
    }
  }

  if (outerIdx.length === 0) return null;

  function buildGeo(posBucket, uvBucket, idxArr) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(posBucket), 3));
    const vCount = posBucket.length / 3;
    if (uvAttr && uvBucket.length === vCount * 2) {
      g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(uvBucket), 2));
    }
    g.setIndex(idxArr);
    g.computeVertexNormals();
    try {
      g.computeTangents();
    } catch {
      /* ok */
    }
    return g;
  }

  const outerGeo = buildGeo(outerPos, outerUv, outerIdx);
  const innerGeo = buildGeo(innerPos, innerUv, innerIdx);
  return { outerGeo, innerGeo };
}

/**
 * ExtrudeGeometry side UVs tile per segment + texture repeat → visible stripes.
 * Axis X = tube length (after rotateY+center); YZ = cross-section. One u wrap around, v along length.
 */
function applyCylindricalPaperUVs(geometry) {
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  if (!pos || !uv) return;

  let xMin = Infinity;
  let xMax = -Infinity;
  const n = pos.count;
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i);
    if (x < xMin) xMin = x;
    if (x > xMax) xMax = x;
  }
  const xSpan = Math.max(xMax - xMin, 1e-6);
  const twoPi = Math.PI * 2;

  for (let i = 0; i < n; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const u = (Math.atan2(z, y) + Math.PI) / twoPi;
    const v = (x - xMin) / xSpan;
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
}

/** Radial offset for imperfect stacked-paper rings (stable, deterministic per θ) */
function paperRingRadialWobble(theta, ringIndex, wobbleSeed, amplitude) {
  if (amplitude <= 0) return 0;
  const r = ringIndex * 17.413 + wobbleSeed;
  return (
    amplitude *
    (0.4 * Math.sin(theta * 6 + r) +
      0.28 * Math.sin(theta * 13 + r * 1.91) +
      0.18 * Math.sin(theta * 21 + r * 0.73) +
      0.14 * Math.sin(theta * 29 + Math.sin(theta * 4 + r)))
  );
}

/** Slight thickness variation so inner/outer aren’t identical wobbles */
function paperRingThicknessWobble(theta, ringIndex, wobbleSeed, amplitude) {
  if (amplitude <= 0) return 0;
  return (
    amplitude * 0.2 * Math.sin(theta * 11 + ringIndex * 5.17 + wobbleSeed * 2.2)
  );
}

/**
 * Annulus in the YZ plane (x = 0 local). Organic edge vs perfect RingGeometry.
 */
function createImperfectRingGeometry(
  riBase,
  roBase,
  segments,
  ringIndex,
  innerLimit,
  outerLimit,
  wobbleAmp,
  wobbleSeed
) {
  const positions = [];
  const indices = [];
  const clampR = (rad) =>
    THREE.MathUtils.clamp(rad, innerLimit + 1e-6, outerLimit - 1e-6);

  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const d = paperRingRadialWobble(theta, ringIndex, wobbleSeed, wobbleAmp);
    const dThick = paperRingThicknessWobble(theta, ringIndex, wobbleSeed, wobbleAmp);
    let rin = clampR(riBase + d);
    let rout = clampR(roBase + d + dThick);
    if (rout - rin < 1e-6) rout = Math.min(rin + 1e-5, outerLimit - 1e-6);

    const ci = Math.cos(theta);
    const si = Math.sin(theta);
    positions.push(0, rin * ci, rin * si, 0, rout * ci, rout * si);
  }

  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = (i + 1) * 2;
    const d = (i + 1) * 2 + 1;
    indices.push(a, b, c, b, d, c);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Mesh UV: u = once around (0–1), v = along axis (0–1). Uniform repeat (d,d) stretches non-square
 * developments; scale U so world arc per repeat matches world length per repeat → tiles ~square, seams hidden.
 */
function setTubePaperTextureRepeat(texture, outerRadius, rollWidth, density) {
  const circumference = 2 * Math.PI * outerRadius;
  const W = Math.max(rollWidth, 1e-6);
  texture.repeat.set(density * (circumference / W), density);
}

function hashNoise(x, y) {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function sampleHeight(x, y, mix) {
  const mid = 128;
  let v = mid;
  v += (Math.sin(x * 0.45) + Math.sin(y * 0.45)) * 4;
  v += Math.sin(x * 0.08 + y * 0.08) * 6;
  v += Math.sin(x * 0.31) * Math.cos(y * 0.29) * 3;
  v += Math.sin((x + y) * 0.21) * 4;
  v += (Math.sin(x * 17.1 + y * 13.7) * 0.5 + 0.5) * 14;
  v += hashNoise(x * 0.1, y * 0.1) * 18 * mix;
  v += hashNoise(x * 0.4 + 13, y * 0.4 + 7) * 10 * mix;
  const dx = (x % 32) - 16;
  const dy = (y % 32) - 16;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 5) v -= (5 - dist) * 2.5;
  return THREE.MathUtils.clamp(v, 88, 168) / 255;
}

/** Height field → tangent-space normal map (needs MikkTSpace / tangents on geometry). */
function createPaperNormalMapFromHeight(cfg) {
  const size = cfg.texture.bumpCanvasSize;
  const mix = cfg.texture.bumpNoiseMix;
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      h[y * size + x] = sampleHeight(x, y, mix);
    }
  }
  const strength = 8;
  const img = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const xm = Math.max(0, x - 1);
      const xp = Math.min(size - 1, x + 1);
      const ym = Math.max(0, y - 1);
      const yp = Math.min(size - 1, y + 1);
      const hL = h[y * size + xm];
      const hR = h[y * size + xp];
      const hD = h[ym * size + x];
      const hU = h[yp * size + x];
      const dhdx = (hR - hL) * 0.5 * strength;
      const dhdy = (hU - hD) * 0.5 * strength;
      const nx = -dhdx;
      const ny = -dhdy;
      const nz = 1;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      const nxN = nx / len;
      const nyN = ny / len;
      const nzN = nz / len;
      img[i] = Math.floor(THREE.MathUtils.clamp(nxN * 0.5 + 0.5, 0, 1) * 255);
      img[i + 1] = Math.floor(THREE.MathUtils.clamp(nyN * 0.5 + 0.5, 0, 1) * 255);
      img[i + 2] = Math.floor(THREE.MathUtils.clamp(nzN * 0.5 + 0.5, 0, 1) * 255);
      img[i + 3] = 255;
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  canvas.getContext('2d').putImageData(new ImageData(img, size, size), 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.flipY = false;
  const r = cfg.texture.bumpRepeat;
  tex.repeat.set(r, r);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/** Subtle albedo variation — visible even when tangents/normalMap are weak on ExtrudeGeometry */
function createPaperAlbedoMap(cfg) {
  const size = 256;
  const mix = cfg.texture.bumpNoiseMix;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let t = sampleHeight(x * 2, y * 2, mix);
      t = 0.92 + t * 0.08;
      const v = Math.floor(THREE.MathUtils.clamp(t, 0, 1) * 255);
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const r = cfg.texture.bumpRepeat;
  tex.repeat.set(r, r);
  tex.anisotropy = 8;
  return tex;
}

function createRoughnessVariationTexture(cfg) {
  const size = cfg.texture.roughnessCanvasSize;
  const mix = cfg.texture.roughnessNoiseMix;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let n = 0.82 + (Math.random() - 0.5) * 0.14;
      n += (hashNoise(x * 0.2, y * 0.2) - 0.5) * 0.2 * mix;
      n += (hashNoise(x * 0.7 + 2, y * 0.7 + 1) - 0.5) * 0.12 * mix;
      n = THREE.MathUtils.clamp(n, 0.55, 0.98);
      const v = Math.floor(n * 255);
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const r = cfg.texture.roughnessRepeat;
  tex.repeat.set(r, r);
  return tex;
}

/**
 * Concentric rings on roll end caps (YZ). Thin RingGeometry meshes; **opaque** so transparency sorting
 * and z-fighting don’t shimmer while the roll rotates. (Dense rings + rotation ≈ moiré — keep `count` modest.)
 */
function createPaperEndStackRingLines(lidGeometry, outerRadius, innerRadius, stackCfg) {
  const count = stackCfg?.count ?? PAPER_END_STACK_RINGS.count;
  const color = stackCfg?.color ?? PAPER_END_STACK_RINGS.color;
  const opacity = stackCfg?.opacity ?? PAPER_END_STACK_RINGS.opacity;
  const roughness = stackCfg?.roughness ?? 0.92;
  const metalness = stackCfg?.metalness ?? 0;
  const lineSegments = stackCfg?.lineSegments ?? PAPER_END_STACK_RINGS.lineSegments;
  const surfaceBias = stackCfg?.surfaceBias ?? PAPER_END_STACK_RINGS.surfaceBias;
  const halfThick = (stackCfg?.ringThickness ?? PAPER_END_STACK_RINGS.ringThickness) * 0.5;
  const wobbleAmp = stackCfg?.wobbleAmplitude ?? PAPER_END_STACK_RINGS.wobbleAmplitude;
  const wobbleSeedBase = stackCfg?.wobbleSeed ?? PAPER_END_STACK_RINGS.wobbleSeed;

  const pos = lidGeometry.attributes.position;
  let minX = Infinity;
  let maxX = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
  }
  const xMid = (minX + maxX) * 0.5;
  const xPlanes =
    Math.abs(maxX - minX) < 1e-5 ? [minX] : [minX, maxX];

  const band = Math.max(outerRadius - innerRadius, 1e-6);
  const step = band / (count + 1);
  const radii = [];
  for (let i = 1; i <= count; i++) {
    const r = innerRadius + i * step;
    if (r < innerRadius + 1e-4 || r > outerRadius - 1e-4) continue;
    radii.push(r);
  }

  /** Match the lid’s shaded look — `MeshBasicMaterial` looked near-white vs lit `plainPaperMat` */
  const ringMat = new THREE.MeshPhysicalMaterial({
    color,
    roughness,
    metalness,
    transparent: opacity < 1,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: opacity >= 1,
    depthTest: true,
  });

  const group = new THREE.Group();
  const useWobble = wobbleAmp > 1e-8;

  xPlanes.forEach((x0, planeIdx) => {
    const outward = x0 < xMid ? -surfaceBias : surfaceBias;
    const xPos = x0 + outward;
    const planeSeed = wobbleSeedBase + planeIdx * 6.28318;

    radii.forEach((r, riIdx) => {
      let ri = r - halfThick;
      let ro = r + halfThick;
      ri = Math.max(ri, innerRadius + 1e-5);
      ro = Math.min(ro, outerRadius - 1e-5);
      if (ri >= ro - 1e-6) return;

      let geom;
      if (useWobble) {
        geom = createImperfectRingGeometry(
          ri,
          ro,
          lineSegments,
          riIdx + 1 + planeIdx * 32,
          innerRadius,
          outerRadius,
          wobbleAmp,
          planeSeed
        );
      } else {
        geom = new THREE.RingGeometry(ri, ro, lineSegments);
      }

      const mesh = new THREE.Mesh(geom, ringMat);
      /** Imperfect ring is built in YZ; classic RingGeometry is XY → rotate to YZ */
      if (!useWobble) mesh.rotation.y = Math.PI / 2;
      mesh.position.set(xPos, 0, 0);
      group.add(mesh);
    });
  });

  return {
    group,
    dispose() {
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
      ringMat.dispose();
    },
  };
}

function createPaperLabelTexture(cfg) {
  const lb = cfg.label;
  const {
    text,
    font,
    color,
    canvasWidth: w,
    canvasHeight: h,
    blurPx = 0,
  } = lb;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  ctx.font = font;
  ctx.textAlign = 'center';
  const m = ctx.measureText(text);
  const fs = Number(/(\d+)px/.exec(font)?.[1]) || 40;
  const ascent = m.actualBoundingBoxAscent ?? fs * 0.72;
  const descent = m.actualBoundingBoxDescent ?? fs * 0.28;
  /** Alphabetic baseline + vertical centering so descenders (e.g. “p”) aren’t clipped vs “middle” */
  ctx.textBaseline = 'alphabetic';
  const baselineY = (ascent - descent) / 2;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(Math.PI / 2);
  if (blurPx > 0) {
    ctx.filter = `blur(${blurPx}px)`;
  }
  ctx.fillText(text, 0, baselineY);
  ctx.restore();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  tex.premultiplyAlpha = false;
  tex.needsUpdate = true;
  return tex;
}

export function initToiletRoll(container) {
  const cfg = TOILET_ROLL;

  const outerR = cfg.outerRadius;
  const innerR = outerR * cfg.holeToOuterRatio;
  const width = cfg.rollWidth;
  const brownWall = cfg.brownWall;
  const curveSeg = cfg.curveSegments;

  const scene = new THREE.Scene();
  const cam = cfg.camera;
  const camera = new THREE.PerspectiveCamera(cam.fov, 1, cam.near, cam.far);
  camera.position.set(cam.position[0], cam.position[1], cam.position[2]);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = cfg.renderer.toneMappingExposure;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, cfg.renderer.maxPixelRatio));

  const group = new THREE.Group();

  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerR, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerR, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  const paperGeo = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: false,
    curveSegments: curveSeg,
  });
  paperGeo.rotateY(Math.PI / 2);
  paperGeo.center();

  try {
    paperGeo.computeTangents();
  } catch {
    /* normalMap needs tangents; albedo map still shows grain */
  }

  const normalMap = createPaperNormalMapFromHeight(cfg);
  const roughnessMap = createRoughnessVariationTexture(cfg);
  const albedoMap = createPaperAlbedoMap(cfg);

  const p = cfg.paper;
  const texCfg = cfg.texture;
  const paperNormalScaleVec = new THREE.Vector2(p.normalScale, p.normalScale);
  /** Cylindrical UV + anisotropic repeat ≈ uniform world scale (avoids 1×1 stretch) while keeping smooth U (no segment stripes) */
  setTubePaperTextureRepeat(normalMap, outerR, width, texCfg.bumpRepeat);
  setTubePaperTextureRepeat(roughnessMap, outerR, width, texCfg.roughnessRepeat);
  setTubePaperTextureRepeat(albedoMap, outerR, width, texCfg.paperDiffuseRepeat);

  const paperMat = new THREE.MeshPhysicalMaterial({
    color: COLORS.paper,
    map: albedoMap,
    roughness: p.roughness,
    metalness: p.metalness,
    side: THREE.DoubleSide,
    normalMap,
    normalScale: paperNormalScaleVec,
    roughnessMap,
  });

  /** Procedural canvas until `paper-quilted.png` finishes loading */
  let paperDiffuseDisposable = albedoMap;
  let sceneDisposed = false;
  new THREE.TextureLoader().load(
    PAPER_DIFFUSE_URL,
    (paperTex) => {
      if (sceneDisposed) {
        paperTex.dispose();
        return;
      }
      paperTex.colorSpace = THREE.SRGBColorSpace;
      paperTex.wrapS = paperTex.wrapT = THREE.RepeatWrapping;
      paperTex.repeat.set(1, 1);
      paperTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      paperDiffuseDisposable.dispose();
      paperDiffuseDisposable = paperTex;
      paperMat.map = paperTex;
      paperMat.color.setHex(0xffffff);
      paperNormalScaleVec.setScalar(texCfg.paperNormalScaleWithDiffuse);
    },
    undefined,
    () => {
      /* keep procedural albedo if file missing or CORS */
    }
  );

  /** ExtrudeGeometry.groups: 0 = both flat ends (stacked paper), 1 = side walls (outer + hole). */
  const paperGeosToDispose = [];
  let plainPaperMat = null;
  let paperEndRingsDispose = null;
  if (paperGeo.groups && paperGeo.groups.length >= 2) {
    plainPaperMat = new THREE.MeshPhysicalMaterial({
      color: COLORS.paper,
      roughness: p.roughness,
      metalness: p.metalness,
      side: THREE.DoubleSide,
    });
    const lidGeo = extractExtrudeGroup(paperGeo, 0);
    let sideGeo = extractExtrudeGroup(paperGeo, 1);
    paperGeo.dispose();

    group.add(new THREE.Mesh(lidGeo, plainPaperMat));
    paperGeosToDispose.push(lidGeo);

    const endRings = createPaperEndStackRingLines(lidGeo, outerR, innerR, {
      ...p.endStackRings,
      roughness: p.roughness,
      metalness: p.metalness,
    });
    group.add(endRings.group);
    paperEndRingsDispose = endRings.dispose;

    const sideSplit = splitExtrudeSidesOuterInner(sideGeo, outerR, innerR);
    if (sideSplit) {
      applyCylindricalPaperUVs(sideSplit.outerGeo);
      try {
        sideSplit.outerGeo.computeTangents();
      } catch {
        /* ok */
      }
      sideGeo.dispose();
      paperGeosToDispose.push(sideSplit.outerGeo, sideSplit.innerGeo);
      group.add(new THREE.Mesh(sideSplit.innerGeo, plainPaperMat));
      group.add(new THREE.Mesh(sideSplit.outerGeo, paperMat));
    } else {
      group.add(new THREE.Mesh(sideGeo, paperMat));
      paperGeosToDispose.push(sideGeo);
    }
  } else {
    group.add(new THREE.Mesh(paperGeo, paperMat));
    paperGeosToDispose.push(paperGeo);
  }

  const Lb = cfg.label;
  const labelR = outerR + Lb.radialOffset;
  const bandH = width * Lb.heightRatio;
  const arc = Lb.arcRadians;
  const labelMap = createPaperLabelTexture(cfg);
  const labelGeo = new THREE.CylinderGeometry(
    labelR,
    labelR,
    bandH,
    48,
    1,
    true,
    -arc / 2,
    arc
  );
  const labelMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: labelMap,
    roughness: p.roughness,
    metalness: p.metalness,
    transparent: true,
    opacity: Lb.opacity,
    /** Low threshold — higher values eat descenders / blur halos */
    alphaTest: 0.008,
    depthWrite: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const labelMesh = new THREE.Mesh(labelGeo, labelMat);
  labelMesh.rotation.z = Math.PI / 2;
  labelMesh.position.y = Lb.offsetY ?? 0;
  group.add(labelMesh);

  const coreOuterR = innerR;
  const coreInnerR = Math.max(0.02, innerR - brownWall);
  const coreShape = new THREE.Shape();
  coreShape.absarc(0, 0, coreOuterR, 0, Math.PI * 2, false);
  const coreHolePath = new THREE.Path();
  coreHolePath.absarc(0, 0, coreInnerR, 0, Math.PI * 2, true);
  coreShape.holes.push(coreHolePath);

  const coreGeo = new THREE.ExtrudeGeometry(coreShape, {
    depth: width * cfg.coreDepthScale,
    bevelEnabled: false,
    curveSegments: curveSeg,
  });
  coreGeo.rotateY(Math.PI / 2);
  coreGeo.center();
  const c = cfg.core;
  const coreMat = new THREE.MeshPhysicalMaterial({
    color: COLORS.core,
    roughness: c.roughness,
    metalness: c.metalness,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  group.add(core);

  scene.add(group);

  const L = cfg.lights;
  scene.add(new THREE.AmbientLight(COLORS.lightAmbient, L.ambient.intensity));
  scene.add(
    new THREE.HemisphereLight(
      COLORS.lightHemisphereSky,
      COLORS.lightHemisphereGround,
      L.hemisphere.intensity
    )
  );
  const key = new THREE.DirectionalLight(COLORS.lightKey, L.key.intensity);
  key.position.set(L.key.position[0], L.key.position[1], L.key.position[2]);
  scene.add(key);
  const fill = new THREE.DirectionalLight(COLORS.lightFill, L.fill.intensity);
  fill.position.set(L.fill.position[0], L.fill.position[1], L.fill.position[2]);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(COLORS.lightRim, L.rim.intensity);
  rim.position.set(L.rim.position[0], L.rim.position[1], L.rim.position[2]);
  scene.add(rim);

  group.scale.setScalar(cfg.modelScale);

  container.appendChild(renderer.domElement);

  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  const osc = cfg.rotationOsc;
  const oscAmp = THREE.MathUtils.degToRad(osc.amplitudeDeg);
  const oscOmega = (2 * Math.PI) / osc.periodSeconds;
  const oscT0 = performance.now();
  /** Align rest pose so the roll faces the camera when the wave is at its midpoint (sin = 0) */
  const baseYaw =
    Math.atan2(cam.position[0], cam.position[2]) +
    THREE.MathUtils.degToRad(osc.centerOffsetDeg ?? 0);
  function tick(now) {
    const t = (now - oscT0) / 1000;
    group.rotation.y = baseYaw + oscAmp * Math.sin(oscOmega * t);
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  return function dispose() {
    sceneDisposed = true;
    ro.disconnect();
    renderer.dispose();
    paperGeosToDispose.forEach((g) => g.dispose());
    paperMat.dispose();
    if (plainPaperMat) plainPaperMat.dispose();
    if (paperEndRingsDispose) paperEndRingsDispose();
    normalMap.dispose();
    roughnessMap.dispose();
    paperDiffuseDisposable.dispose();
    labelGeo.dispose();
    labelMat.dispose();
    labelMap.dispose();
    coreGeo.dispose();
    coreMat.dispose();
    if (renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }
  };
}

function boot() {
  document.querySelectorAll('[data-toiletroll-init]').forEach((el) => {
    initToiletRoll(el);
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}
