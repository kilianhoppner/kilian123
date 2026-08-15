/**
 * Gardenhouse glyph — extruded plastic form with gentle face-on yaw oscillation.
 */
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const SHAPE_URL = new URL('./files/gardenhouse-shape.json', import.meta.url).href;

const COLORS = {
  plastic: 0x2ce02c,
  lightAmbient: 0xffffff,
  lightHemisphereSky: 0xffffff,
  lightHemisphereGround: 0x55555a,
  lightKey: 0xffffff,
  lightFill: 0xffffff,
  lightRim: 0xffffff,
};

/** Yaw oscillation — midpoint faces the camera (same idea as toiletroll). */
const ROTATION_OSC = {
  amplitudeDeg: 34,
  periodSeconds: 7.5,
  centerOffsetDeg: 0,
};

const GARDENHOUSE = {
  depth: 0.12,
  bevelEnabled: true,
  bevelThickness: 0.028,
  bevelSize: 0.026,
  bevelSegments: 12,
  curveSegments: 24,
  /** Dense samples along original silhouette (lightly smoothed) */
  outlinePoints: 384,
  modelScale: 1.12,
  rotationOsc: { ...ROTATION_OSC },
  material: {
    roughness: 0.26,
    metalness: 0.0,
    clearcoat: 0.72,
    clearcoatRoughness: 0.18,
    reflectivity: 0.32,
    sheen: 0,
  },
  camera: {
    fov: 30,
    near: 0.1,
    far: 20,
    position: [0.15, 0.04, 2.9],
  },
  renderer: {
    toneMappingExposure: 0.9,
    maxPixelRatio: 2,
  },
  lights: {
    ambient: { intensity: 0.45 },
    hemisphere: { intensity: 0.3 },
    key: { intensity: 0.95, position: [2.2, 2.6, 2.8] },
    fill: { intensity: 0.35, position: [-2.0, 0.5, 1.8] },
    rim: { intensity: 0.4, position: [-0.6, 1.6, -2.4] },
  },
};

function shapeFromPoints(points, sampleCount) {
  // Tiny Laplacian only — smooths stair-steps without reshaping the glyph
  let pts = points.map(([x, y]) => [x, y]);
  for (let pass = 0; pass < 1; pass += 1) {
    const next = [];
    const n = pts.length;
    for (let i = 0; i < n; i += 1) {
      const prev = pts[(i - 1 + n) % n];
      const cur = pts[i];
      const nxt = pts[(i + 1) % n];
      next.push([
        cur[0] * 0.7 + (prev[0] + nxt[0]) * 0.15,
        cur[1] * 0.7 + (prev[1] + nxt[1]) * 0.15,
      ]);
    }
    pts = next;
  }

  const vecs = pts.map(([x, y]) => new THREE.Vector2(x, y));
  if (!vecs[0].equals(vecs[vecs.length - 1])) {
    vecs.push(vecs[0].clone());
  }
  // Low-tension Catmull-Rom: rounds micro-jaggies, stays close to original
  const curve = new THREE.CatmullRomCurve3(
    vecs.map((v) => new THREE.Vector3(v.x, v.y, 0)),
    true,
    'catmullrom',
    0.15
  );
  const spaced = curve.getSpacedPoints(sampleCount);

  const shape = new THREE.Shape();
  shape.moveTo(spaced[0].x, spaced[0].y);
  for (let i = 1; i < spaced.length; i += 1) {
    shape.lineTo(spaced[i].x, spaced[i].y);
  }
  shape.closePath();
  return shape;
}

/** Weld coincident verts so extrude/bevel shading is continuous (no visible facet seams). */
function weldAndSmooth(geometry, tolerance = 1e-4) {
  const pos = geometry.getAttribute('position');
  const inv = 1 / tolerance;
  const map = new Map();
  const newPos = [];
  const indices = [];

  function add(i) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const k = `${Math.round(x * inv)},${Math.round(y * inv)},${Math.round(z * inv)}`;
    let ni = map.get(k);
    if (ni === undefined) {
      ni = newPos.length / 3;
      map.set(k, ni);
      newPos.push(x, y, z);
    }
    return ni;
  }

  const index = geometry.getIndex();
  if (index) {
    for (let i = 0; i < index.count; i += 1) indices.push(add(index.getX(i)));
  } else {
    for (let i = 0; i < pos.count; i += 1) indices.push(add(i));
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(newPos, 3));
  out.setIndex(indices);
  out.computeVertexNormals();
  return out;
}

