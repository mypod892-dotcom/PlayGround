import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createWorld } from './world.js';
import { createWeapon } from './weapon.js';
import { createEnemySystem } from './enemies.js';
import { createAudio } from './audio.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = THREE.MathUtils.damp;

// ---------------- RENDERER ----------------

function createEnvironment(renderer) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#020504');
  grad.addColorStop(0.42, '#0c1a19');
  grad.addColorStop(0.55, '#182724');
  grad.addColorStop(1, '#050909');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);
  const spots = [
    [80, 112, 90, 'rgba(255,104,45,0.6)'],
    [256, 92, 120, 'rgba(96,218,228,0.32)'],
    [420, 120, 100, 'rgba(255,145,58,0.38)'],
    [335, 60, 70, 'rgba(255,255,255,0.13)'],
  ];
  for (const [x, y, r, color] of spots) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 24; i++) {
    ctx.fillStyle = i % 3 === 0 ? 'rgba(255,110,40,0.11)' : 'rgba(130,230,235,0.055)';
    ctx.fillRect(0, 18 + i * 10, 512, 1.3);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const env = pmrem.fromEquirectangular(tex).texture;
  tex.dispose();
  pmrem.dispose();
  return env;
}


const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;
renderer.shadowMap.enabled = false;
renderer.info.autoReset = false;

const scene = new THREE.Scene();
scene.environment = createEnvironment(renderer);
const camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.045, 160);
camera.rotation.order = 'YXZ';
scene.add(camera);

const world = createWorld(scene);
optimizeStatic(scene);
const weapon = createWeapon(camera);
weapon.gun.scale.setScalar(0.46);
weapon.root.visible = false;
const enemies = createEnemySystem(scene);
const audio = createAudio();

function optimizeStatic(root) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  const candidates = [];
  root.traverse((o) => {
    if (!o.isMesh || o.userData.dynamic) return;
    let p = o.parent;
    while (p) {
      if (p.userData.dynamic) return;
      p = p.parent;
    }
    const mat = o.material;
    if (!mat || Array.isArray(mat) || mat.transparent || mat.isShaderMaterial || mat.isLineBasicMaterial) return;
    const key = mat.uuid;
    if (!buckets.has(key)) buckets.set(key, { mat, geos: [], meshes: [] });
    const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    geo.applyMatrix4(o.matrixWorld);
    buckets.get(key).geos.push(geo);
    buckets.get(key).meshes.push(o);
    candidates.push(o);
  });
  for (const { mat, geos, meshes } of buckets.values()) {
    if (meshes.length < 2) {
      for (const g of geos) g.dispose();
      continue;
    }
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    root.add(mesh);
    for (const m of meshes) {
      m.parent?.remove(m);
      m.geometry.dispose();
    }
  }
}

// ---------------- POST PROCESSING ----------------

const composer = new EffectComposer(renderer);
composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
composer.setSize(window.innerWidth, window.innerHeight);
composer.addPass(new RenderPass(scene, camera));

const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.32, 0.3, 1.6);
composer.addPass(bloom);
bloom.setSize(window.innerWidth * 0.4, window.innerHeight * 0.4);

const finalShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    pressure: { value: 0.63 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform vec2 resolution;
    uniform float pressure;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    void main() {
      vec2 uv = vUv;
      vec2 centered = uv - 0.5;
      float dist = length(centered);
      vec2 dir = normalize(centered + vec2(0.0001));
      float aberration = (0.00045 + pressure * 0.0009) * pow(dist, 1.4);
      vec3 color;
      color.r = texture2D(tDiffuse, uv + dir * aberration).r;
      color.g = texture2D(tDiffuse, uv).g;
      color.b = texture2D(tDiffuse, uv - dir * aberration).b;

      float vig = 1.0 - smoothstep(0.42, 0.94, dist) * (0.42 + pressure * 0.2);
      color *= vig;

      float grain = hash(uv * resolution.xy + fract(time) * 93.7) - 0.5;
      color += grain * (0.016 + pressure * 0.012);

      float scan = sin(uv.y * resolution.y * 1.35) * 0.5 + 0.5;
      color *= 1.0 - scan * 0.012;

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};
const finalPass = new ShaderPass(finalShader);
composer.addPass(finalPass);
composer.addPass(new OutputPass());

// ---------------- UI ----------------

const els = {
  boot: $('boot'),
  bootStatus: $('bootStatus'),
  menu: $('menu'),
  startBtn: $('startBtn'),
  audioBtn: $('audioBtn'),
  audioLabel: $('audioLabel'),
  hud: $('hud'),
  pressureNum: $('pressureNum'),
  pressureFill: $('pressureFill'),
  pressureState: $('pressureState'),
  healthNum: $('healthNum'),
  healthFill: $('healthFill'),
  healthState: $('healthState'),
  ammoNum: $('ammoNum'),
  ammoTicks: $('ammoTicks'),
  reloadBar: $('reloadBar'),
  objective: $('objective'),
  objectiveSub: $('objectiveSub'),
  waveNum: $('waveNum'),
  waveTimer: $('waveTimer'),
  scoreNum: $('scoreNum'),
  interact: $('interact'),
  valveName: $('valveName'),
  toastFeed: $('toastFeed'),
  crosshair: $('crosshair'),
  hitmarker: $('hitmarker'),
  damageFlash: $('damageFlash'),
  pauseHint: $('pauseHint'),
  endScreen: $('endScreen'),
  endKicker: $('endKicker'),
  endTitle: $('endTitle'),
  endCopy: $('endCopy'),
  endScore: $('endScore'),
  endWave: $('endWave'),
  endKills: $('endKills'),
  restartBtn: $('restartBtn'),
  dashFill: $('dashFill'),
  radar: $('radar'),
  menuPressure: $('menuPressure'),
  menuHostiles: $('menuHostiles'),
  menuValves: $('menuValves'),
};

for (let i = 0; i < 12; i++) {
  const tick = document.createElement('i');
  els.ammoTicks.appendChild(tick);
}
const ammoTickEls = [...els.ammoTicks.children];
const valveChips = [...document.querySelectorAll('.valve-chip')];
const radarCtx = els.radar.getContext('2d');

const ui = {
  toasts: [],
  toast(text, cls = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + cls;
    el.innerHTML = text;
    els.toastFeed.appendChild(el);
    this.toasts.push(el);
    while (this.toasts.length > 4) this.toasts.shift()?.remove();
    setTimeout(() => {
      el.remove();
      this.toasts = this.toasts.filter((t) => t !== el);
    }, 2700);
  },
  hit(kill = false) {
    els.hitmarker.classList.remove('show', 'kill');
    void els.hitmarker.offsetWidth;
    els.hitmarker.classList.add('show');
    if (kill) els.hitmarker.classList.add('kill');
  },
  flashDamage() {
    els.damageFlash.classList.add('active');
    clearTimeout(this._dmgTimer);
    this._dmgTimer = setTimeout(() => els.damageFlash.classList.remove('active'), 90);
  },
};

// ---------------- GAME STATE ----------------

const state = {
  mode: 'menu',
  pressure: 63.2,
  health: 100,
  ammo: 12,
  score: 0,
  kills: 0,
  wave: 0,
  waveActive: false,
  nextWave: 0,
  reloading: false,
  reloadT: 0,
  reloadDuration: 1.35,
  dashCooldown: 0,
  dashTime: 0,
  shake: 0,
  yaw: 0,
  pitch: -0.015,
  aiming: false,
  moving: false,
  sprinting: false,
  lookDX: 0,
  lookDY: 0,
  hadLock: false,
  nearValve: null,
  elapsed: 0,
  gameTime: 0,
  menuTime: 0,
  lastRadar: 0,
  hitFlash: 0,
  breachTime: 0,
  player: new THREE.Vector3(0, 1.72, 15.8),
  velocity: new THREE.Vector3(),
  camBase: new THREE.Vector3(0, 1.72, 15.8),
  fov: 64,
  enemyAlert: 0,
};

const keys = new Set();
const tracers = [];
const raycaster = new THREE.Raycaster();
const centerScreen = new THREE.Vector2(0, 0);
const tempVec = new THREE.Vector3();
const tempVec2 = new THREE.Vector3();

function setMenu() {
  state.mode = 'menu';
  els.menu.classList.remove('hidden');
  els.hud.classList.remove('visible');
  els.endScreen.classList.remove('visible');
  els.pauseHint.classList.remove('visible');
  els.hud.setAttribute('aria-hidden', 'true');
  weapon.root.visible = false;
  state.pressure = 63.2;
  state.score = 0;
  state.kills = 0;
  state.wave = 0;
  state.waveActive = false;
  state.health = 100;
  state.ammo = 12;
  state.reloading = false;
  state.reloadT = 0;
  state.aiming = false;
  state.player.set(0, 1.72, 15.8);
  state.camBase.copy(state.player);
  state.yaw = 0;
  state.pitch = -0.015;
  enemies.clear();
  for (const t of tracers) scene.remove(t.line);
  tracers.length = 0;
  updateAmmoDisplay();
}

function startGame() {
  audio.init();
  state.mode = 'playing';
  state.pressure = 63.2;
  state.health = 100;
  state.ammo = 12;
  state.score = 0;
  state.kills = 0;
  state.reloading = false;
  state.reloadT = 0;
  state.dashCooldown = 0;
  state.dashTime = 0;
  state.shake = 0;
  state.yaw = 0;
  state.pitch = -0.015;
  state.aiming = false;
  state.velocity.set(0, 0, 0);
  state.player.set(0, 1.72, 15.8);
  state.camBase.copy(state.player);
  state.gameTime = 0;
  state.wave = 1;
  state.waveActive = true;
  state.nextWave = 0;
  state.breachTime = 0;
  state.nearValve = null;
  state.mode = 'playing';
  state.enemyAlert = 0;

  els.menu.classList.add('hidden');
  els.endScreen.classList.remove('visible');
  els.hud.classList.add('visible');
  els.hud.setAttribute('aria-hidden', 'false');
  weapon.root.visible = true;
  weapon.gun.position.set(0.31, -0.34, -0.68);
  weapon.setReload(0);
  updateAmmoDisplay();

  enemies.clear();
  for (const v of world.valves) {
    v.cooldown = v.id === 2 ? 2.5 : 0;
    v.venting = 0;
    if (v.light) v.light.color.setHex(0x77f7ff);
  }
  enemies.spawnWave(4, 1, state.player, state.yaw);
  audio.wave();
  ui.toast('WAVE 01 // <b>HOSTILE UPLINK DETECTED</b>', 'cyan');
  setTimeout(() => ui.toast('VENT THE VALVES TO RELIEVE CORE PRESSURE'), 700);

  requestMouse();
  updateHUD(true);
}

function requestMouse() {
  if (document.pointerLockElement === canvas) return;
  const result = canvas.requestPointerLock?.();
  if (result && typeof result.catch === 'function') result.catch(() => {});
}

function endGame(reason) {
  if (state.mode === 'over') return;
  state.mode = 'over';
  state.aiming = false;
  state.waveActive = false;
  audio.gameover();
  if (document.pointerLockElement) document.exitPointerLock();
  els.hud.classList.remove('visible');
  els.pauseHint.classList.remove('visible');
  weapon.root.visible = false;
  els.endScore.textContent = String(state.score).padStart(6, '0');
  els.endWave.textContent = String(state.wave).padStart(2, '0');
  els.endKills.textContent = String(state.kills).padStart(2, '0');
  if (reason === 'health') {
    els.endKicker.textContent = 'OPERATOR SIGNAL LOST';
    els.endTitle.innerHTML = 'SIGNAL<br />LOST';
    els.endCopy.textContent = 'Suit integrity depleted. The reactor is without an operator.';
  } else if (reason === 'breach') {
    els.endKicker.textContent = 'CONTAINMENT FAILURE';
    els.endTitle.innerHTML = 'CORE<br />BREACH';
    els.endCopy.textContent = 'The reactor exceeded critical pressure. Sector 07 is lost.';
  } else {
    els.endKicker.textContent = 'PRESSURE PROTOCOL FAILED';
    els.endTitle.innerHTML = 'DEAD<br />LOCK';
    els.endCopy.textContent = 'The valves locked under hostile pressure. The core could not be saved.';
  }
  els.endScreen.classList.add('visible');
}

// ---------------- COMBAT ----------------

function addTracer(from, to, color = 0xffc38a) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const mat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const line = new THREE.Line(geo, mat);
  scene.add(line);
  tracers.push({ line, life: 0.075, max: 0.075 });
}

