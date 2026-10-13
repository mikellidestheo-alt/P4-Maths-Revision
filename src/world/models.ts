/**
 * Blocky low-poly models built from boxes and cones (original designs, no external assets).
 */
import {
  BoxGeometry, BufferGeometry, CanvasTexture, Color, ConeGeometry, CylinderGeometry, DodecahedronGeometry, Group,
  Mesh, MeshBasicMaterial, MeshLambertMaterial, Object3D, PlaneGeometry, SphereGeometry, SRGBColorSpace, TorusGeometry,
  AdditiveBlending, DoubleSide, type Material,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const matCache = new Map<string, MeshLambertMaterial>();
export function mat(color: string | number, opts: { emissive?: string | number; flat?: boolean } = {}): MeshLambertMaterial {
  const key = `${color}|${opts.emissive ?? ''}|${opts.flat ?? true}`;
  let m = matCache.get(key);
  if (!m) {
    m = new MeshLambertMaterial({ color, flatShading: opts.flat ?? true });
    if (opts.emissive !== undefined) m.emissive = new Color(opts.emissive);
    matCache.set(key, m);
  }
  return m;
}

export function box(w: number, h: number, d: number, color: string | number, x = 0, y = 0, z = 0, material?: Material): Mesh {
  const m = new Mesh(new BoxGeometry(w, h, d), material ?? mat(color));
  m.position.set(x, y, z);
  return m;
}

/* ---------------- trees (instanced in world.ts) ---------------- */

export function treeGeometries(): { trunk: BufferGeometry; canopy: BufferGeometry } {
  const trunk = new BoxGeometry(0.6, 2.2, 0.6);
  trunk.translate(0, 1.1, 0);
  const c1 = new ConeGeometry(2.3, 2.6, 6); c1.translate(0, 3.0, 0);
  const c2 = new ConeGeometry(1.8, 2.3, 6); c2.translate(0, 4.4, 0);
  const c3 = new ConeGeometry(1.2, 2.0, 6); c3.translate(0, 5.7, 0);
  const canopy = mergeGeometries([c1.toNonIndexed(), c2.toNonIndexed(), c3.toNonIndexed()])!;
  canopy.computeVertexNormals();
  return { trunk, canopy };
}

/* ---------------- camp props ---------------- */

export function tent(): Group {
  const g = new Group();
  const geo = new ConeGeometry(2.6, 3.2, 4, 1);
  geo.rotateY(Math.PI / 4);
  const body = new Mesh(geo, mat('#d9692f'));
  body.position.y = 1.6;
  body.scale.set(1, 1, 1.3);
  const door = new Mesh(new PlaneGeometry(1.1, 1.7), mat('#3a1a0a'));
  door.position.set(0, 0.85, 1.75);
  door.rotation.x = -0.32;
  const glow = new Mesh(new PlaneGeometry(0.5, 1.3), new MeshBasicMaterial({ color: '#ffcf6b', transparent: true, opacity: 0.6 }));
  glow.position.set(0, 0.7, 1.77);
  glow.rotation.x = -0.32;
  g.add(body, door, glow);
  return g;
}

export function campfire(): { group: Group; flames: Mesh[] } {
  const g = new Group();
  const logA = box(2.2, 0.35, 0.35, '#6b3d1e', 0, 0.25, 0); logA.rotation.y = 0.5;
  const logB = box(2.2, 0.35, 0.35, '#5a3218', 0, 0.25, 0); logB.rotation.y = -0.5;
  g.add(logA, logB);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const st = new Mesh(new DodecahedronGeometry(0.32), mat(i % 2 ? '#6d6a7a' : '#5a5768'));
    st.position.set(Math.cos(a) * 1.3, 0.2, Math.sin(a) * 1.3);
    g.add(st);
  }
  const flames: Mesh[] = [];
  const cols = ['#ff7a1a', '#ffb43a', '#fff1b8'];
  [0.75, 0.5, 0.28].forEach((r, i) => {
    const f = new Mesh(new ConeGeometry(r, 1.6 - i * 0.35, 5), new MeshBasicMaterial({ color: cols[i] }));
    f.position.y = 0.4 + (1.6 - i * 0.35) / 2;
    g.add(f);
    flames.push(f);
  });
  return { group: g, flames };
}

