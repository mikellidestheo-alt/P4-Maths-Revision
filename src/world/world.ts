/**
 * The 3D forest camp: a third-person blocky camper explores; a glowing marker leads to each task.
 * Kept alive between screens (WebGL contexts are precious on phones) and paused while hidden.
 */
import {
  AmbientLight, BufferAttribute, BufferGeometry, CircleGeometry, Color, DirectionalLight, DynamicDrawUsage, Float32BufferAttribute,
  FogExp2, Group, HemisphereLight, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshLambertMaterial, Object3D, PerspectiveCamera,
  PlaneGeometry, PointLight, Points, PointsMaterial, Quaternion, Scene, SphereGeometry, Vector3, WebGLRenderer, AdditiveBlending,
} from 'three';
import {
  CAMP_COLLIDERS, MAP_RADIUS, PATH_END, PATH_HALF_WIDTH, TREE_RADIUS, WALK_RADIUS, along, campSpot, dist, pathAngle, routeTo,
  friendSpot, treeLayout, besidePath, PROP_RADIUS, SPOT_DIST, type Collider, type V2,
} from './layout';
import { box, campfire, glowTexture, halo, lanternPost, log, makeAccessory, makeAvatar, makeBeam, makeCamper, makeDecor, makeFriend, makeGuideArrow, makeHat, makeLandmark, makeStation, mat, rock, tent, treeGeometries, type Avatar } from './models';
import type { Objective } from './quest';
import { lookKey, type Look } from '../game/look';
import { makeRng } from '../engine/rng';

export interface WorldState {
  objective: Objective;
  /** night shown on the map (current run or next night) */
  night: number | null;
  /** tonight's finished tasks, and the ones that can be started now (more than one with Unlock All) */
  doneJobs: string[];
  openJobs: string[];
  rescued: string[]; // friend ids at camp
  friendIds: string[]; // friend id per night (index 0 = night 1)
  dawn: boolean;
  spook: 'cosy' | 'mild' | 'spooky';
  lantern: string;
  decor: string[];
  /** the player's camper: boy / girl and shop clothes */
  look: Look;
  outfit?: string;
  friendAccessory?: string;
  iconFor(jobId: string): HTMLCanvasElement | null;
  jobsOfNight(n: number): string[];
}

export interface WorldEvents {
  onNear(near: boolean): void;
  onDistance(m: number): void;
  onArrive(): void;
}