function updateTracers(dt) {
  for (let i = tracers.length - 1; i >= 0; i--) {
    const t = tracers[i];
    t.life -= dt;
    t.line.material.opacity = Math.max(0, t.life / t.max) * 0.85;
    if (t.life <= 0) {
      scene.remove(t.line);
      t.line.geometry.dispose();
      t.line.material.dispose();
      tracers.splice(i, 1);
    }
  }
}

function fire() {
  if (state.mode !== 'playing' || state.reloading) return;
  if (state.ammo <= 0) {
    audio.empty();
    startReload();
    return;
  }
  state.ammo -= 1;
  audio.shoot();
  weapon.pullTrigger();
  weapon.updateAmmoDisplay(state.ammo, false);
  state.shake = Math.max(state.shake, 0.22);
  state.hitFlash = 0.06;
  els.crosshair.classList.add('firing');
  clearTimeout(ui._fireTimer);
  ui._fireTimer = setTimeout(() => els.crosshair.classList.remove('firing'), 90);

  raycaster.setFromCamera(centerScreen, camera);
  const origin = camera.getWorldPosition(new THREE.Vector3());
  const dir = raycaster.ray.direction.clone();
  const hit = enemies.tryHit(origin, dir, 65);
  const muzzle = weapon.getMuzzleWorld(new THREE.Vector3());

  if (hit) {
    const result = enemies.damageEnemy(hit.enemy, 1.05, hit.point);
    addTracer(muzzle, hit.point, result.critical ? 0xfff0cc : 0xffbb83);
    audio.hit(result.critical);
    ui.hit(result.killed);
    if (result.killed) {
      state.kills += 1;
      state.score += 125 + (result.critical ? 55 : 0);
      audio.kill();
      ui.toast(`HOSTILE NEUTRALIZED <b>+${125 + (result.critical ? 55 : 0)}</b>`);
      state.shake = Math.max(state.shake, 0.34);
    } else if (result.critical) {
      state.score += 15;
    }
  } else {
    // Surface impact
    let point = origin.clone().addScaledVector(dir, 50);
    if (dir.y < -0.01) {
      const t = -origin.y / dir.y;
      if (t > 0 && t < 50) point = origin.clone().addScaledVector(dir, t);
    }
    addTracer(muzzle, point, 0xffb279);
    if (point.y < 0.1) {
      enemies.spawnBurst(point.clone().setY(0.08), 0xff8b42, 5, 0.35);
    }
  }

  if (state.ammo === 0) setTimeout(startReload, 130);
}