export function lanternPost(glowColor: string): Group {
  const g = new Group();
  g.add(box(0.25, 3.2, 0.25, '#4b3020', 0, 1.6, 0), box(1.0, 0.18, 0.18, '#4b3020', 0.4, 3.1, 0));
  const lamp = box(0.45, 0.55, 0.45, glowColor, 0.8, 2.6, 0, new MeshBasicMaterial({ color: glowColor }));
  lamp.name = 'lamp';
  g.add(lamp, halo(glowColor, 1.6, 0.8, 2.6, 0));
  return g;
}

export function halo(color: string, size: number, x = 0, y = 0, z = 0): Mesh {
  const m = new Mesh(new PlaneGeometry(size, size), new MeshBasicMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: AdditiveBlending }));
  m.position.set(x, y, z);
  m.userData.billboard = true;
  return m;
}

let glowTex: CanvasTexture | null = null;
export function glowTexture(): CanvasTexture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  glowTex = new CanvasTexture(c);
  glowTex.colorSpace = SRGBColorSpace;
  return glowTex;
}

export function rock(s = 1, color = '#5d5a6e'): Mesh {
  const m = new Mesh(new DodecahedronGeometry(0.9 * s), mat(color));
  m.position.y = 0.4 * s;
  m.scale.y = 0.7;
  return m;
}

export function log(): Group {
  const g = new Group();
  const l = new Mesh(new CylinderGeometry(0.35, 0.35, 2.4, 7), mat('#6b4426'));
  l.rotation.z = Math.PI / 2;
  l.position.y = 0.35;
  g.add(l);
  return g;
}

/* ---------------- characters ---------------- */

function faceTexture(kind: 'player' | 'wren'): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  x.fillStyle = kind === 'player' ? '#f2c79c' : '#e8b88f';
  x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#2a1e2e';
  x.fillRect(18, 22, 7, 9);
  x.fillRect(39, 22, 7, 9);
  x.strokeStyle = '#7a2e22';
  x.lineWidth = 4;
  x.beginPath();
  x.arc(32, 36, 11, 0.2 * Math.PI, 0.8 * Math.PI);
  x.stroke();
  x.fillStyle = 'rgba(240,120,110,0.45)';
  x.fillRect(12, 36, 7, 5);
  x.fillRect(45, 36, 7, 5);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export interface Avatar {
  root: Group;
  armL: Object3D; armR: Object3D; legL: Object3D; legR: Object3D;
  /** walking animation: phase advances with distance walked */
  pose(walkPhase: number, moving: boolean, t: number): void;
}

function limb(w: number, h: number, d: number, color: string, x: number, y: number): { pivot: Group } {
  const pivot = new Group();
  pivot.position.set(x, y, 0);
  const m = box(w, h, d, color, 0, -h / 2, 0);
  pivot.add(m);
  return { pivot };
}

