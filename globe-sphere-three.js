/**
 * Gallery globe — Three.js textured sphere + graticule.
 * Optional runtime overrides: window.GLOBE_SPHERE_CONFIG in index.html (before this script).
 */
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// =============================================================================
// EDIT BELOW — all defaults in one place
// =============================================================================

/** Equirectangular Earth texture map (`code/files/…`). */
const TEXTURE_PATH = './files/earth-texture-map.png';
/** Full-body figure composited on top of the Earth map (same folder). Black background → transparent. */
const FIGURE_OVERLAY_PATH = './files/globe-figure-overlay.png';

/** Max dimension when building composite canvas (higher = sharper figure, more GPU memory). */
const COMPOSITE_TEXTURE_MAX_DIM = 8192;

const GLOBE_DEFAULTS = {
  /** Log merged config to console */
  debug: false,

  /** Sphere radius in world units */
  radius: 0.48,

  /** Clear alpha so the page shows through around the sphere */
  transparentCanvas: true,

  /** Used when transparentCanvas is false */
  canvasBackground: 0xf8f8fa,

  fill: {
    enabled: true,
    color: 0xe8e8ec,
    opacity: 1,
  },

  texture: {
    enabled: true,
    /** Multiplies albedo; > 1 brightens the mapped image */
    brightness: 2,
    /**
     * UV scale: 1 = full image on the map. Below 1 crops toward center (zoom in); above 1 zooms out
     * (image smaller on sphere, edges clamp). mapRepeatX / mapRepeatY override per axis.
     */
    mapRepeat: 1,
    mapRepeatX: null,
    mapRepeatY: null,
    /** Extra UV offset after centering (texture space). Negative mapOffsetV nudges the image upward on the sphere. */
    mapOffsetU: 0,
    mapOffsetV: 0,
    /** Draw small figure on top of Earth (same UV / mapRepeat as Earth-only; Earth is unchanged underneath). */
    figureOverlayEnabled: true,
    /** null = FIGURE_OVERLAY_PATH */
    figureOverlayUrl: null,
    /** Figure height as a fraction of the texture height (small on the globe). */
    figureOverlayHeightScale: 0.28,
    /** Where to place the figure center, in texture space 0–1 (u = longitude, v = latitude in image). */
    figureOverlayAnchorU: 0.39,
    figureOverlayAnchorV: 0.32,
    /**
     * Less than 1 shrinks only the drawn height (width stays from the base height) so the figure
     * looks less tall on the globe. 1 = natural image aspect (values above 1 are still clamped to 1).
     */
    figureVerticalSquash: 0.78,
    /** Treat near-black as transparent (stock photo backgrounds). */
    figureKnockoutBlack: true,
    figureKnockoutBlackThreshold: 18,
    /**
     * Multiply Earth+figure canvas size (same UV mapping, more pixels = sharper man on the globe).
     * Blur happens when the figure only uses a few hundred texels; 2 is a good default.
     */
    figureCompositeResolutionScale: 2,
    /**
     * Render the figure into a larger offscreen buffer before placing (sharper edges after knockout).
     */
    figureSpriteSupersample: 2,
    /**
     * Figure mesh radius = (globe radius × lines.radiusScale) × this, so it sits just outside graticule lines.
     */
    figureOverlayLineRadiusMultiplier: 1.0015,
  },

  lines: {
    /** Graticule (lat/long) lines on the sphere */
    color: 0x2B2B2B,
    parallelCount: 11,
    poleMargin: 0.08,
    /** Set to a non-empty array to override parallelCount (latitudes in radians) */
    parallels: null,
    meridianCount: 9,
    segments: 112,
    /** Slightly >1 draws graticule in front of the sphere surface to reduce z-fighting (dotted/broken lines). */
    radiusScale: 1.0004,
  },

  /** Radians/sec about Y */
  rotationSpeed: 0.55,
  /** Starting yaw around Y (radians); π turns the texture 180° from the old default */
  initialRotationY: Math.PI,
  /** Fixed tilt around X before spin (radians) */
  tiltForward: 0.54,

  sphere: {
    widthSegments: 64,
    heightSegments: 48,
  },

  camera: {
    fov: 48,
    near: 0.05,
    far: 100,
    position: [0, 0.12, 1.28],
    lookAt: [0, 0, 0],
  },

  lights: {
    ambient: 0.72,
    key: { intensity: 1.38, position: [2.2, 2.8, 2.4] },
    fill: { intensity: 0.52, position: [-2.0, 0.2, -1.2] },
  },

  renderer: {
    maxPixelRatio: 2,
    antialias: true,
    alpha: true,
    premultipliedAlpha: false,
    powerPreference: 'high-performance',
    toneMappingExposure: 1.08,
  },

  materials: {
    fill: {
      roughness: 0.9,
      metalness: 0,
    },
    textured: {
      roughness: 0.82,
      metalness: 0.02,
      anisotropyMax: 8,
    },
  },

  graticuleLine: {
    /** LineBasicMaterial only; most browsers ignore linewidth > 1 (use lines.color for emphasis). */
    linewidth: 1,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  },

  animation: {
    /** Cap per-frame delta (seconds) for stability after tab switch */
    maxDeltaSeconds: 0.1,
  },
};