function startReload() {
  if (state.mode !== 'playing' || state.reloading || state.ammo === 12) return;
  state.reloading = true;
  state.reloadT = 0;
  audio.reload();
  weapon.updateAmmoDisplay(state.ammo, true);
  ui.toast('PURGE CELL CYCLING', 'cyan');
}

function updateReload(dt) {
  if (!state.reloading) return;
  state.reloadT += dt;
  const p = clamp(state.reloadT / state.reloadDuration, 0, 1);
  weapon.setReload(p);
  if (p >= 1) {
    state.reloading = false;
    state.reloadT = 0;
    state.ammo = 12;
    weapon.setReload(0);
    weapon.updateAmmoDisplay(12, false);
    audio.reload();
  }
}

function updateAmmoDisplay() {
  weapon.updateAmmoDisplay(state.ammo, state.reloading);
}

function attemptVent() {
  if (state.mode !== 'playing') return;
  const v = state.nearValve;
  if (!v) {
    ui.toast('NO VALVE IN RANGE', '');
    return;
  }
  if (v.cooldown > 0) {
    ui.toast(`VALVE V-0${v.id + 1} CYCLING // ${v.cooldown.toFixed(1)}s`, 'cyan');
    return;
  }
  v.cooldown = 9;
  state.pressure = clamp(state.pressure - 15.5, 0, 100);
  state.score += 280;
  world.vent(v, true);
  audio.vent();
  state.shake = Math.max(state.shake, 0.55);
  ui.toast(`<b>V-0${v.id + 1} VENTED</b> // PRESSURE RELIEVED`, 'cyan');
  updateHUD(true);
}

function damagePlayer(amount) {
  if (state.mode !== 'playing') return;
  state.health = clamp(state.health - amount, 0, 100);
  state.shake = Math.max(state.shake, 0.6);
  audio.damage();
  ui.flashDamage();
  if (state.health <= 0) endGame('health');
}

function startWave() {
  state.wave += 1;
  state.waveActive = true;
  state.pressure = clamp(state.pressure + 1.8, 0, 100);
  const count = 3 + Math.min(6, state.wave);
  enemies.spawnWave(count, state.wave, state.player, state.yaw);
  audio.wave();
  ui.toast(`WAVE ${String(state.wave).padStart(2, '0')} // <b>${count} SIGNATURES</b>`, 'cyan');
}