/** The player: a blocky camper (2 studs wide, like classic block-game characters). */
export function makeAvatar(colors = { shirt: '#e8743b', trousers: '#2f3f7a', skin: '#f2c79c', hair: '#5a341e', hat: '#3f7d5a' }, kind: 'player' | 'wren' = 'player'): Avatar {
  const root = new Group();
  const body = new Group();
  root.add(body);
  const torso = box(1.6, 1.6, 0.8, colors.shirt, 0, 2.4, 0);
  body.add(torso);
  // head with a face on the front
  const faceMat = new MeshLambertMaterial({ map: faceTexture(kind) });
  const skin = mat(colors.skin);
  const head = new Mesh(new BoxGeometry(1.15, 1.15, 1.15), [skin, skin, mat(colors.hair), skin, faceMat, skin]);
  head.position.set(0, 3.8, 0);
  body.add(head);
  body.add(box(1.22, 0.32, 1.22, colors.hair, 0, 4.28, 0));
  if (kind === 'wren') {
    const def = new Group();
    def.name = 'wrenDefaultHat';
    def.add(box(1.9, 0.12, 1.9, '#7a5a2e', 0, 4.48, 0), box(1.1, 0.5, 1.1, '#8d6a36', 0, 4.75, 0));
    body.add(def);
  } else {
    body.add(box(1.25, 0.2, 0.5, colors.hat, 0, 4.35, 0.45)); // cap peak
  }
  const armL = limb(0.75, 1.6, 0.75, colors.shirt, -1.2, 3.2).pivot;
  const armR = limb(0.75, 1.6, 0.75, colors.shirt, 1.2, 3.2).pivot;
  // hands
  armL.add(box(0.7, 0.35, 0.7, colors.skin, 0, -1.7, 0));
  armR.add(box(0.7, 0.35, 0.7, colors.skin, 0, -1.7, 0));
  const legL = limb(0.78, 1.6, 0.78, colors.trousers, -0.41, 1.6).pivot;
  const legR = limb(0.78, 1.6, 0.78, colors.trousers, 0.41, 1.6).pivot;
  body.add(armL, armR, legL, legR);
  if (kind === 'wren') {
    const lamp = new Group();
    lamp.add(box(0.4, 0.5, 0.4, '#ffd166', 0, -0.25, 0, new MeshBasicMaterial({ color: '#ffd166' })), halo('#ffcf66', 1.4, 0, -0.25, 0));
    lamp.position.set(0, -2.0, 0.3);
    armR.add(lamp);
  }
  root.scale.setScalar(0.55);
  return {
    root, armL, armR, legL, legR,
    pose(phase, moving, t) {
      const swing = moving ? Math.sin(phase) * 0.8 : 0;
      armL.rotation.x = swing;
      armR.rotation.x = -swing;
      legL.rotation.x = -swing;
      legR.rotation.x = swing;
      body.position.y = moving ? Math.abs(Math.sin(phase)) * 0.15 : Math.sin(t * 2) * 0.04;
    },
  };
}

/* ---------------- the six friends ---------------- */