// =============================================================================
// Config merge + runtime resolution (do not edit unless you know the flow)
// =============================================================================

function buildConfig() {
  const o =
    typeof window !== 'undefined' && window.GLOBE_SPHERE_CONFIG
      ? window.GLOBE_SPHERE_CONFIG
      : {};

  const mergedTexture = { ...GLOBE_DEFAULTS.texture, ...(o.texture || {}) };
  if (mergedTexture.url == null || mergedTexture.url === '') {
    mergedTexture.url = new URL(TEXTURE_PATH, import.meta.url).href;
  } else if (typeof mergedTexture.url === 'string') {
    mergedTexture.url = resolveTextureUrl(mergedTexture.url);
  }
  if (mergedTexture.figureOverlayUrl == null || mergedTexture.figureOverlayUrl === '') {
    mergedTexture.figureOverlayUrl = new URL(FIGURE_OVERLAY_PATH, import.meta.url).href;
  } else if (typeof mergedTexture.figureOverlayUrl === 'string') {
    mergedTexture.figureOverlayUrl = resolveTextureUrl(mergedTexture.figureOverlayUrl);
  }

  return {
    ...GLOBE_DEFAULTS,
    ...o,
    fill: { ...GLOBE_DEFAULTS.fill, ...(o.fill || {}) },
    lines: { ...GLOBE_DEFAULTS.lines, ...(o.lines || {}) },
    texture: mergedTexture,
    sphere: { ...GLOBE_DEFAULTS.sphere, ...(o.sphere || {}) },
    camera: { ...GLOBE_DEFAULTS.camera, ...(o.camera || {}) },
    lights: { ...GLOBE_DEFAULTS.lights, ...(o.lights || {}) },
    renderer: { ...GLOBE_DEFAULTS.renderer, ...(o.renderer || {}) },
    materials: {
      fill: { ...GLOBE_DEFAULTS.materials.fill, ...(o.materials?.fill || {}) },
      textured: { ...GLOBE_DEFAULTS.materials.textured, ...(o.materials?.textured || {}) },
    },
    graticuleLine: { ...GLOBE_DEFAULTS.graticuleLine, ...(o.graticuleLine || {}) },
    animation: { ...GLOBE_DEFAULTS.animation, ...(o.animation || {}) },
    transparentCanvas:
      o.transparentCanvas !== undefined ? o.transparentCanvas : GLOBE_DEFAULTS.transparentCanvas,
  };
}

