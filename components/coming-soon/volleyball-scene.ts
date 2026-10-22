import {
  BoxGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";

// The coming-soon hero's 3D scene (#229): one volleyball turning slowly and
// leaning towards the pointer, with a few small ones drifting up behind it.
// Loaded on demand by components/coming-soon/volleyball.tsx, so three.js stays
// out of the page's first load.
//
// The ball is a cube pushed out to a sphere. Each face carries three panels,
// and the panels on neighbouring faces run crosswise, like a real volleyball.
// Its colours are the --ball-* tokens in app/globals.css, read again when the
// theme changes.

const TEXTURE_SIZE = 256;
const SMALL_BALLS = 7;

interface Palette {
  panel: string;
  accent: string;
  seam: string;
  background: string;
}

function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return {
    panel: token("--ball-panel"),
    accent: token("--ball-accent"),
    seam: token("--ball-seam"),
    background: token("--background"),
  };
}

// Three panels across one face; `vertical` panels run along the texture's v.
// The middle panel is the accent on half of the faces, so the colours
// alternate around the ball.
function drawFace(
  canvas: HTMLCanvasElement,
  palette: Palette,
  vertical: boolean,
  accentMiddle: boolean,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const s = TEXTURE_SIZE;
  const third = s / 3;
  const colours = accentMiddle
    ? [palette.panel, palette.accent, palette.panel]
    : [palette.accent, palette.panel, palette.accent];

  colours.forEach((colour, i) => {
    ctx.fillStyle = colour;
    if (vertical) ctx.fillRect(i * third, 0, third + 1, s);
    else ctx.fillRect(0, i * third, s, third + 1);
  });

  // Seams between the panels, and half a seam on each edge: the neighbouring
  // face draws the other half.
  ctx.fillStyle = palette.seam;
  const seam = s * 0.022;
  for (const at of [third, 2 * third]) {
    if (vertical) ctx.fillRect(at - seam / 2, 0, seam, s);
    else ctx.fillRect(0, at - seam / 2, s, seam);
  }
  ctx.fillRect(0, 0, s, seam / 2);
  ctx.fillRect(0, s - seam / 2, s, seam / 2);
  ctx.fillRect(0, 0, seam / 2, s);
  ctx.fillRect(s - seam / 2, 0, seam / 2, s);
}

// BoxGeometry's face order is +x, -x, +y, -y, +z, -z. With its UV layout,
// vertical panels on the x and y faces and horizontal ones on the z faces
// make every pair of neighbouring faces run crosswise.
const FACES = [
  { vertical: true, accentMiddle: true },
  { vertical: true, accentMiddle: true },
  { vertical: true, accentMiddle: false },
  { vertical: true, accentMiddle: false },
  { vertical: false, accentMiddle: true },
  { vertical: false, accentMiddle: true },
];

function ballGeometry(): BoxGeometry {
  const geometry = new BoxGeometry(1, 1, 1, 28, 28, 28);
  const position = geometry.attributes.position;
  const v = new Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i).normalize();
    position.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

export interface VolleyballScene {
  stop(): void;
}

/**
 * Draws the scene into `container` and keeps it running until `stop()`.
 * Returns null when the browser can't do WebGL; the page reads fine without
 * the ball.
 */