export function makeFriend(id: string): Group {
  const g = new Group();
  const eye = (x: number, y: number, z: number, s = 0.16) => box(s, s, 0.05, '#20152a', x, y, z);
  switch (id) {
    case 'bramble': { // hedgehog
      g.add(box(1.5, 0.9, 1.9, '#5b3a24', 0, 0.55, 0), box(0.9, 0.7, 0.7, '#d9a877', 0, 0.5, 1.1), box(0.2, 0.2, 0.2, '#20152a', 0, 0.55, 1.5));
      g.add(eye(-0.22, 0.72, 1.46), eye(0.22, 0.72, 1.46));
      for (let i = 0; i < 18; i++) {
        const sp = new Mesh(new ConeGeometry(0.16, 0.5, 4), mat('#3b2416'));
        const a = (i % 6) / 6 * Math.PI - Math.PI / 2, row = Math.floor(i / 6);
        sp.position.set(Math.sin(a) * 0.65, 0.95 + Math.cos(a) * 0.25, -0.6 + row * 0.55);
        sp.rotation.z = -a * 0.8;
        sp.rotation.x = -0.5;
        g.add(sp);
      }
      break;
    }
    case 'tock': // owl
      g.add(box(1.2, 1.6, 1.0, '#8b6b4e', 0, 0.9, 0), box(0.8, 1.0, 0.1, '#d8c19b', 0, 0.8, 0.5));
      g.add(box(0.42, 0.42, 0.1, '#fff4d6', -0.27, 1.35, 0.52), box(0.42, 0.42, 0.1, '#fff4d6', 0.27, 1.35, 0.52), eye(-0.27, 1.35, 0.58, 0.2), eye(0.27, 1.35, 0.58, 0.2));
      g.add(box(0.18, 0.22, 0.2, '#f2a93b', 0, 1.1, 0.58), box(0.25, 0.4, 0.25, '#8b6b4e', -0.42, 1.85, 0), box(0.25, 0.4, 0.25, '#8b6b4e', 0.42, 1.85, 0));
      g.add(box(0.2, 1.0, 0.8, '#6f533c', -0.7, 0.9, 0), box(0.2, 1.0, 0.8, '#6f533c', 0.7, 0.9, 0));
      break;
    case 'juniper': // fox
      g.add(box(1.0, 0.9, 1.7, '#e07a36', 0, 0.75, 0), box(0.95, 0.85, 0.85, '#e8843f', 0, 1.35, 0.95), box(0.5, 0.4, 0.45, '#fbe3c8', 0, 1.15, 1.45));
      g.add(box(0.15, 0.15, 0.15, '#20152a', 0, 1.25, 1.7), eye(-0.24, 1.5, 1.39), eye(0.24, 1.5, 1.39));
      g.add(box(0.28, 0.45, 0.2, '#e07a36', -0.3, 1.95, 0.95), box(0.28, 0.45, 0.2, '#e07a36', 0.3, 1.95, 0.95));
      g.add(box(0.45, 0.45, 1.2, '#e07a36', 0, 1.0, -1.3), box(0.48, 0.48, 0.35, '#ffffff', 0, 1.05, -1.95));
      for (const [x, z] of [[-0.35, 0.6], [0.35, 0.6], [-0.35, -0.6], [0.35, -0.6]]) g.add(box(0.25, 0.5, 0.25, '#3a2018', x, 0.25, z));
      break;
    case 'ember': { // firefly
      g.add(box(0.6, 0.6, 0.9, '#3b3a5a', 0, 1.5, 0.2), eye(-0.15, 1.6, 0.66), eye(0.15, 1.6, 0.66));
      const tail = new Mesh(new SphereGeometry(0.45, 10, 8), new MeshBasicMaterial({ color: '#fff07a' }));
      tail.position.set(0, 1.35, -0.55);
      g.add(tail, halo('#fff07a', 3.2, 0, 1.35, -0.55));
      const wingMat = new MeshBasicMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.6, side: DoubleSide });
      const wl = new Mesh(new PlaneGeometry(0.9, 0.5), wingMat); wl.position.set(-0.55, 1.85, 0); wl.rotation.set(-Math.PI / 2, 0, 0.4);
      const wr = new Mesh(new PlaneGeometry(0.9, 0.5), wingMat); wr.position.set(0.55, 1.85, 0); wr.rotation.set(-Math.PI / 2, 0, -0.4);
      wl.name = 'wing'; wr.name = 'wing';
      g.add(wl, wr);
      break;
    }
    case 'lumi': { // moth
      g.add(box(0.4, 1.2, 0.4, '#efe4d0', 0, 1.2, 0), box(0.45, 0.45, 0.45, '#efe4d0', 0, 2.0, 0.05), eye(-0.11, 2.05, 0.29, 0.1), eye(0.11, 2.05, 0.29, 0.1));
      const wm = mat('#b9a4e8');
      for (const s of [-1, 1]) {
        const w = box(1.2, 1.1, 0.08, '#b9a4e8', s * 0.8, 1.45, -0.05, wm);
        w.name = 'wing';
        g.add(w, box(0.35, 0.35, 0.1, '#f6e27a', s * 0.85, 1.6, 0.01), box(0.2, 0.2, 0.1, '#8e78d4', s * 0.95, 1.1, 0.01));
      }
      g.add(box(0.06, 0.5, 0.06, '#6b5a8e', -0.12, 2.45, 0.1), box(0.06, 0.5, 0.06, '#6b5a8e', 0.12, 2.45, 0.1));
      break;
    }
    default: // ripple the otter
      g.add(box(0.9, 1.3, 0.8, '#8a5c3b', 0, 0.8, 0), box(0.6, 0.9, 0.1, '#d9b38c', 0, 0.75, 0.42), box(0.85, 0.75, 0.75, '#8a5c3b', 0, 1.8, 0.05));
      g.add(box(0.5, 0.32, 0.2, '#d9b38c', 0, 1.65, 0.45), box(0.16, 0.12, 0.08, '#20152a', 0, 1.75, 0.56), eye(-0.2, 1.95, 0.44), eye(0.2, 1.95, 0.44));
      g.add(box(0.22, 0.22, 0.15, '#7a5134', -0.35, 2.2, 0), box(0.22, 0.22, 0.15, '#7a5134', 0.35, 2.2, 0), box(0.35, 0.3, 1.1, '#7a5134', 0, 0.2, -0.75));
  }
  g.scale.setScalar(0.85);
  return g;
}