function knockoutNearBlackPixels(ctx, w, h, threshold) {
  const t = Math.min(255, Math.max(0, threshold | 0));
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] <= t && d[i + 1] <= t && d[i + 2] <= t) {
      d[i + 3] = 0;
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

/** Match Earth texture pixel size / UV layout (same as former Earth+figure composite). */
function computeFigureCanvasDimensions(earthImg, tcfg) {
  const ew0 = earthImg.naturalWidth || earthImg.width;
  const eh0 = earthImg.naturalHeight || earthImg.height;
  if (!ew0 || !eh0) return null;

  let cw = ew0;
  let ch = eh0;
  const maxDim = COMPOSITE_TEXTURE_MAX_DIM;
  const scaleDown = Math.min(1, maxDim / Math.max(cw, ch));
  if (scaleDown < 1) {
    cw = Math.max(1, Math.round(cw * scaleDown));
    ch = Math.max(1, Math.round(ch * scaleDown));
  }

  const resScale =
    typeof tcfg.figureCompositeResolutionScale === 'number' &&
    !Number.isNaN(tcfg.figureCompositeResolutionScale)
      ? Math.min(2.5, Math.max(1, tcfg.figureCompositeResolutionScale))
      : 2;
  cw = Math.max(1, Math.round(cw * resScale));
  ch = Math.max(1, Math.round(ch * resScale));
  if (Math.max(cw, ch) > maxDim) {
    const k = maxDim / Math.max(cw, ch);
    cw = Math.max(1, Math.round(cw * k));
    ch = Math.max(1, Math.round(ch * k));
  }

  return { cw, ch };
}

/** Transparent canvas with the figure only; same UV mapping as Earth when used on a matching sphere. */
function createFigureOnlyCanvas(cw, ch, figureImg, tcfg) {
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = true;
  if (typeof ctx.imageSmoothingQuality === 'string') {
    ctx.imageSmoothingQuality = 'high';
  }

  const iw = figureImg.naturalWidth || figureImg.width;
  const ih = figureImg.naturalHeight || figureImg.height;
  if (!iw || !ih) return canvas;

  const heightScale =
    typeof tcfg.figureOverlayHeightScale === 'number' && !Number.isNaN(tcfg.figureOverlayHeightScale)
      ? tcfg.figureOverlayHeightScale
      : 0.11;
  const fhBase = Math.max(2, ch * Math.min(0.45, Math.max(0.02, heightScale)));
  const squash =
    typeof tcfg.figureVerticalSquash === 'number' && !Number.isNaN(tcfg.figureVerticalSquash)
      ? Math.max(0.25, Math.min(1, tcfg.figureVerticalSquash))
      : 0.88;
  const fh = fhBase * squash;
  const fw = (iw / ih) * fhBase;
  const au = tcfg.figureOverlayAnchorU != null ? tcfg.figureOverlayAnchorU : 0.5;
  const av = tcfg.figureOverlayAnchorV != null ? tcfg.figureOverlayAnchorV : 0.5;
  const ox = au * cw - fw / 2;
  const oy = av * ch - fh / 2;

  const knockout = tcfg.figureKnockoutBlack !== false;
  const th = tcfg.figureKnockoutBlackThreshold != null ? tcfg.figureKnockoutBlackThreshold : 18;

  const superS =
    typeof tcfg.figureSpriteSupersample === 'number' && !Number.isNaN(tcfg.figureSpriteSupersample)
      ? Math.min(3, Math.max(1, Math.round(tcfg.figureSpriteSupersample)))
      : 2;

  if (knockout) {
    const pc = document.createElement('canvas');
    const sw = Math.max(1, Math.round(fw * superS));
    const sh = Math.max(1, Math.round(fh * superS));
    pc.width = sw;
    pc.height = sh;
    const pctx = pc.getContext('2d');
    if (!pctx) return canvas;
    pctx.imageSmoothingEnabled = true;
    if (typeof pctx.imageSmoothingQuality === 'string') {
      pctx.imageSmoothingQuality = 'high';
    }
    pctx.drawImage(figureImg, 0, 0, sw, sh);
    knockoutNearBlackPixels(pctx, sw, sh, th);
    ctx.imageSmoothingEnabled = true;
    if (typeof ctx.imageSmoothingQuality === 'string') {
      ctx.imageSmoothingQuality = 'high';
    }
    ctx.drawImage(pc, 0, 0, sw, sh, ox, oy, fw, fh);
  } else {
    ctx.drawImage(figureImg, ox, oy, fw, fh);
  }

  return canvas;
}

function applyTextureMapZoom(tex, tcfg) {
  const base =
    typeof tcfg.mapRepeat === 'number' && !Number.isNaN(tcfg.mapRepeat) ? tcfg.mapRepeat : 1;
  const rx = tcfg.mapRepeatX != null ? tcfg.mapRepeatX : base;
  const ry = tcfg.mapRepeatY != null ? tcfg.mapRepeatY : base;
  const ou = tcfg.mapOffsetU != null ? tcfg.mapOffsetU : 0;
  const ov = tcfg.mapOffsetV != null ? tcfg.mapOffsetV : 0;
  tex.repeat.set(rx, ry);
  tex.offset.set((1 - rx) / 2 + ou, (1 - ry) / 2 + ov);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
}

function resolveTextureUrl(pathOrUrl) {
  if (
    typeof pathOrUrl === 'string' &&
    (pathOrUrl.startsWith('http:') ||
      pathOrUrl.startsWith('https:') ||
      pathOrUrl.startsWith('data:') ||
      pathOrUrl.startsWith('blob:'))
  ) {
    return pathOrUrl;
  }
  try {
    return new URL(pathOrUrl, window.location.href).href;
  } catch {
    return pathOrUrl;
  }
}

const CONFIG = buildConfig();

function getParallelLatitudes(lines) {
  if (Array.isArray(lines.parallels) && lines.parallels.length > 0) {
    return lines.parallels;
  }
  const n = Math.max(1, lines.parallelCount ?? 12);
  const margin = lines.poleMargin ?? 0.08;
  const halfPi = Math.PI / 2;
  const lo = -halfPi + margin;
  const hi = halfPi - margin;
  if (n === 1) {
    return [(lo + hi) / 2];
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(lo + (i / (n - 1)) * (hi - lo));
  }
  return out;
}

function buildGraticuleGroup(lineRadius, colorHex) {
  const g = new THREE.Group();
  const gl = CONFIG.graticuleLine;
  const mat = new THREE.LineBasicMaterial({
    color: colorHex,
    linewidth: gl.linewidth != null ? gl.linewidth : 1,
    transparent: true,
    opacity: 1,
    depthTest: true,
    polygonOffset: true,
    polygonOffsetFactor: gl.polygonOffsetFactor,
    polygonOffsetUnits: gl.polygonOffsetUnits,
  });
  const seg = CONFIG.lines.segments;

  for (const lat of getParallelLatitudes(CONFIG.lines)) {
    const pts = [];
    const cl = Math.cos(lat);
    const sl = Math.sin(lat);
    for (let i = 0; i <= seg; i++) {
      const phi = (i / seg) * Math.PI * 2;
      pts.push(
        new THREE.Vector3(
          lineRadius * cl * Math.cos(phi),
          lineRadius * sl,
          lineRadius * cl * Math.sin(phi)
        )
      );
    }
    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    g.add(new THREE.LineLoop(geom, mat));
  }

  const m = CONFIG.lines.meridianCount;
  for (let k = 0; k < m; k++) {
    const phi0 = (k / m) * Math.PI * 2;
    const pts = [];
    for (let i = 0; i <= seg; i++) {
      const t = (i / seg) * Math.PI * 2;
      pts.push(
        new THREE.Vector3(
          lineRadius * Math.sin(t) * Math.cos(phi0),
          lineRadius * Math.cos(t),
          lineRadius * Math.sin(t) * Math.sin(phi0)
        )
      );
    }
    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    g.add(new THREE.LineLoop(geom, mat));
  }

  return g;
}

function initGlobe(container) {
  const R = CONFIG.radius;
  const lineR = R * CONFIG.lines.radiusScale;
  const matFill = CONFIG.materials.fill;
  const matTex = CONFIG.materials.textured;
  const rnd = CONFIG.renderer;
  const anim = CONFIG.animation;

  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(
    CONFIG.camera.fov,
    1,
    CONFIG.camera.near,
    CONFIG.camera.far
  );
  camera.position.set(...CONFIG.camera.position);
  camera.lookAt(...CONFIG.camera.lookAt);

  const renderer = new THREE.WebGLRenderer({
    antialias: rnd.antialias,
    alpha: rnd.alpha,
    premultipliedAlpha: rnd.premultipliedAlpha,
    powerPreference: rnd.powerPreference,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, rnd.maxPixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = rnd.toneMappingExposure;
  if (CONFIG.transparentCanvas) {
    renderer.setClearColor(0x000000, 0);
  } else {
    renderer.setClearColor(CONFIG.canvasBackground, 1);
  }
  container.appendChild(renderer.domElement);
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.background = 'transparent';

  const root = new THREE.Group();
  root.rotation.x = CONFIG.tiltForward;
  const startYaw = CONFIG.initialRotationY ?? 0;
  root.rotation.y = startYaw;
  scene.add(root);

  const sphereGeom = new THREE.SphereGeometry(
    R,
    CONFIG.sphere.widthSegments,
    CONFIG.sphere.heightSegments
  );

  const fillColor = new THREE.Color(CONFIG.fill.color);
  const baseMat = new THREE.MeshStandardMaterial({
    color: fillColor,
    roughness: matFill.roughness,
    metalness: matFill.metalness,
    transparent: CONFIG.fill.opacity < 1,
    opacity: CONFIG.fill.opacity,
  });

  const sphereMesh = new THREE.Mesh(sphereGeom, baseMat);
  root.add(sphereMesh);

  if (CONFIG.texture.enabled && CONFIG.texture.url) {
    const loader = new THREE.TextureLoader();
    const tcfg = CONFIG.texture;

    function applyGlobeMap(tex) {
      tex.colorSpace = THREE.SRGBColorSpace;
      if (tex.isCanvasTexture) {
        tex.generateMipmaps = false;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
      }
      tex.anisotropy = Math.min(matTex.anisotropyMax, renderer.capabilities.getMaxAnisotropy());
      applyTextureMapZoom(tex, tcfg);
      sphereMesh.material.dispose();
      const b = tcfg.brightness != null ? tcfg.brightness : 1;
      sphereMesh.material = new THREE.MeshStandardMaterial({
        map: tex,
        color: new THREE.Color(b, b, b),
        roughness: matTex.roughness,
        metalness: matTex.metalness,
        transparent: true,
        depthWrite: true,
        alphaTest: tex.isCanvasTexture ? 0.01 : 0,
      });
    }

    loader.load(
      tcfg.url,
      (earthTex) => {
        const useFigure =
          tcfg.figureOverlayEnabled !== false &&
          tcfg.figureOverlayUrl &&
          typeof tcfg.figureOverlayUrl === 'string';

        if (!useFigure) {
          applyGlobeMap(earthTex);
          if (CONFIG.debug) {
            console.log('[globe-sphere-three] texture loaded', tcfg.url);
          }
          return;
        }

        loader.load(
          tcfg.figureOverlayUrl,
          (figureTex) => {
            try {
              applyGlobeMap(earthTex);

              const dim = computeFigureCanvasDimensions(earthTex.image, tcfg);
              const figCanvas =
                dim && createFigureOnlyCanvas(dim.cw, dim.ch, figureTex.image, tcfg);
              figureTex.dispose();

              if (!figCanvas) {
                if (CONFIG.debug) {
                  console.log('[globe-sphere-three] Earth + figure (figure layer skipped)');
                }
                return;
              }

              const figMap = new THREE.CanvasTexture(figCanvas);
              figMap.colorSpace = THREE.SRGBColorSpace;
              figMap.generateMipmaps = false;
              figMap.minFilter = THREE.LinearFilter;
              figMap.magFilter = THREE.LinearFilter;
              figMap.anisotropy = Math.min(
                matTex.anisotropyMax,
                renderer.capabilities.getMaxAnisotropy()
              );
              applyTextureMapZoom(figMap, tcfg);

              const mult =
                typeof tcfg.figureOverlayLineRadiusMultiplier === 'number' &&
                !Number.isNaN(tcfg.figureOverlayLineRadiusMultiplier)
                  ? Math.max(1.0001, tcfg.figureOverlayLineRadiusMultiplier)
                  : 1.0015;
              const figureR = lineR * mult;

              const figureGeom = new THREE.SphereGeometry(
                figureR,
                CONFIG.sphere.widthSegments,
                CONFIG.sphere.heightSegments
              );
              const b = tcfg.brightness != null ? tcfg.brightness : 1;
              const figMat = new THREE.MeshStandardMaterial({
                map: figMap,
                color: new THREE.Color(b, b, b),
                roughness: matTex.roughness,
                metalness: matTex.metalness,
                transparent: true,
                alphaTest: 0.01,
                depthWrite: true,
              });
              const figureMesh = new THREE.Mesh(figureGeom, figMat);
              figureMesh.renderOrder = 1;
              root.add(figureMesh);

              if (CONFIG.debug) {
                console.log('[globe-sphere-three] Earth + figure layer above graticule');
              }
            } catch (e) {
              console.warn('[globe-sphere-three] figure layer failed; Earth only', e);
              applyGlobeMap(earthTex);
              figureTex.dispose();
            }
          },
          undefined,
          (err) => {
            console.warn('[globe-sphere-three] figure overlay load failed; Earth only', err);
            applyGlobeMap(earthTex);
          }
        );
      },
      undefined,
      (err) => {
        console.warn('[globe-sphere-three] texture failed; keeping fill material', err);
      }
    );
  }

  const graticule = buildGraticuleGroup(lineR, CONFIG.lines.color);
  root.add(graticule);

  const amb = new THREE.AmbientLight(0xffffff, CONFIG.lights.ambient);
  scene.add(amb);
  const key = new THREE.DirectionalLight(0xffffff, CONFIG.lights.key.intensity);
  key.position.set(...CONFIG.lights.key.position);
  scene.add(key);
  const fillLt = new THREE.DirectionalLight(0xffffff, CONFIG.lights.fill.intensity);
  fillLt.position.set(...CONFIG.lights.fill.position);
  scene.add(fillLt);

  let lastT = performance.now();
  let angle = startYaw;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let motionOk = !reducedMotion.matches;
  reducedMotion.addEventListener('change', () => {
    motionOk = !reducedMotion.matches;
  });

  function resize() {
    const w = Math.max(container.clientWidth, 1);
    const h = Math.max(container.clientHeight, 1);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min((now - lastT) / 1000, anim.maxDeltaSeconds);
    lastT = now;
    if (motionOk) {
      angle += CONFIG.rotationSpeed * dt;
      root.rotation.y = angle;
    }
    renderer.render(scene, camera);
  }

  resize();
  requestAnimationFrame(tick);

  const ro = new ResizeObserver(resize);
  ro.observe(container);

  if (CONFIG.debug) {
    console.log('[globe-sphere-three] CONFIG', CONFIG);
  }
}

document.querySelectorAll('[data-globe-sphere-three]').forEach((el) => {
  initGlobe(el);
});
