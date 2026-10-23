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
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  Sphere,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";

// The coming-soon hero's 3D scene (#229): one volleyball turning slowly and
// leaning towards the pointer, with a few small ones drifting up behind it.
// Loaded on demand by components/coming-soon/volleyball.tsx, so three.js stays
// out of the page's first load.
//
// Since #236 the ball is a keep-up game (hooghouden): a tap or click on it, or
// `hit()`, knocks it up; it falls under gravity, and the run ends when it
// touches the floor. Then it rolls to a stop and floats back to the middle.
//
// The ball is a cube pushed out to a sphere. Each face carries three panels,
// and the panels on neighbouring faces run crosswise, like a real volleyball.
// Its colours are the --ball-* tokens in app/globals.css, read again when the
// theme changes.

const TEXTURE_SIZE = 256;
const SMALL_BALLS = 7;

// The game, in world units (the ball's radius is 1) and seconds.
const GRAVITY = 7.5;
const REST_Y = 0.25;
const FLOOR_GAP = 0.28; // between the floor and the bottom of the view
const HIT_RADIUS = 1.3; // a little generous, for thumbs
const BOUNCE = 0.42;
const FLOOR_PAUSE = 0.9; // seconds on the floor before floating back

interface Palette {
  panel: string;
  accent: string;
  seam: string;
  shadow: string;
  background: string;
}