/* ---------------- quest marker and task stations ---------------- */

export function makeBeam(color = '#ffd166'): Group {
  const g = new Group();
  const beamMat = new MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false, blending: AdditiveBlending, side: DoubleSide, fog: false });
  const beam = new Mesh(new CylinderGeometry(0.9, 1.3, 40, 12, 1, true), beamMat);
  beam.position.y = 20;
  const ring = new Mesh(new TorusGeometry(1.8, 0.12, 6, 32), new MeshBasicMaterial({ color, fog: false }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.1;
  ring.name = 'ring';
  // a bobbing down-arrow above the spot
  const arrow = new Mesh(new ConeGeometry(0.7, 1.2, 4), new MeshBasicMaterial({ color, fog: false }));
  arrow.rotation.x = Math.PI;
  arrow.position.y = 4.2;
  arrow.name = 'arrow';
  g.add(beam, ring, arrow);
  return g;
}

/** Stone plinth with a floating picture of the job (the picture is drawn onto a canvas texture). */
export function makeStation(iconCanvas: HTMLCanvasElement | null): Group {
  const g = new Group();
  g.add(box(1.8, 0.5, 1.8, '#6a6680', 0, 0.25, 0), box(1.3, 0.8, 1.3, '#7d7896', 0, 0.9, 0));
  if (iconCanvas) {
    const tex = new CanvasTexture(iconCanvas);
    tex.colorSpace = SRGBColorSpace;
    const icon = new Mesh(new PlaneGeometry(1.6, 1.6), new MeshBasicMaterial({ map: tex, transparent: true, side: DoubleSide }));
    icon.position.y = 2.4;
    icon.name = 'icon';
    g.add(icon);
  }
  return g;
}

/** The small guide arrow that floats in front of the player, pointing at the marker. */
export function makeGuideArrow(): Group {
  const g = new Group();
  const m = new MeshBasicMaterial({ color: '#ffd166', fog: false, transparent: true, opacity: 0.95 });
  const head = new Mesh(new ConeGeometry(0.35, 0.7, 4), m);
  head.rotation.x = -Math.PI / 2;
  head.position.z = -0.6;
  const shaft = new Mesh(new BoxGeometry(0.22, 0.08, 0.7), m);
  g.add(head, shaft);
  return g;
}

/* ---------------- landmarks at each friend's spot ---------------- */

function clockTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  x.fillStyle = '#fff8e6'; x.beginPath(); x.arc(64, 64, 60, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#7a5132'; x.lineWidth = 8; x.stroke();
  x.fillStyle = '#3a2a1a'; x.font = 'bold 20px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  for (let n = 1; n <= 12; n++) { const a = (n * Math.PI) / 6; x.fillText(String(n), 64 + Math.sin(a) * 44, 64 - Math.cos(a) * 44); }
  x.lineWidth = 6; x.beginPath(); x.moveTo(64, 64); x.lineTo(64, 30); x.moveTo(64, 64); x.lineTo(88, 72); x.stroke();
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}

/** Decoration around the friend's spot (built facing +z = back towards camp). */
export function makeLandmark(id: string): Group {
  const g = new Group();
  switch (id) {
    case 'bramble':
      // an arc of bushes behind and beside the spot (never between the friend and the path)
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI * 0.62 + (i / 8) * Math.PI * 1.24;
        const b = new Mesh(new DodecahedronGeometry(1.2 + (i % 3) * 0.3), mat(i % 2 ? '#2d4a2a' : '#355a30'));
        b.position.set(Math.sin(a) * 4.5, 0.9, -Math.cos(a) * 4.5 - 1);
        g.add(b);
        if (i % 2 === 0) g.add(box(0.25, 0.25, 0.25, '#d1314b', b.position.x, 1.9, b.position.z + 0.8));
      }
      break;
    case 'tock': {
      const trunk = new Mesh(new CylinderGeometry(1.6, 2.2, 9, 8), mat('#5a3a24'));
      trunk.position.set(0, 4.5, -4.5);
      const crown = new Mesh(new DodecahedronGeometry(5), mat('#1f3d33'));
      crown.position.set(0, 11, -4.5);
      const face = new Mesh(new PlaneGeometry(2.4, 2.4), new MeshLambertMaterial({ map: clockTexture() }));
      face.position.set(0, 5.5, -2.75);
      g.add(trunk, crown, face);
      break;
    }
    case 'juniper':
      for (const [x, z, r] of [[-3, -3, 0.5], [3, -2.5, -0.6], [0, -5, 0.1]] as const) {
        const post = new Group();
        post.add(box(0.3, 3, 0.3, '#6b4426', 0, 1.5, 0), box(1.8, 0.5, 0.15, '#c99a5b', 0.5, 2.5, 0), box(1.6, 0.45, 0.15, '#b5884e', -0.4, 1.9, 0));
        post.position.set(x, 0, z);
        post.rotation.y = r;
        g.add(post);
      }
      break;
    case 'ember':
      for (let i = 0; i < 40; i++) {
        const a = i * 2.4, r = 1.5 + (i % 7) * 0.8;
        g.add(box(0.25, 0.25, 0.25, ['#ff8fb1', '#ffd36b', '#9be38b', '#8fc7ff', '#ffffff'][i % 5], Math.sin(a) * r, 0.2, -Math.cos(a) * r - 1));
      }
      break;
    case 'lumi':
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI * 0.6 + (i / 5) * Math.PI * 1.2;
        const lp = lanternPost(['#ffd166', '#9fd8ff', '#ffb3cf'][i % 3]);
        lp.position.set(Math.sin(a) * 5, 0, -Math.cos(a) * 5 - 1);
        lp.rotation.y = -a;
        g.add(lp);
      }
      break;
    default: { // mirror cave
      const rockM = mat('#4a4760');
      g.add(box(2, 6, 2.5, '#4a4760', -3.2, 3, -4, rockM), box(2, 6, 2.5, '#4a4760', 3.2, 3, -4, rockM), box(8.4, 1.8, 2.8, '#4a4760', 0, 6.6, -4, rockM));
      const pool = new Mesh(new CylinderGeometry(2.6, 2.6, 0.08, 20), new MeshBasicMaterial({ color: '#7fc8ff', transparent: true, opacity: 0.75 }));
      pool.position.set(0, 0.05, -0.5);
      g.add(pool, halo('#9fd8ff', 6, 0, 0.3, -0.5));
    }
  }
  return g;
}