// ---------------- INPUT ----------------

function onKeyDown(e) {
  if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD') e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (state.mode !== 'playing') return;
  if (e.code === 'KeyR') startReload();
  if (e.code === 'KeyE') attemptVent();
  if (e.code === 'Space') {
    if (state.dashCooldown <= 0) {
      state.dashCooldown = 1.65;
      state.dashTime = 0.17;
      const fwd = new THREE.Vector3(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
      const dirNow = state.velocity.lengthSq() > 0.2 ? state.velocity.clone().normalize() : fwd;
      state.velocity.addScaledVector(dirNow, 13.5);
      state.shake = Math.max(state.shake, 0.25);
      audio.dash();
    }
  }
  if (e.code === 'KeyM') toggleAudio();
}

function onKeyUp(e) {
  keys.delete(e.code);
}

function onMouseMove(e) {
  if (state.mode !== 'playing' || document.pointerLockElement !== canvas) return;
  const sens = state.aiming ? 0.00135 : 0.00195;
  state.yaw -= e.movementX * sens;
  state.pitch -= e.movementY * sens;
  state.pitch = clamp(state.pitch, -1.15, 1.05);
  state.lookDX += e.movementX;
  state.lookDY += e.movementY;
}

function onMouseDown(e) {
  if (state.mode !== 'playing') return;
  if (document.pointerLockElement !== canvas) {
    requestMouse();
    return;
  }
  if (e.button === 0) fire();
  if (e.button === 2) state.aiming = true;
}

function onMouseUp(e) {
  if (e.button === 2) state.aiming = false;
}

function toggleAudio() {
  audio.init();
  const enabled = audio.toggle();
  els.audioLabel.textContent = enabled ? 'AUDIO ON' : 'AUDIO OFF';
  els.audioBtn.classList.toggle('muted', !enabled);
}

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);
document.addEventListener('mousemove', onMouseMove);
document.addEventListener('mousedown', onMouseDown);
document.addEventListener('mouseup', onMouseUp);
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) {
    state.hadLock = true;
    els.pauseHint.classList.remove('visible');
  } else if (state.hadLock && state.mode === 'playing') {
    els.pauseHint.classList.add('visible');
    state.aiming = false;
  }
});
canvas.addEventListener('click', () => {
  if (state.mode === 'playing') requestMouse();
});

els.startBtn.addEventListener('click', () => {
  audio.init();
  startGame();
});
els.restartBtn.addEventListener('click', () => {
  audio.init();
  startGame();
});
els.audioBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleAudio();
});

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  finalShader.uniforms.resolution.value.set(w, h);
  bloom.setSize(w * 0.4, h * 0.4);
});

// ---------------- UPDATE ----------------