function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return {
    panel: token("--ball-panel"),
    accent: token("--ball-accent"),
    seam: token("--ball-seam"),
    shadow: token("--ball-shadow"),
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

// A soft round shadow: white fading to clear, tinted by the material.
function drawShadow(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const half = canvas.width / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.5, "rgba(255,255,255,0.5)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
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
  /** Knocks the ball up from below, as a tap on it would. */
  hit(): void;
  stop(): void;
}

export interface VolleyballOptions {
  animate: boolean;
  /** After every hit, with the hits in this run so far. */
  onHit?(run: number): void;
  /** When the ball touches the floor, with the hits the run reached. */
  onDrop?(run: number): void;
}

/**
 * Draws the scene into `container` and keeps it running until `stop()`.
 * Returns null when the browser can't do WebGL; the page reads fine without
 * the ball. Without `animate` the ball stands still and can't be hit.
 */
export function startVolleyballScene(
  container: HTMLElement,
  { animate, onHit, onDrop }: VolleyballOptions,
): VolleyballScene | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-hidden", "true");
  // No double-tap zoom: quick taps are the game.
  canvas.style.touchAction = "manipulation";
  container.appendChild(canvas);

  const scene = new Scene();
  // The big ball (radius 1) fills about half the box, leaving room to fly.
  const camera = new PerspectiveCamera(35, 1, 0.1, 40);
  camera.position.set(0, 0, 6.4);
  const halfViewAt1 = Math.tan(MathUtils.degToRad(camera.fov / 2));
  const halfHeight = halfViewAt1 * camera.position.z;
  const floorY = -halfHeight + FLOOR_GAP;
  const groundY = floorY + 1; // the ball's centre when it touches the floor
  const topY = halfHeight - 1.05; // the highest a hit sends it

  scene.add(new HemisphereLight(0xffffff, 0x8a948f, 2.2));
  const sun = new DirectionalLight(0xffffff, 2.4);
  sun.position.set(-3, 4, 5);
  scene.add(sun);

  // Textures and materials, shared by every ball.
  const canvases = FACES.map(() => {
    const c = document.createElement("canvas");
    c.width = c.height = TEXTURE_SIZE;
    return c;
  });
  const textures = canvases.map((c) => {
    const texture = new CanvasTexture(c);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  });
  const materials = textures.map(
    (map) => new MeshStandardMaterial({ map, roughness: 0.55, metalness: 0 }),
  );
  const fog = new Fog(0xffffff, 5, 15);
  scene.fog = fog;

  // The shadow on the floor: wide and dark when the ball is low, small and
  // faint when it's high. Slightly behind the ball, which covers its top.
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 64;
  drawShadow(shadowCanvas);
  const shadowTexture = new CanvasTexture(shadowCanvas);
  const shadowMaterial = new MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  const shadowGeometry = new PlaneGeometry(1, 1);
  const shadow = new Mesh(shadowGeometry, shadowMaterial);
  shadow.position.set(0, floorY, -0.3);
  scene.add(shadow);

  function paint() {
    const palette = readPalette();
    FACES.forEach((face, i) => {
      drawFace(canvases[i], palette, face.vertical, face.accentMiddle);
      textures[i].needsUpdate = true;
    });
    fog.color = new Color(palette.background);
    shadowMaterial.color = new Color(palette.shadow);
  }
  paint();

  const geometry = ballGeometry();

  // The big ball moves, leans (towards the pointer) and squashes inside
  // `body`, and turns inside it as `ball`.
  const body = new Group();
  const ball = new Mesh(geometry, materials);
  ball.rotation.set(0.5, 0.3, 0.2);
  body.add(ball);
  body.position.y = REST_Y;
  scene.add(body);

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
      size: MathUtils.lerp(0.1, 0.22, ((i * 37) % 11) / 10),
      lane: MathUtils.lerp(-0.8, 0.8, (i + 0.5) / SMALL_BALLS),
      progress: ((i * 53) % 13) / 13,
      rise: MathUtils.lerp(0.03, 0.06, ((i * 17) % 5) / 4),
      spin: MathUtils.lerp(0.2, 0.6, ((i * 23) % 7) / 6),
    };
  });

  function placeSmallBalls() {
    for (const s of small) {
      const half = halfViewAt1 * (camera.position.z - s.mesh.position.z);
      const t = s.progress;
      const grow =
        MathUtils.smoothstep(t, 0, 0.15) *
        (1 - MathUtils.smoothstep(t, 0.85, 1));
      s.mesh.scale.setScalar(s.size * grow);
      s.mesh.position.x = s.lane * half * camera.aspect;
      s.mesh.position.y = MathUtils.lerp(-half, half, t);
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

  // ---- The game ----------------------------------------------------------
  // "idle": floating at REST_Y. "flying": under gravity, hits count.
  // "floor": rolling out after a drop. "back": floating back to the middle.
  let mode: "idle" | "flying" | "floor" | "back" = "idle";
  let run = 0;
  let floorTime = 0;
  let squash = 0;
  const velocity = new Vector2();
  const spin = new Vector3(0.12, 0.35, 0);
  const idleSpin = new Vector3(0.12, 0.35, 0);

  // `offset` is where the ball was struck, -1 (its left) … 1 (its right):
  // off-centre hits send it the other way, like a real dig.
  function knock(offset: number) {
    run = mode === "flying" ? run + 1 : 1;
    mode = "flying";
    const y = body.position.y;
    velocity.y = Math.max(Math.sqrt(2 * GRAVITY * Math.max(topY - y, 0)), 2);
    // A little more wobble the longer the run, so it stays a game.
    const wobble = (Math.random() - 0.5) * Math.min(0.4 + run * 0.08, 1.2);
    velocity.x = MathUtils.clamp(-offset * 2.2 + wobble, -2.4, 2.4);
    spin.set(-3 - Math.random() * 2, (Math.random() - 0.5) * 2, -velocity.x);
    squash = 0.08;
    onHit?.(run);
    play();
  }

  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const target = new Sphere(new Vector3(), HIT_RADIUS);
  const struck = new Vector3();

  // Where the pointer meets the ball, as -1 … 1 across it, or null.
  function strikeAt(event: PointerEvent): number | null {
    const rect = canvas.getBoundingClientRect();
    ndc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    target.center.copy(body.position);
    if (!raycaster.ray.intersectSphere(target, struck)) return null;
    return MathUtils.clamp(struck.x - body.position.x, -1, 1);
  }

  const onCanvasDown = (event: PointerEvent) => {
    const offset = strikeAt(event);
    if (offset !== null) knock(offset);
  };
  const onCanvasMove = (event: PointerEvent) => {
    canvas.style.cursor = strikeAt(event) === null ? "" : "pointer";
  };

  function physics(dt: number) {
    const halfWidth = halfHeight * camera.aspect;
    const wall = Math.max(halfWidth - 1.02, 0);
    const p = body.position;

    if (mode === "flying" || mode === "floor") {
      velocity.y -= GRAVITY * dt;
      p.x += velocity.x * dt;
      p.y += velocity.y * dt;
      if (Math.abs(p.x) > wall) {
        p.x = Math.sign(p.x) * wall;
        velocity.x *= -0.7;
      }
      if (p.y <= groundY && velocity.y < 0) {
        p.y = groundY;
        squash = Math.min(-velocity.y * 0.025, 0.14);
        if (mode === "flying") {
          mode = "floor";
          floorTime = 0;
          onDrop?.(run);
          run = 0;
        }
        velocity.y = -velocity.y * BOUNCE;
        velocity.x *= 0.7;
        spin.z = -velocity.x;
        if (velocity.y < 0.6) velocity.y = 0;
      }
      if (mode === "floor" && velocity.y === 0) {
        velocity.x = MathUtils.damp(velocity.x, 0, 3, dt);
        floorTime += dt;
        if (floorTime > FLOOR_PAUSE) mode = "back";
      }
    } else if (mode === "back") {
      p.x = MathUtils.damp(p.x, 0, 2.5, dt);
      p.y = MathUtils.damp(p.y, REST_Y, 2.5, dt);
      if (Math.abs(p.x) < 0.01 && Math.abs(p.y - REST_Y) < 0.01) mode = "idle";
    }

    // Spin and squash ease back to the idle turn.
    const settle = mode === "flying" ? 0.4 : 1.5;
    spin.x = MathUtils.damp(spin.x, idleSpin.x, settle, dt);
    spin.y = MathUtils.damp(spin.y, idleSpin.y, settle, dt);
    spin.z = MathUtils.damp(spin.z, idleSpin.z, settle, dt);
    squash = MathUtils.damp(squash, 0, 12, dt);
    body.scale.set(1 + squash, 1 - squash, 1 + squash);
  }

  function placeShadow() {
    const height = MathUtils.clamp(
      (body.position.y - groundY) / (topY - groundY),
      0,
      1,
    );
    const size = 1.9 * (1 - height * 0.45);
    shadow.scale.set(size, size * 0.22, 1);
    shadow.position.x = body.position.x;
    shadowMaterial.opacity = 0.3 * (1 - height * 0.65);
  }
  placeShadow();

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

    physics(dt);
    ball.rotation.x += dt * spin.x;
    ball.rotation.y += dt * spin.y;
    ball.rotation.z += dt * spin.z;
    // It leans towards the pointer and bobs only while nobody plays.
    const resting = mode === "idle";
    body.rotation.x = MathUtils.damp(
      body.rotation.x,
      resting ? pointer.y * 0.35 : 0,
      3,
      dt,
    );
    body.rotation.y = MathUtils.damp(
      body.rotation.y,
      resting ? pointer.x * 0.5 : 0,
      3,
      dt,
    );
    if (resting) body.position.y = REST_Y + Math.sin(elapsed * 1.1) * 0.08;
    placeShadow();

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

  // Theme switch: repaint the panels, the shadow and the fog.
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
  if (animate) {
    window.addEventListener("pointermove", onPointer);
    canvas.addEventListener("pointerdown", onCanvasDown);
    canvas.addEventListener("pointermove", onCanvasMove);
  }

  renderer.render(scene, camera);
  play();

  return {
    hit() {
      if (animate) knock((Math.random() - 0.5) * 0.6);
    },
    stop() {
      pause();
      resizeObserver.disconnect();
      themeObserver.disconnect();
      viewObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointer);
      canvas.removeEventListener("pointerdown", onCanvasDown);
      canvas.removeEventListener("pointermove", onCanvasMove);
      geometry.dispose();
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      shadowGeometry.dispose();
      shadowMaterial.dispose();
      shadowTexture.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