/* ---------------- shop decorations in 3D ---------------- */

export function makeDecor(id: string): Group {
  const g = new Group();
  switch (id) {
    case 'decor-pumpkin': {
      const p = new Mesh(new SphereGeometry(0.6, 8, 6), mat('#f08a24'));
      p.scale.y = 0.75; p.position.y = 0.45;
      g.add(p, box(0.12, 0.3, 0.12, '#4a7a2c', 0, 1.0, 0));
      const face = new MeshBasicMaterial({ color: '#ffe680' });
      g.add(box(0.14, 0.14, 0.05, '', -0.2, 0.55, 0.57, face), box(0.14, 0.14, 0.05, '', 0.2, 0.55, 0.57, face), box(0.36, 0.08, 0.05, '', 0, 0.33, 0.56, face));
      break;
    }
    case 'decor-rug':
      ['#c0392b', '#f1c40f', '#2e86c1', '#c0392b'].forEach((c, i) => g.add(box(2.6, 0.04, 0.45, c, 0, 0.05, i * 0.45 - 0.7)));
      break;
    case 'decor-flag':
      g.add(box(0.12, 3.2, 0.12, '#dddddd', 0, 1.6, 0), box(1.3, 0.8, 0.06, '#3b4fa8', 0.7, 2.75, 0), box(0.35, 0.35, 0.08, '#ffd23f', 0.7, 2.75, 0));
      break;
    case 'decor-mushrooms':
      for (let i = 0; i < 5; i++) {
        const m = new Group();
        m.add(box(0.12, 0.3, 0.12, '#f3e9d2', 0, 0.15, 0));
        const cap = new Mesh(new ConeGeometry(0.28, 0.22, 6), new MeshBasicMaterial({ color: i % 2 ? '#7ad7ff' : '#b28cff' }));
        cap.position.y = 0.38;
        m.add(cap);
        m.position.set(Math.cos(i * 1.3) * 0.9, 0, Math.sin(i * 1.3) * 0.9);
        g.add(m);
      }
      break;
    case 'decor-hammock': {
      g.add(box(0.2, 2, 0.2, '#6b4426', -1.6, 1, 0), box(0.2, 2, 0.2, '#6b4426', 1.6, 1, 0));
      const h = box(3.0, 0.08, 0.9, '#e9c46a', 0, 0.9, 0);
      g.add(h);
      break;
    }
    case 'decor-bunting':
      for (let i = 0; i < 7; i++) {
        const f = new Mesh(new ConeGeometry(0.22, 0.5, 3), new MeshBasicMaterial({ color: ['#e2475b', '#ffd23f', '#3fb6e2', '#7ad36b'][i % 4], side: DoubleSide }));
        f.rotation.x = Math.PI;
        f.position.set(i * 0.6 - 1.8, 2.6 - Math.sin((i / 6) * Math.PI) * 0.4, 0);
        g.add(f);
      }
      break;
    case 'decor-lights':
      for (let i = 0; i < 12; i++) {
        const c = ['#ff7aa2', '#ffe066', '#7ad7ff', '#9cff8a'][i % 4];
        const b = new Mesh(new SphereGeometry(0.1, 6, 4), new MeshBasicMaterial({ color: c }));
        b.position.set(i * 0.5 - 2.75, 3.0 - Math.sin((i / 11) * Math.PI) * 0.6, 0);
        g.add(b, halo(c, 0.6, b.position.x, b.position.y, 0));
      }
      break;
  }
  return g;
}