function updatePlayer(dt) {
  const forward = new THREE.Vector3(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
  const right = new THREE.Vector3(Math.cos(state.yaw), 0, -Math.sin(state.yaw));
  const wish = new THREE.Vector3();
  if (keys.has('KeyW')) wish.add(forward);
  if (keys.has('KeyS')) wish.sub(forward);
  if (keys.has('KeyD')) wish.add(right);
  if (keys.has('KeyA')) wish.sub(right);
  state.moving = wish.lengthSq() > 0;
  state.sprinting = state.moving && keys.has('ShiftLeft') && !state.aiming && state.dashTime <= 0;

  if (state.moving) wish.normalize();
  const maxSpeed = state.aiming ? 3.15 : state.sprinting ? 8.2 : 5.65;
  const accel = state.moving ? 13 : 10;
  const targetVel = wish.multiplyScalar(maxSpeed);
  state.velocity.x = damp(state.velocity.x, targetVel.x, accel, dt);
  state.velocity.z = damp(state.velocity.z, targetVel.z, accel, dt);

  if (state.dashTime > 0) {
    state.dashTime -= dt;
    state.velocity.multiplyScalar(1 - dt * 2.2);
  } else {
    state.velocity.multiplyScalar(1 - Math.min(0.12, dt * 1.2));
  }

  state.dashCooldown = Math.max(0, state.dashCooldown - dt);

  const next = state.player.clone();
  next.x += state.velocity.x * dt;
  next.z += state.velocity.z * dt;

  // Arena boundary
  const r = Math.hypot(next.x, next.z);
  if (r > 28.4) {
    next.x = (next.x / r) * 28.4;
    next.z = (next.z / r) * 28.4;
  }
  // Reactor collision
  const coreDist = Math.hypot(next.x, next.z);
  if (coreDist < 3.35) {
    if (coreDist < 0.001) next.z = 3.35;
    else {
      next.x = (next.x / coreDist) * 3.35;
      next.z = (next.z / coreDist) * 3.35;
    }
  }
  // Valve station collision
  for (const v of world.valves) {
    const dx = next.x - v.position.x;
    const dz = next.z - v.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 2.4 && d > 0.001) {
      next.x = v.position.x + (dx / d) * 2.4;
      next.z = v.position.z + (dz / d) * 2.4;
    }
  }
  state.player.x = next.x;
  state.player.z = next.z;

  const speed = Math.hypot(state.velocity.x, state.velocity.z);
  const bobSpeed = state.sprinting ? 12 : 8.4;
  const bob = state.moving ? Math.sin(state.elapsed * bobSpeed) * (state.sprinting ? 0.045 : 0.027) * Math.min(1, speed / 4) : 0;
  const bobSide = state.moving ? Math.cos(state.elapsed * bobSpeed * 0.5) * 0.017 * Math.min(1, speed / 4) : 0;
  state.camBase.set(state.player.x, 1.72 + bob, state.player.z);
  camera.position.copy(state.camBase);
  camera.position.x += bobSide * right.x;
  camera.position.z += bobSide * right.z;

  if (state.shake > 0) {
    const s = state.shake;
    camera.position.x += (Math.random() - 0.5) * s * 0.14;
    camera.position.y += (Math.random() - 0.5) * s * 0.11;
    camera.position.z += (Math.random() - 0.5) * s * 0.1;
    camera.rotation.z = (Math.random() - 0.5) * s * 0.018;
    state.shake = Math.max(0, state.shake - dt * 1.8);
  } else {
    camera.rotation.z = damp(camera.rotation.z, 0, 10, dt);
  }

  camera.rotation.set(state.pitch + (state.shake > 0 ? (Math.random() - 0.5) * state.shake * 0.014 : 0), state.yaw, camera.rotation.z);

  const targetFov = state.dashTime > 0 ? 79 : state.sprinting ? 69 : state.aiming ? 51 : 64;
  state.fov = damp(state.fov, targetFov, 8, dt);
  if (Math.abs(camera.fov - state.fov) > 0.01) {
    camera.fov = state.fov;
    camera.updateProjectionMatrix();
  }

  weapon.update(dt, state.elapsed, {
    aiming: state.aiming,
    sprinting: state.sprinting,
    moving: state.moving,
    lookX: state.lookDX,
    lookY: state.lookDY,
  });
  state.lookDX = damp(state.lookDX, 0, 9, dt);
  state.lookDY = damp(state.lookDY, 0, 9, dt);
}