export function startVolleyballScene(
  container: HTMLElement,
  { animate }: { animate: boolean },
): VolleyballScene | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.domElement.setAttribute("aria-hidden", "true");
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  // The big ball (radius 1) fills about 60% of the box.
  const camera = new PerspectiveCamera(35, 1, 0.1, 40);
  camera.position.set(0, 0, 5.2);
  const halfViewAt1 = Math.tan(MathUtils.degToRad(camera.fov / 2));

  scene.add(new HemisphereLight(0xffffff, 0x8a948f, 2.2));
  const sun = new DirectionalLight(0xffffff, 2.4);
  sun.position.set(-3, 4, 5);
  scene.add(sun);

  // Textures and materials, shared by every ball.
  const canvases = FACES.map(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = TEXTURE_SIZE;
    return canvas;
  });
  const textures = canvases.map((canvas) => {
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  });
  const materials = textures.map(
    (map) => new MeshStandardMaterial({ map, roughness: 0.55, metalness: 0 }),
  );
  const fog = new Fog(0xffffff, 5, 14);
  scene.fog = fog;

  function paint() {
    const palette = readPalette();
    FACES.forEach((face, i) => {
      drawFace(canvases[i], palette, face.vertical, face.accentMiddle);
      textures[i].needsUpdate = true;
    });
    fog.color = new Color(palette.background);
  }
  paint();

  const geometry = ballGeometry();

  // The big ball leans inside `tilt` (towards the pointer) and turns inside
  // `ball` around an axis tipped like a served ball.
  const tilt = new Group();
  const ball = new Mesh(geometry, materials);
  ball.rotation.set(0.5, 0.3, 0.2);
  tilt.add(ball);
  scene.add(tilt);

  // Small balls behind, each with its own size, lane, speed and spin. They
  // rise from the bottom of the box to the top, growing in and shrinking out
  // at the edges, so none is ever cut off by the box.
  const small = Array.from({ length: SMALL_BALLS }, (_, i) => {
    const mesh = new Mesh(geometry, materials);
    mesh.position.z = MathUtils.lerp(-5, -2, ((i * 29) % 7) / 6);
    mesh.rotation.set(i, i * 2, i * 3);
    scene.add(mesh);
    return {
      mesh,
      size: MathUtils.lerp(0.14, 0.3, ((i * 37) % 11) / 10),
      lane: MathUtils.lerp(-0.8, 0.8, (i + 0.5) / SMALL_BALLS),
      progress: ((i * 53) % 13) / 13,
      rise: MathUtils.lerp(0.03, 0.06, ((i * 17) % 5) / 4),
      spin: MathUtils.lerp(0.2, 0.6, ((i * 23) % 7) / 6),
    };
  });

  function placeSmallBalls() {
    for (const s of small) {
      const halfHeight = halfViewAt1 * (camera.position.z - s.mesh.position.z);
      const t = s.progress;
      const grow =
        MathUtils.smoothstep(t, 0, 0.15) *
        (1 - MathUtils.smoothstep(t, 0.85, 1));
      s.mesh.scale.setScalar(s.size * grow);
      s.mesh.position.x = s.lane * halfHeight * camera.aspect;
      s.mesh.position.y = MathUtils.lerp(-halfHeight, halfHeight, t);
    }
  }

  function resize() {
    const { width, height } = container.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    placeSmallBalls();
  }
  resize();

  // Pointer position over the whole window, -1 … 1.
  const pointer = { x: 0, y: 0 };
  const onPointer = (event: PointerEvent) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
  };

  let frame = 0;
  let last = performance.now();
  let elapsed = 0;
  let visible = true;
  let inView = true;

  function step(now: number) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    elapsed += dt;

    ball.rotation.y += dt * 0.35;
    ball.rotation.x += dt * 0.12;
    tilt.rotation.x = MathUtils.damp(tilt.rotation.x, pointer.y * 0.35, 3, dt);
    tilt.rotation.y = MathUtils.damp(tilt.rotation.y, pointer.x * 0.5, 3, dt);
    tilt.position.y = Math.sin(elapsed * 1.1) * 0.08;

    for (const s of small) {
      s.progress = (s.progress + dt * s.rise) % 1;
      s.mesh.rotation.x += dt * s.spin;
      s.mesh.rotation.y += dt * s.spin * 0.7;
    }
    placeSmallBalls();
    renderer.render(scene, camera);
    frame = requestAnimationFrame(step);
  }

  function play() {
    if (!animate || frame || !visible || !inView) return;
    last = performance.now();
    frame = requestAnimationFrame(step);
  }
  function pause() {
    cancelAnimationFrame(frame);
    frame = 0;
  }

  const resizeObserver = new ResizeObserver(() => {
    resize();
    if (!frame) renderer.render(scene, camera);
  });
  resizeObserver.observe(container);

  // Theme switch: repaint the panels and the fog in the new colours.
  const themeObserver = new MutationObserver(() => {
    paint();
    if (!frame) renderer.render(scene, camera);
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });

  const viewObserver = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (inView) play();
    else pause();
  });
  viewObserver.observe(container);

  const onVisibility = () => {
    visible = document.visibilityState === "visible";
    if (visible) play();
    else pause();
  };
  document.addEventListener("visibilitychange", onVisibility);
  if (animate) window.addEventListener("pointermove", onPointer);

  renderer.render(scene, camera);
  play();

  return {
    stop() {
      pause();
      resizeObserver.disconnect();
      themeObserver.disconnect();
      viewObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointer);
      geometry.dispose();
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