/** Neutral soft studio env — avoids strong color casts on the green plastic. */
function makeStudioEnv(renderer) {
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0xffffff);

  const soft = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xf7f7f7 })
  );
  soft.position.set(2.2, 2.0, 1.8);
  envScene.add(soft);

  const soft2 = new THREE.Mesh(
    new THREE.SphereGeometry(0.65, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xeeeeee })
  );
  soft2.position.set(-2.4, 1.2, -1.0);
  envScene.add(soft2);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 14),
    new THREE.MeshBasicMaterial({ color: 0xf4f4f4 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.6;
  envScene.add(floor);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(envScene, 0.04).texture;
  pmrem.dispose();
  soft.geometry.dispose();
  soft.material.dispose();
  soft2.geometry.dispose();
  soft2.material.dispose();
  floor.geometry.dispose();
  floor.material.dispose();
  return tex;
}

async function loadShapePoints() {
  const res = await fetch(SHAPE_URL);
  if (!res.ok) throw new Error('Failed to load gardenhouse shape');
  const data = await res.json();
  return data.points;
}

export async function initGardenhouse(container) {
  if (!container || container.dataset.gardenhouseReady === '1') return;
  container.dataset.gardenhouseReady = '1';

  const cfg = GARDENHOUSE;
  let points;
  try {
    points = await loadShapePoints();
  } catch (err) {
    console.warn(err);
    container.dataset.gardenhouseReady = '0';
    return;
  }

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

  const envTex = makeStudioEnv(renderer);
  scene.environment = envTex;

  const shape = shapeFromPoints(points, cfg.outlinePoints);
  let geo = new THREE.ExtrudeGeometry(shape, {
    depth: cfg.depth,
    bevelEnabled: cfg.bevelEnabled,
    bevelThickness: cfg.bevelThickness,
    bevelSize: cfg.bevelSize,
    bevelSegments: cfg.bevelSegments,
    curveSegments: cfg.curveSegments,
  });
  geo.center();
  const smoothGeo = weldAndSmooth(geo);
  geo.dispose();
  geo = smoothGeo;

  const m = cfg.material;
  const mat = new THREE.MeshPhysicalMaterial({
    color: COLORS.plastic,
    roughness: m.roughness,
    metalness: m.metalness,
    clearcoat: m.clearcoat,
    clearcoatRoughness: m.clearcoatRoughness,
    reflectivity: m.reflectivity,
    envMapIntensity: 0.18,
    emissive: COLORS.plastic,
    emissiveIntensity: 0.08,
    flatShading: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  const group = new THREE.Group();
  group.add(mesh);
  group.scale.setScalar(cfg.modelScale);
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
  key.position.set(...L.key.position);
  scene.add(key);
  const fill = new THREE.DirectionalLight(COLORS.lightFill, L.fill.intensity);
  fill.position.set(...L.fill.position);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(COLORS.lightRim, L.rim.intensity);
  rim.position.set(...L.rim.position);
  scene.add(rim);

  container.appendChild(renderer.domElement);

  let disposed = false;

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
  const baseYaw =
    Math.atan2(cam.position[0], cam.position[2]) +
    THREE.MathUtils.degToRad(osc.centerOffsetDeg ?? 0);

  function tick(now) {
    if (disposed) return;
    const t = (now - oscT0) / 1000;
    group.rotation.y = baseYaw + oscAmp * Math.sin(oscOmega * t);
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  return function dispose() {
    disposed = true;
    ro.disconnect();
    geo.dispose();
    mat.dispose();
    envTex.dispose();
    renderer.dispose();
    if (renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }
    container.dataset.gardenhouseReady = '0';
  };
}

function boot() {
  document.querySelectorAll('[data-gardenhouse-init]').forEach((el) => {
    initGardenhouse(el);
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}