function updateNearValve() {
  let best = null;
  let bestD = 4.1;
  for (const v of world.valves) {
    const d = Math.hypot(state.player.x - v.position.x, state.player.z - v.position.z);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  state.nearValve = best;
}

function updateGame(dt) {
  state.gameTime += dt;
  state.pressure = clamp(state.pressure + dt * (0.38 + enemies.aliveCount * 0.075 + state.wave * 0.018), 0, 100);
  if (state.pressure >= 100) {
    endGame('breach');
    return;
  }
  updatePlayer(dt);
  updateReload(dt);
  updateNearValve();
  updateTracers(dt);

  const alive = enemies.aliveCount;
  const waveCheck = enemies.enemies.length;
  if (state.waveActive && alive === 0 && waveCheck === 0) {
    state.waveActive = false;
    state.nextWave = 4.5;
    state.score += 550;
    state.pressure = clamp(state.pressure - 4, 0, 100);
    state.health = clamp(state.health + 12, 0, 100);
    ui.toast(`WAVE ${String(state.wave).padStart(2, '0')} CLEARED <b>+550</b>`, 'cyan');
    audio.wave();
  }
  if (!state.waveActive && state.nextWave > 0) {
    state.nextWave -= dt;
    if (state.nextWave <= 0) startWave();
  }

  enemies.update(dt, state.elapsed, state.player, {
    onPlayerHit: (dmg) => damagePlayer(dmg),
  });

  // pointer for interaction not too far / behind
  if (state.nearValve) {
    const v = state.nearValve;
    const worldPos = tempVec.copy(v.position);
    worldPos.y = 2.2;
    const projected = worldPos.project(camera);
    const onScreen = projected.z < 1 && Math.abs(projected.x) < 1.05 && Math.abs(projected.y) < 1.05;
    if (!onScreen) state.nearValve = null;
  }
}

function updateHUD(force = false) {
  const pressure = Math.round(state.pressure * 10) / 10;
  els.pressureNum.textContent = pressure.toFixed(1);
  els.pressureFill.style.width = `${clamp(state.pressure, 0, 100)}%`;
  const pState = state.pressure > 86 ? 'CRITICAL' : state.pressure > 72 ? 'HIGH' : state.pressure > 55 ? 'ELEVATED' : 'STABLE';
  els.pressureState.textContent = pState;
  els.pressureState.style.color = state.pressure > 86 ? '#ff3b32' : state.pressure > 72 ? '#ffb02e' : '#a9f5ff';

  els.healthNum.textContent = Math.ceil(state.health);
  els.healthFill.style.width = `${clamp(state.health, 0, 100)}%`;
  els.healthFill.classList.toggle('low', state.health <= 34);
  els.healthState.textContent = state.health > 66 ? 'NOMINAL' : state.health > 34 ? 'COMPROMISED' : 'CRITICAL';

  if (els.ammoNum.textContent !== String(state.ammo)) els.ammoNum.textContent = String(state.ammo);
  els.ammoNum.classList.toggle('empty', state.ammo === 0);
  ammoTickEls.forEach((t, i) => t.classList.toggle('spent', i >= state.ammo));

  els.reloadBar.classList.toggle('visible', state.reloading);
  if (state.reloading) {
    const p = clamp(state.reloadT / state.reloadDuration, 0, 1);
    els.reloadBar.querySelector('i').style.width = `${p * 100}%`;
  }

  els.objective.textContent = state.pressure > 86 ? 'VENT THE CORE — CRITICAL' : state.waveActive ? 'HOLD THE LINE' : 'VENT THE PRESSURE VALVES';
  els.objectiveSub.textContent = state.pressure > 86 ? 'CONTAINMENT WINDOW CLOSING' : aliveText();
  els.waveNum.textContent = String(Math.max(1, state.wave)).padStart(2, '0');
  if (state.waveActive) {
    const alive = enemies.aliveCount;
    els.waveTimer.textContent = alive > 0 ? `${String(alive).padStart(2, '0')} HOSTILES` : 'SECTOR CLEAR';
  } else {
    els.waveTimer.textContent = state.nextWave > 0 ? `NEXT IN ${state.nextWave.toFixed(1)}` : 'STANDBY';
  }
  els.scoreNum.textContent = String(state.score).padStart(6, '0');
  els.dashFill.style.width = `${clamp((1 - state.dashCooldown / 1.65) * 100, 0, 100)}%`;

  if (state.nearValve) {
    els.interact.classList.add('visible');
    els.valveName.textContent = state.nearValve.label;
    if (state.nearValve.cooldown > 0) {
      els.interact.querySelector('strong').textContent = 'VALVE CYCLING';
    } else {
      els.interact.querySelector('strong').textContent = 'VENT VALVE';
    }
  } else {
    els.interact.classList.remove('visible');
  }

  world.valves.forEach((v, i) => {
    const chip = valveChips[i];
    if (!chip) return;
    const cooling = v.cooldown > 0;
    chip.classList.toggle('cooldown', cooling);
    chip.querySelector('b').textContent = cooling ? `${v.cooldown.toFixed(0)}s` : 'READY';
  });

  els.menuPressure.textContent = pressure.toFixed(1);
  els.menuHostiles.textContent = `0${Math.max(3, enemies.aliveCount)} ACTIVE`;
  els.menuValves.textContent = `${world.valves.filter((v) => v.cooldown <= 0).length} / 3 READY`;

  finalShader.uniforms.pressure.value = state.pressure / 100;
}

function aliveText() {
  return state.pressure > 72 ? 'PRESSURE IS RISING — FIND A VALVE' : 'STABILIZE THE CORE BEFORE CONTAINMENT FAILS';
}

function updateRadar(time) {
  if (time - state.lastRadar < 0.066) return;
  state.lastRadar = time;
  const ctx = radarCtx;
  const size = 220;
  const c = size / 2;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, c - 3, 0, Math.PI * 2);
  ctx.clip();

  const bg = ctx.createRadialGradient(c, c, 5, c, c, c);
  bg.addColorStop(0, 'rgba(9,28,26,0.78)');
  bg.addColorStop(1, 'rgba(2,7,6,0.7)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(126,242,248,0.12)';
  ctx.lineWidth = 1;
  for (const r of [28, 58, 88, 108]) {
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * 108, c + Math.sin(a) * 108);
    ctx.lineTo(c - Math.cos(a) * 108, c - Math.sin(a) * 108);
    ctx.stroke();
  }

  const sweep = (time * 0.9) % (Math.PI * 2);
  const grad = ctx.createConicGradient(sweep, c, c);
  grad.addColorStop(0, 'rgba(126,242,248,0.2)');
  grad.addColorStop(0.13, 'rgba(126,242,248,0)');
  grad.addColorStop(1, 'rgba(126,242,248,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(c, c, 108, 0, Math.PI * 2);
  ctx.fill();

  const yaw = state.yaw;
  const cos = Math.cos(-yaw);
  const sin = Math.sin(-yaw);
  function project(wx, wz) {
    const dx = wx - state.player.x;
    const dz = wz - state.player.z;
    const rx = dx * cos - dz * sin;
    const rz = dx * sin + dz * cos;
    return [c + rx * 4.15, c + rz * 4.15];
  }

  for (const v of world.valves) {
    const [x, y] = project(v.position.x, v.position.z);
    ctx.fillStyle = v.cooldown > 0 ? 'rgba(255,176,46,0.55)' : 'rgba(126,242,248,0.95)';
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-3.5, -3.5, 7, 7);
    ctx.restore();
  }

  for (const e of enemies.enemies) {
    if (e.dying) continue;
    const [x, y] = project(e.pos.x, e.pos.z);
    if (Math.hypot(x - c, y - c) > 105) continue;
    ctx.fillStyle = 'rgba(255,86,44,0.95)';
    ctx.shadowColor = '#ff5a1f';
    ctx.shadowBlur = 7;
    ctx.beginPath();
    ctx.arc(x, y, 2.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  ctx.fillStyle = '#d9fbff';
  ctx.beginPath();
  ctx.moveTo(c, c - 8);
  ctx.lineTo(c - 5.5, c + 6);
  ctx.lineTo(c, c + 2.5);
  ctx.lineTo(c + 5.5, c + 6);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(126,242,248,0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(c, c, 8, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
  ctx.strokeStyle = 'rgba(126,242,248,0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(c, c, c - 3, 0, Math.PI * 2);
  ctx.stroke();
}

// ---------------- LOOP ----------------

let last = performance.now();
let booted = false;

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  state.elapsed += dt;
  state.menuTime += dt;
  finalShader.uniforms.time.value = state.elapsed;

  if (state.mode === 'menu') {
    const a = state.menuTime * 0.045 + 0.62;
    const radius = 14.4 + Math.sin(state.menuTime * 0.08) * 1.1;
    camera.position.set(Math.cos(a) * radius, 5.7 + Math.sin(state.menuTime * 0.12) * 0.35, Math.sin(a) * radius);
    camera.rotation.set(0.008, 0, 0);
    camera.lookAt(0, 3.2, 0);
    if (camera.fov !== 57) {
      camera.fov = 57;
      camera.updateProjectionMatrix();
    }
    state.pressure = 63.2 + Math.sin(state.menuTime * 0.5) * 1.1;
    updateRadar(now / 1000);
    updateHUD();
  } else if (state.mode === 'playing') {
    updateGame(dt);
    updateHUD();
    updateRadar(now / 1000);
  } else {
    // End screen: keep cinematic camera and subtle effects
    camera.position.y = 1.72 + Math.sin(state.elapsed * 0.5) * 0.02;
    updateRadar(now / 1000);
  }

  world.update(dt, state.elapsed, state.pressure / 100, state.mode === 'playing');
  renderer.info.reset();
  composer.render(dt);

  if (!booted) {
    booted = true;
    setTimeout(() => {
      els.boot.classList.add('done');
    }, 260);
  }
}

setMenu();
updateHUD();
window.__VALVES__ = { renderer, scene, camera, composer, world, state, enemies, bloom };
requestAnimationFrame(animate);