/** Hats for Wren (shop outfits) – sit on top of the blocky head. */
export function makeHat(id: string): Group | null {
  const g = new Group();
  if (id === 'outfit-woolly') g.add(box(1.25, 0.5, 1.25, '#d8434f', 0, 0.25, 0), box(1.3, 0.18, 1.3, '#f2f2f2', 0, 0, 0), box(0.35, 0.35, 0.35, '#f2f2f2', 0, 0.65, 0));
  else if (id === 'outfit-explorer') g.add(box(2.0, 0.1, 2.0, '#c9a465', 0, 0, 0), box(1.15, 0.55, 1.15, '#d8b878', 0, 0.3, 0), box(1.17, 0.12, 1.17, '#6b4a22', 0, 0.12, 0));
  else if (id === 'outfit-crown') ['#ff8fb1', '#ffd36b', '#9be38b', '#8fc7ff', '#ff8fb1', '#ffd36b'].forEach((c, i) => {
    const a = (i / 6) * Math.PI * 2;
    g.add(box(0.28, 0.28, 0.28, c, Math.sin(a) * 0.55, 0.1, Math.cos(a) * 0.55));
  });
  else return null;
  return g;
}

/** Friend accessories from the shop. */
export function makeAccessory(id: string | undefined): Group | null {
  if (id === 'friends-party') {
    const g = new Group();
    const cone = new Mesh(new ConeGeometry(0.28, 0.7, 6), mat('#ff6fa8'));
    cone.position.y = 0.35;
    g.add(cone, box(0.14, 0.14, 0.14, '#ffe066', 0, 0.75, 0));
    return g;
  }
  if (id === 'friends-bows') {
    const g = new Group();
    g.add(box(0.28, 0.28, 0.1, '#e2475b', -0.18, 0, 0), box(0.28, 0.28, 0.1, '#e2475b', 0.18, 0, 0), box(0.12, 0.12, 0.12, '#b52a3d', 0, 0, 0));
    return g;
  }
  return null;
}