const tmpM = new Matrix4();
const tmpQ = new Quaternion();
const tmpS = new Vector3();
const tmpP = new Vector3();

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export class World {
  container = document.createElement('div');
  renderer: WebGLRenderer;
  scene = new Scene();
  camera = new PerspectiveCamera(55, 1, 0.1, 400);
  avatar: Avatar;
  private lookId = '';
  pos: V2 = { x: 0, z: 6.5 };
  heading = Math.PI; // facing -z (towards night 1's path)
  camYaw = 0;
  camPitch = 0.42;
  camDist = 8.5;
  private userZoomed = false;
  walkPhase = 0;
  moving = false;
  keys = new Set<string>();
  joy = { x: 0, y: 0 };
  auto: V2[] | null = null;
  autoGoal: V2 | null = null;
  events: WorldEvents = { onNear: () => {}, onDistance: () => {}, onArrive: () => {} };
  state: WorldState | null = null;
  /** title-screen mode: the camera slowly circles the camp and the camper stands still */
  attract = false;
  private running = false;
  private raf = 0;
  private last = 0;
  private t = 0;
  private nearNow = false;
  /** open task signs tonight (one normally; all unfinished ones with Unlock All) */
  private jobSpots: { jobId: string; point: V2 }[] = [];
  /** the open task the camper is standing at, if any (otherwise "near" means the marker) */
  nearJob: string | null = null;
  private grid = new Map<string, Collider[]>();
  private colliders: Collider[] = [...CAMP_COLLIDERS];
  private dynColliders: Collider[] = [];
  private dynamic = new Group(); // quest-dependent things (stations, beam, friends)
  private beam = makeBeam();
  private beamLight = new PointLight('#ffd166', 30, 14, 2);
  private guide = makeGuideArrow();
  private flames: Mesh[] = [];
  private fireLight = new PointLight('#ff9a3c', 70, 30, 2);
  private fireflies!: Points;
  private ffBase: Float32Array = new Float32Array();
  private hemi = new HemisphereLight('#7b6cc9', '#1d2b2b', 1.1);
  private moon = new DirectionalLight('#c3cbff', 1.0);
  private eyes: Object3D[] = [];
  private friendNodes: Group[] = [];
  private wren: Avatar;
  private wrenHat = new Group();
  private decorGroup = new Group();
  private dragging: { id: number; x: number; y: number } | null = null;
  private lastDistReport = -1;
  private stuckTime = 0;
  private lastPos: V2 = { x: 0, z: 0 };

  constructor() {
    this.container.className = 'world-canvas';
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.renderer = new WebGLRenderer({ antialias: (window.devicePixelRatio || 1) < 2, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(dpr);
    this.renderer.domElement.setAttribute('aria-label', 'The forest camp. Use the joystick or arrow keys to walk.');
    this.renderer.domElement.setAttribute('role', 'img');
    this.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.addEventListener('webglcontextlost', (e) => e.preventDefault());
    this.scene.background = new Color('#17143a');
    this.scene.fog = new FogExp2('#17143a', 0.024);
    this.scene.add(this.hemi, new AmbientLight('#403a70', 0.6));
    this.moon.position.set(-30, 60, -40);
    this.scene.add(this.moon);
    this.buildGround();
    this.buildTrees();
    this.buildCamp();
    this.buildSky();
    for (let n = 1; n <= 6; n++) this.buildPathDecor(n);
    this.avatar = makeAvatar();
    this.avatar.root.rotation.y = this.heading;
    this.scene.add(this.avatar.root);
    this.lookId = '';
    this.wren = makeAvatar({ shirt: '#3f7d5a', trousers: '#3a3550', skin: '#e8b88f', hair: '#6b3b22', hat: '#7a5a2e' }, 'wren');
    this.wren.root.position.set(2.6, 0, -3.2);
    this.wren.root.rotation.y = Math.atan2(-2.6, 9.7); // looking at the camper
    this.scene.add(this.wren.root);
    this.wrenHat.position.set(0, 4.45, 0);
    this.wren.root.children[0].add(this.wrenHat);
    this.scene.add(this.decorGroup);
    this.scene.add(this.dynamic, this.beam, this.beamLight, this.guide);
    this.beam.visible = false;
    this.bindInput();
    new ResizeObserver(() => this.resize()).observe(this.container);
  }

  /* ---------------- building the world ---------------- */

  private buildGround() {
    const geo = new CircleGeometry(MAP_RADIUS + 60, 72, 0, Math.PI * 2);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.getAttribute('position');
    const colors: number[] = [];
    const rng = makeRng(5);
    const a = new Color('#22412f'), b = new Color('#1a3326'), c = new Color();
    for (let i = 0; i < pos.count; i++) {
      c.copy(a).lerp(b, rng.next());
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
    const ground = new Mesh(geo, new MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    this.scene.add(ground);
    // camp clearing and paths (dirt)
    const dirt = new MeshLambertMaterial({ color: '#5b4a35' });
    const clearing = new Mesh(new CircleGeometry(14, 32), new MeshLambertMaterial({ color: '#4d5a36' }));
    clearing.rotation.x = -Math.PI / 2;
    clearing.position.y = 0.02;
    this.scene.add(clearing);
    for (let n = 1; n <= 6; n++) {
      const L = PATH_END - 8;
      const strip = new Mesh(new PlaneGeometry(PATH_HALF_WIDTH * 1.3, L), dirt);
      strip.rotation.x = -Math.PI / 2;
      const mid = along(n, 8 + L / 2);
      strip.position.set(mid.x, 0.03, mid.z);
      strip.rotation.z = -pathAngle(n);
      this.scene.add(strip);
    }
  }

  private buildTrees() {
    const layout = treeLayout();
    const { trunk, canopy } = treeGeometries();
    const tMesh = new InstancedMesh(trunk, mat('#4a2f1e'), layout.length);
    const cMesh = new InstancedMesh(canopy, new MeshLambertMaterial({ flatShading: true }), layout.length);
    const greens = ['#1f4a3a', '#24523f', '#1b4033', '#2a5a45', '#183a30'].map((h) => new Color(h));
    layout.forEach((t, i) => {
      tmpQ.setFromAxisAngle(new Vector3(0, 1, 0), t.hue * 6.28);
      tmpS.set(t.s, t.s * (0.9 + t.hue * 0.3), t.s);
      tmpM.compose(tmpP.set(t.x, 0, t.z), tmpQ, tmpS);
      tMesh.setMatrixAt(i, tmpM);
      cMesh.setMatrixAt(i, tmpM);
      cMesh.setColorAt(i, greens[Math.floor(t.hue * greens.length) % greens.length]);
      this.addCollider({ x: t.x, z: t.z, r: TREE_RADIUS * Math.min(1.2, t.s) });
    });
    tMesh.instanceMatrix.needsUpdate = true;
    cMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(tMesh, cMesh);
    // friendly glowing eyes in the trees (more when spookier) – positions chosen among trees
    const rng = makeRng(77);
    for (let i = 0; i < 8; i++) {
      const t = layout[Math.floor(rng.next() * layout.length)];
      const pair = new Group();
      const m = new MeshBasicMaterial({ color: '#ffe680', fog: false });
      pair.add(box(0.22, 0.14, 0.05, '', -0.2, 0, 0, m), box(0.22, 0.14, 0.05, '', 0.2, 0, 0, m));
      pair.position.set(t.x * 0.98, 1.6, t.z * 0.98);
      pair.lookAt(0, 1.6, 0);
      pair.userData.blink = rng.next() * 6;
      this.eyes.push(pair);
      this.scene.add(pair);
    }
  }

  private buildCamp() {
    const tn = tent();
    tn.position.set(-4.2, 0, 3.4);
    tn.rotation.y = 0.9;
    const fire = campfire();
    this.flames = fire.flames;
    this.fireLight.position.set(0, 2.2, 0);
    const post = lanternPost('#ffd166');
    post.position.set(3.6, 0, 3.8);
    post.name = 'campLantern';
    this.scene.add(tn, fire.group, this.fireLight, post);
    for (const [x, z, r] of [[-2.6, -2.2, 0.6], [2.4, 1.6, -0.5]] as const) {
      const l = log();
      l.position.set(x, 0, z);
      l.rotation.y = r;
      this.scene.add(l);
    }
    // rocks and mushrooms around the clearing edge (between paths)
    const rng = makeRng(9);
    for (let n = 1; n <= 6; n++) {
      const a = pathAngle(n) + Math.PI / 6;
      for (let k = 0; k < 3; k++) {
        const r = rock(0.6 + rng.next() * 0.6);
        const rr = 12 + rng.next() * 2.5;
        r.position.set(Math.sin(a + (k - 1) * 0.12) * rr, r.position.y, -Math.cos(a + (k - 1) * 0.12) * rr);
        this.scene.add(r);
      }
    }
  }

  private buildSky() {
    const n = 500;
    const p = new Float32Array(n * 3);
    const rng = makeRng(3);
    for (let i = 0; i < n; i++) {
      const th = rng.next() * Math.PI * 2, ph = 0.15 + rng.next() * 1.2;
      p[i * 3] = Math.cos(th) * Math.cos(ph) * 250;
      p[i * 3 + 1] = Math.sin(ph) * 250;
      p[i * 3 + 2] = Math.sin(th) * Math.cos(ph) * 250;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(p, 3));
    const stars = new Points(g, new PointsMaterial({ color: '#ffffff', size: 1.4, sizeAttenuation: false, fog: false }));
    stars.name = 'stars';
    this.scene.add(stars);
    const moon = new Mesh(new SphereGeometry(9, 16, 12), new MeshBasicMaterial({ color: '#fff3c4', fog: false }));
    moon.position.set(-90, 120, -170);
    moon.name = 'moonBall';
    this.scene.add(moon);
    // fireflies drifting around the camp and paths
    const m = 140;
    this.ffBase = new Float32Array(m * 3);
    for (let i = 0; i < m; i++) {
      const a = rng.next() * Math.PI * 2, r = 3 + rng.next() * 70;
      this.ffBase[i * 3] = Math.sin(a) * r;
      this.ffBase[i * 3 + 1] = 0.6 + rng.next() * 2.5;
      this.ffBase[i * 3 + 2] = Math.cos(a) * r;
    }
    const fg = new BufferGeometry();
    fg.setAttribute('position', new BufferAttribute(this.ffBase.slice(), 3).setUsage(DynamicDrawUsage));
    this.fireflies = new Points(fg, new PointsMaterial({ color: '#f7ff9c', size: 0.6, map: glowTexture(), transparent: true, depthWrite: false, blending: AdditiveBlending }));
    this.scene.add(this.fireflies);
  }

  private buildPathDecor(n: number) {
    // lantern posts every so often along each path, and the friend's landmark at the end
    for (const d of [16, 31, 45, 58, 69]) {
      const side = d % 2 ? 1 : -1;
      const p = along(n, d);
      const a = pathAngle(n);
      const lp = lanternPost('#ffd166');
      lp.position.set(p.x + Math.cos(a) * side * (PATH_HALF_WIDTH + 0.4), 0, p.z + Math.sin(a) * side * (PATH_HALF_WIDTH + 0.4));
      lp.rotation.y = -a + (side > 0 ? Math.PI : 0);
      this.scene.add(lp);
      this.addCollider({ x: lp.position.x, z: lp.position.z, r: 0.5 });
    }
  }

  /** Called once the friend ids are known (state set) to place landmarks. */
  private landmarksBuilt = false;
  private buildLandmarks(friendIds: string[]) {
    if (this.landmarksBuilt) return;
    this.landmarksBuilt = true;
    friendIds.forEach((id, i) => {
      const n = i + 1;
      const lm = makeLandmark(id);
      const p = friendSpot(n);
      lm.position.set(p.x, 0, p.z);
      lm.rotation.y = -pathAngle(n); // +z of the landmark faces camp
      this.scene.add(lm);
    });
  }

  private addCollider(c: Collider) {
    this.colliders.push(c);
    const key = `${Math.floor(c.x / 6)},${Math.floor(c.z / 6)}`;
    const list = this.grid.get(key) ?? [];
    list.push(c);
    this.grid.set(key, list);
  }

  private nearby(p: V2): Collider[] {
    const out: Collider[] = [...CAMP_COLLIDERS, ...this.dynColliders];
    const cx = Math.floor(p.x / 6), cz = Math.floor(p.z / 6);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const l = this.grid.get(`${cx + dx},${cz + dz}`);
      if (l) out.push(...l);
    }
    return out;
  }

  /* ---------------- quest-dependent objects ---------------- */

  /** Rebuild the camper when the boy/girl choice or the clothes change. */
  setLook(look: Look) {
    const key = lookKey(look);
    if (key === this.lookId) return;
    this.lookId = key;
    const old = this.avatar;
    this.avatar = makeCamper(look);
    this.avatar.root.position.copy(old.root.position);
    this.avatar.root.rotation.y = old.root.rotation.y;
    this.scene.remove(old.root);
    this.scene.add(this.avatar.root);
  }

  setState(s: WorldState) {
    this.state = s;
    this.setLook(s.look);
    this.buildLandmarks(s.friendIds);
    this.dynamic.clear();
    this.dynColliders = [];
    this.friendNodes = [];
    const o = s.objective;
    // stations for tonight: done ones (dimmed) and open ones (spinning); locked ones are hidden
    this.jobSpots = [];
    if (s.night) {
      const jobs = s.jobsOfNight(s.night);
      jobs.forEach((jobId, i) => {
        const isCurrent = s.openJobs.includes(jobId);
        if (isCurrent) this.jobSpots.push({ jobId, point: along(s.night!, [SPOT_DIST.task1, SPOT_DIST.task2, SPOT_DIST.task3][i]) });
        if (s.doneJobs.includes(jobId) || isCurrent) {
          const st = makeStation(s.iconFor(jobId));
          const p = besidePath(s.night!, [SPOT_DIST.task1, SPOT_DIST.task2, SPOT_DIST.task3][i]);
          st.position.set(p.x, 0, p.z);
          this.dynColliders.push({ x: p.x, z: p.z, r: PROP_RADIUS });
          st.userData.spin = isCurrent;
          if (!isCurrent) st.add(box(0.6, 0.6, 0.6, '', 0, 1.6, 0, new MeshBasicMaterial({ color: '#7be0a6' })));
          // other open signs (Unlock All) glow, so they can be spotted without the marker
          else if (!(o.kind === 'job' && o.jobId === jobId)) st.add(halo('#ffd166', 6, 0, 1.8, 0));
          this.dynamic.add(st);
        }
      });
      // campfire spot: unlit until the recap is done
      if (o.kind === 'recap' || o.kind === 'friend') {
        const f = campfire();
        const p = besidePath(s.night, SPOT_DIST.fire);
        f.group.position.set(p.x, 0, p.z);
        this.dynColliders.push({ x: p.x, z: p.z, r: PROP_RADIUS });
        f.group.scale.setScalar(0.7);
        f.flames.forEach((m) => (m.visible = o.kind === 'friend'));
        f.group.userData.flames = f.flames;
        this.dynamic.add(f.group);
      }
      // the friend only appears at the end of the path when everything else is done
      if (o.kind === 'friend') {
        const id = s.friendIds[s.night - 1];
        const fr = makeFriend(id);
        const p = friendSpot(s.night);
        fr.position.set(p.x, 0, p.z);
        fr.rotation.y = -pathAngle(s.night);
        fr.userData.appear = 0;
        fr.add(halo('#ffe9a8', 5, 0, 1.2, 0));
        this.dynamic.add(fr);
        this.friendNodes.push(fr);
      }
    }
    this.dressCamp(s);
    // rescued friends wait round the camp fire
    s.rescued.forEach((id) => {
      const i = s.friendIds.indexOf(id);
      const fr = makeFriend(id);
      const p = campSpot(i);
      fr.position.set(p.x, 0, p.z);
      fr.lookAt(0, 0, 0);
      fr.scale.multiplyScalar(0.8);
      fr.userData.hop = i;
      const acc = makeAccessory(s.friendAccessory);
      if (acc) {
        const top: Record<string, [number, number]> = { bramble: [1.05, 0.9], tock: [2.05, 0], juniper: [1.8, 0.95], ember: [1.85, 0.2], lumi: [2.25, 0.05], ripple: [2.2, 0.05] };
        const [y, z] = top[id] ?? [2, 0];
        acc.position.set(0, y, z);
        fr.add(acc);
      }
      this.dynamic.add(fr);
      this.friendNodes.push(fr);
    });
    // marker
    if (o.kind === 'done') {
      this.beam.visible = false;
      this.beamLight.visible = false;
      this.guide.visible = false;
    } else {
      const color = o.kind === 'friend' ? '#ff9ec7' : o.kind === 'recap' ? '#ff9a3c' : '#ffd166';
      this.beam.children.forEach((c) => ((c as Mesh).material as MeshBasicMaterial).color.set(color));
      ((this.guide.children[0] as Mesh).material as MeshBasicMaterial).color.set(color);
      this.beam.position.set(o.point.x, 0, o.point.z);
      this.beamLight.position.set(o.point.x, 3, o.point.z);
      this.beamLight.color.set(color);
      this.beam.visible = this.beamLight.visible = this.guide.visible = true;
    }
    this.setDawn(s.dawn);
    this.eyes.forEach((e, i) => (e.visible = !s.dawn && i < (s.spook === 'cosy' ? 2 : s.spook === 'mild' ? 4 : 8)));
    this.nearNow = false;
    this.nearJob = null;
    this.events.onNear(false);
    this.lastDistReport = -1;
  }

  /** Shop items: lantern colour, decorations round the camp, Wren's hat. */
  private dressCamp(s: WorldState) {
    const colours: Record<string, string> = { 'lantern-gold': '#ffd166', 'lantern-blue': '#9fd8ff', 'lantern-pink': '#ffb3cf', 'lantern-green': '#c4ff8a' };
    const lc = colours[s.lantern] ?? '#ffd166';
    this.scene.traverse((o) => {
      if (o.name === 'lamp') ((o as Mesh).material as MeshBasicMaterial).color.set(lc);
    });
    this.decorGroup.clear();
    const spots: Record<string, [number, number, number]> = {
      'decor-pumpkin': [1.8, -1.6, 0.4], 'decor-rug': [0.4, 3.0, 0.2], 'decor-flag': [-6.6, 0.2, 0], 'decor-mushrooms': [5.6, -3.6, 0],
      'decor-hammock': [-5.2, -3.0, 0.9], 'decor-bunting': [-4.2, 3.4, 0.9], 'decor-lights': [0.4, 4.6, 0.1],
    };
    for (const id of s.decor) {
      const at = spots[id];
      if (!at) continue;
      const m = makeDecor(id);
      m.position.set(at[0], 0, at[1]);
      m.rotation.y = at[2];
      this.decorGroup.add(m);
    }
    this.wrenHat.clear();
    const hat = s.outfit ? makeHat(s.outfit) : null;
    if (hat) this.wrenHat.add(hat);
    this.wren.root.children[0].traverse((o) => { if (o.name === 'wrenDefaultHat') o.visible = !hat; });
  }

  private setDawn(on: boolean) {
    const sky = on ? '#d99aa6' : '#17143a';
    (this.scene.background as Color).set(sky);
    (this.scene.fog as FogExp2).color.set(sky);
    (this.scene.fog as FogExp2).density = on ? 0.012 : 0.024;
    this.hemi.color.set(on ? '#ffd9b0' : '#7b6cc9');
    this.hemi.intensity = on ? 1.6 : 1.1;
    this.moon.color.set(on ? '#ffd27a' : '#c3cbff');
    const stars = this.scene.getObjectByName('stars');
    if (stars) stars.visible = !on;
  }

  /* ---------------- input ---------------- */

  private bindInput() {
    const el = this.renderer.domElement;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', (e) => {
      if (this.dragging) return;
      this.dragging = { id: e.pointerId, x: e.clientX, y: e.clientY };
      try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.dragging || e.pointerId !== this.dragging.id) return;
      const dx = e.clientX - this.dragging.x, dy = e.clientY - this.dragging.y;
      this.dragging.x = e.clientX;
      this.dragging.y = e.clientY;
      this.camYaw -= dx * 0.008;
      this.camPitch = Math.max(0.15, Math.min(1.1, this.camPitch + dy * 0.005));
    });
    const end = (e: PointerEvent) => { if (this.dragging?.id === e.pointerId) this.dragging = null; };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.userZoomed = true;
      this.camDist = Math.max(5, Math.min(16, this.camDist + Math.sign(e.deltaY)));
    }, { passive: false });
  }

  keyDown(e: KeyboardEvent): boolean {
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
      this.keys.add(k);
      this.auto = null;
      return true;
    }
    return false;
  }
  keyUp(e: KeyboardEvent) {
    this.keys.delete(e.key.toLowerCase());
  }

  /* ---------------- auto-walk ---------------- */

  startAutoWalk(): boolean {
    const o = this.state?.objective;
    if (!o || o.kind === 'done') return false;
    this.auto = routeTo(this.pos, o.night, o.dist);
    this.autoGoal = o.point;
    this.stuckTime = 0;
    return true;
  }
  stopAutoWalk() {
    this.auto = null;
  }
  get autoWalking() {
    return !!this.auto;
  }

  /* ---------------- loop ---------------- */

  mount(parent: HTMLElement) {
    parent.appendChild(this.container);
    this.resize();
    this.snapCamera();
    if (!this.running) {
      this.running = true;
      this.last = performance.now();
      const loop = (now: number) => {
        if (!this.running) return;
        const dt = Math.min(0.1, (now - this.last) / 1000);
        this.last = now;
        this.update(dt);
        this.renderer.render(this.scene, this.camera);
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }
  }

  unmount() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.keys.clear();
    this.joy.x = this.joy.y = 0;
    this.auto = null;
    this.container.remove();
  }

  private snapCamera() {
    if (this.attract) {
      this.camera.position.set(Math.sin(this.t * 0.07) * 19, 8.5, Math.cos(this.t * 0.07) * 19);
      this.camera.lookAt(0, 1.6, 0);
      return;
    }
    const cy = Math.sin(this.camPitch) * this.camDist, ch = Math.cos(this.camPitch) * this.camDist;
    this.camera.position.set(this.pos.x + Math.sin(this.camYaw) * ch, 1.6 + cy, this.pos.z + Math.cos(this.camYaw) * ch);
    this.camera.lookAt(this.pos.x, 2, this.pos.z);
  }

  private resize() {
    const w = this.container.clientWidth || window.innerWidth, h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    // keep a similar sideways view on tall phone screens: widen the vertical angle and step back a bit
    const vfov = aspect >= 1 ? 55 : Math.min(78, Math.max(55, (2 * Math.atan(Math.tan((31 * Math.PI) / 180) / aspect) * 180) / Math.PI));
    this.camera.fov = vfov;
    if (!this.userZoomed) this.camDist = aspect >= 1 ? 8.5 : 11;
    this.camera.updateProjectionMatrix();
  }

  private update(dt: number) {
    this.t += dt;
    // --- input direction (camera relative) ---
    let ix = this.attract ? 0 : this.joy.x, iy = this.attract ? 0 : -this.joy.y;
    if (this.attract) this.auto = null;
    if (!this.attract && (this.keys.has('w') || this.keys.has('arrowup'))) iy += 1;
    if (!this.attract) {
      if (this.keys.has('s') || this.keys.has('arrowdown')) iy -= 1;
      if (this.keys.has('a') || this.keys.has('arrowleft')) ix -= 1;
      if (this.keys.has('d') || this.keys.has('arrowright')) ix += 1;
    }
    let mx = 0, mz = 0;
    const len = Math.hypot(ix, iy);
    if (len > 0.08) {
      this.auto = null;
      const fx = -Math.sin(this.camYaw), fz = -Math.cos(this.camYaw);
      const rx = Math.cos(this.camYaw), rz = -Math.sin(this.camYaw);
      const k = Math.min(1, len) / len;
      mx = (fx * iy + rx * ix) * k;
      mz = (fz * iy + rz * ix) * k;
    } else if (this.auto && this.auto.length) {
      const wp = this.auto[0];
      const dx = wp.x - this.pos.x, dz = wp.z - this.pos.z, d = Math.hypot(dx, dz);
      const last = this.auto.length === 1;
      if (d < (last ? 2.2 : 0.9)) {
        this.auto.shift();
        if (!this.auto.length) {
          this.auto = null;
          this.events.onArrive();
        }
      } else {
        mx = dx / d;
        mz = dz / d;
        // camera eases round behind the walker
        const want = Math.atan2(-mx, -mz);
        let dy = want - this.camYaw;
        while (dy > Math.PI) dy -= 2 * Math.PI;
        while (dy < -Math.PI) dy += 2 * Math.PI;
        this.camYaw += dy * Math.min(1, dt * 2.2);
      }
    }
    const speed = this.auto ? 8 : 7;
    this.moving = Math.hypot(mx, mz) > 0.01;
    if (this.moving) {
      const sp = speed * Math.min(1, Math.hypot(mx, mz));
      this.pos.x += mx * sp * dt;
      this.pos.z += mz * sp * dt;
      this.heading = Math.atan2(mx, mz);
      this.walkPhase += sp * dt * 1.6;
      this.collide();
      // stuck while auto-walking? (shouldn't happen on paths) – give up so the child isn't left marching on the spot
      if (this.auto) {
        const moved = dist(this.pos, this.lastPos);
        this.stuckTime = moved < sp * dt * 0.2 ? this.stuckTime + dt : 0;
        if (this.stuckTime > 1.5) this.auto = routeTo(this.pos, this.state!.objective.kind === 'done' ? 1 : (this.state!.objective as { night: number }).night, (this.state!.objective as { dist: number }).dist);
      }
    }
    this.lastPos = { ...this.pos };
    this.avatar.root.position.set(this.pos.x, 0, this.pos.z);
    // turn smoothly
    let dh = this.heading - this.avatar.root.rotation.y;
    while (dh > Math.PI) dh -= 2 * Math.PI;
    while (dh < -Math.PI) dh += 2 * Math.PI;
    this.avatar.root.rotation.y += dh * Math.min(1, dt * 12);
    this.avatar.pose(this.walkPhase, this.moving, this.t);
    this.wren.pose(0, false, this.t + 1);
    // --- camera ---
    const cy = Math.sin(this.camPitch) * this.camDist, ch = Math.cos(this.camPitch) * this.camDist;
    const target = new Vector3(this.pos.x, 2.0, this.pos.z);
    const want = new Vector3(this.pos.x + Math.sin(this.camYaw) * ch, 1.6 + cy, this.pos.z + Math.cos(this.camYaw) * ch);
    if (this.attract) {
      const a = this.t * 0.07;
      want.set(Math.sin(a) * 19, 8.5, Math.cos(a) * 19);
      target.set(0, 1.6, 0);
    }
    this.camera.position.lerp(want, Math.min(1, dt * (this.attract ? 1.5 : 8)));
    this.camera.lookAt(target);
    // --- animate things ---
    this.flames.forEach((f, i) => { f.scale.y = 1 + Math.sin(this.t * (9 + i * 3)) * 0.12; f.scale.x = 1 - Math.sin(this.t * (7 + i * 2)) * 0.06; });
    this.fireLight.intensity = 70 + Math.sin(this.t * 13) * 8 + Math.sin(this.t * 7.3) * 6;
    const ff = this.fireflies.geometry.getAttribute('position') as BufferAttribute;
    for (let i = 0; i < ff.count; i++) {
      ff.setXYZ(i, this.ffBase[i * 3] + Math.sin(this.t * 0.6 + i) * 0.8, this.ffBase[i * 3 + 1] + Math.sin(this.t * 0.9 + i * 1.7) * 0.4, this.ffBase[i * 3 + 2] + Math.cos(this.t * 0.5 + i * 0.7) * 0.8);
    }
    ff.needsUpdate = true;
    for (const e of this.eyes) {
      const ph = (this.t + e.userData.blink) % 6;
      e.scale.y = ph > 5.85 ? 0.1 : 1;
    }
    this.beam.visible = this.beamLight.visible = !this.attract && !!this.state && this.state.objective.kind !== 'done';
    this.beam.getObjectByName('arrow')!.position.y = 4.2 + Math.sin(this.t * 3) * 0.35;
    this.beam.getObjectByName('ring')!.scale.setScalar(1 + Math.sin(this.t * 3) * 0.08);
    this.dynamic.children.forEach((c) => {
      const icon = c.getObjectByName('icon');
      if (icon) icon.rotation.y = this.t * 1.2;
      if (c.userData.hop !== undefined) c.position.y = Math.abs(Math.sin(this.t * 2 + c.userData.hop)) * 0.25;
      if (c.userData.appear !== undefined) {
        c.userData.appear = Math.min(1, c.userData.appear + dt * 1.5);
        const a = c.userData.appear;
        c.scale.setScalar(0.85 * (a < 1 ? a * (1.2 - 0.2 * a) : 1));
        c.position.y = Math.abs(Math.sin(this.t * 2.5)) * 0.3;
      }
      c.traverse((o) => { if (o.name === 'wing') o.rotation.y = Math.sin(this.t * 18) * 0.4; });
    });
    this.scene.traverseVisible((o) => { if (o.userData.billboard) o.quaternion.copy(this.camera.quaternion); });
    // --- guide arrow + distance + near check ---
    const o = this.state?.objective;
    this.guide.visible = !this.attract && this.guide.visible;
    if (o && o.kind !== 'done' && !this.attract) {
      const dx = o.point.x - this.pos.x, dz = o.point.z - this.pos.z, d = Math.hypot(dx, dz);
      this.guide.position.set(this.pos.x + (dx / (d || 1)) * 1.6, 0.35, this.pos.z + (dz / (d || 1)) * 1.6);
      this.guide.rotation.y = Math.atan2(-dx, -dz);
      this.guide.visible = d > 4;
      const rep = Math.round(d);
      if (rep !== this.lastDistReport) {
        this.lastDistReport = rep;
        this.events.onDistance(rep);
      }
      // standing at the marker, or (with Unlock All) at any other open task sign
      let nearJob: string | null = null;
      let best = 3.4;
      for (const j of this.jobSpots) {
        const dj = Math.hypot(j.point.x - this.pos.x, j.point.z - this.pos.z);
        if (dj < best) { best = dj; nearJob = j.jobId; }
      }
      const near = d < 3.4 || !!nearJob;
      if (near !== this.nearNow || nearJob !== this.nearJob) {
        this.nearNow = near;
        this.nearJob = nearJob;
        this.events.onNear(near);
      }
    }
  }

  private collide() {
    const pr = 0.6;
    for (let iter = 0; iter < 2; iter++) {
      for (const c of this.nearby(this.pos)) {
        const dx = this.pos.x - c.x, dz = this.pos.z - c.z, d = Math.hypot(dx, dz), min = c.r + pr;
        if (d < min && d > 1e-6) {
          this.pos.x = c.x + (dx / d) * min;
          this.pos.z = c.z + (dz / d) * min;
        }
      }
    }
    const r = Math.hypot(this.pos.x, this.pos.z);
    if (r > WALK_RADIUS) {
      this.pos.x *= WALK_RADIUS / r;
      this.pos.z *= WALK_RADIUS / r;
    }
  }

  /** Test hook. */
  teleport(x: number, z: number) {
    this.pos = { x, z };
    this.auto = null;
  }

  dispose() {
    this.unmount();
    this.renderer.dispose();
  }
}

