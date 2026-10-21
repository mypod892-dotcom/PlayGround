import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeGlowTexture } from './textures.js';

function box(w, h, d, mat, x = 0, y = 0, z = 0, r = 0.02) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat);
  m.position.set(x, y, z);
  return m;
}

function cyl(r0, r1, h, mat, x = 0, y = 0, z = 0, seg = 20) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat);
  m.position.set(x, y, z);
  return m;
}

export function createWeapon(camera) {
  const root = new THREE.Group();
  root.name = 'weapon';
  camera.add(root);

  const steel = new THREE.MeshStandardMaterial({ color: 0x2a3533, metalness: 0.62, roughness: 0.48 });
  const steelDark = new THREE.MeshStandardMaterial({ color: 0x141c1b, metalness: 0.68, roughness: 0.5 });
  const polymer = new THREE.MeshStandardMaterial({ color: 0x232d2b, metalness: 0.12, roughness: 0.72 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x111716, metalness: 0.05, roughness: 0.88 });
  const cyan = new THREE.MeshStandardMaterial({ color: 0xc2fbff, emissive: 0x4de1e8, emissiveIntensity: 1.6, roughness: 0.2, metalness: 0.2 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xffa15b, emissive: 0xff4d0d, emissiveIntensity: 2.0, roughness: 0.25, metalness: 0.15 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xb6f5ff,
    metalness: 0.0,
    roughness: 0.05,
    transmission: 0.65,
    transparent: true,
    opacity: 0.5,
    clearcoat: 1,
    thickness: 0.08,
  });

  const gun = new THREE.Group();
  gun.position.set(0.31, -0.34, -0.68);
  gun.rotation.set(0.02, 0.09, 0);
  root.add(gun);

  const viewLight = new THREE.PointLight(0x9fe8f4, 0.24, 2.1, 2);
  viewLight.position.set(-0.18, 0.5, 0.18);
  gun.add(viewLight);
  const vialLight = new THREE.PointLight(0xff6a28, 0.25, 0.8, 2);
  vialLight.position.set(-0.2, -0.08, 0.02);
  gun.add(vialLight);

  const body = box(0.25, 0.19, 0.7, steel, 0, 0, -0.13, 0.028);
  gun.add(body);

  const spine = box(0.17, 0.06, 0.54, steelDark, 0, 0.12, -0.15, 0.012);
  gun.add(spine);

  const rail = box(0.085, 0.025, 0.43, steel, 0, 0.16, -0.18, 0.006);
  gun.add(rail);
  for (let i = 0; i < 9; i++) {
    gun.add(box(0.105, 0.012, 0.018, steelDark, 0, 0.177, -0.35 + i * 0.042, 0.002));
  }

  // Angled shroud / barrel
  const shroud = box(0.175, 0.15, 0.5, steelDark, 0, 0.02, -0.61, 0.025);
  gun.add(shroud);
  const shroudTop = box(0.12, 0.04, 0.36, steel, 0, 0.105, -0.56, 0.008);
  gun.add(shroudTop);
  for (let i = 0; i < 3; i++) {
    const slot = box(0.015, 0.09, 0.12, polymer, -0.09, 0.02, -0.47 - i * 0.11, 0.004);
    gun.add(slot);
    gun.add(box(0.015, 0.09, 0.12, polymer, 0.09, 0.02, -0.47 - i * 0.11, 0.004));
  }

  const barrel = cyl(0.045, 0.052, 0.42, steelDark, 0, 0.02, -0.92, 18);
  barrel.rotation.x = Math.PI / 2;
  gun.add(barrel);
  const barrelRing = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 18), steel);
  barrelRing.position.set(0, 0.02, -1.02);
  gun.add(barrelRing);
  const muzzle = new THREE.Group();
  muzzle.position.set(0, 0.02, -1.08);
  gun.add(muzzle);

  const port = cyl(0.072, 0.072, 0.11, steel, 0, 0.02, -0.99, 18);
  port.rotation.x = Math.PI / 2;
  gun.add(port);
  const portRing = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.01, 6, 20), orange);
  portRing.position.set(0, 0.02, -1.045);
  gun.add(portRing);

  // Slide / top cover
  const slide = box(0.235, 0.055, 0.4, steel, 0, 0.145, -0.18, 0.02);
  gun.add(slide);
  const slideCyan = box(0.008, 0.012, 0.27, cyan, -0.119, 0.155, -0.2, 0.002);
  gun.add(slideCyan);
  gun.add(box(0.008, 0.012, 0.19, cyan, 0.119, 0.155, -0.24, 0.002));
  gun.add(box(0.006, 0.016, 0.46, cyan, -0.126, 0.055, -0.19, 0.002));
  gun.add(box(0.005, 0.01, 0.3, orange, 0.126, -0.055, -0.16, 0.002));

  // Grip
  const grip = box(0.17, 0.42, 0.24, polymer, 0, -0.29, 0.08, 0.045);
  grip.rotation.x = -0.18;
  gun.add(grip);
  for (let i = 0; i < 5; i++) {
    const g = box(0.18, 0.018, 0.225, rubber, 0, -0.37 + i * 0.06, 0.11, 0.006);
    g.rotation.x = -0.18;
    gun.add(g);
  }
  const gripBase = box(0.19, 0.06, 0.26, steelDark, 0, -0.515, 0.14, 0.01);
  gripBase.rotation.x = -0.18;
  gun.add(gripBase);

  // Trigger guard
  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.018, 6, 20, Math.PI * 1.35), steelDark);
  guard.position.set(0, -0.2, -0.15);
  guard.rotation.set(0.2, 0, Math.PI * 0.13);
  gun.add(guard);
  const trigger = box(0.04, 0.11, 0.035, steel, 0, -0.23, -0.1, 0.008);
  trigger.rotation.x = 0.24;
  gun.add(trigger);

  // Holographic sight
  const sightPostL = box(0.022, 0.085, 0.03, steelDark, -0.052, 0.195, -0.045, 0.004);
  gun.add(sightPostL);
  const sightPostR = box(0.022, 0.085, 0.03, steelDark, 0.052, 0.195, -0.045, 0.004);
  gun.add(sightPostR);
  const sightRing = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.009, 6, 24), steel);
  sightRing.position.set(0, 0.258, -0.05);
  gun.add(sightRing);
  const sightGlass = new THREE.Mesh(
    new THREE.CircleGeometry(0.043, 20),
    new THREE.MeshBasicMaterial({ color: 0x6ff4ff, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  );
  sightGlass.position.set(0, 0.258, -0.052);
  gun.add(sightGlass);
  const sightDot = new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 6), new THREE.MeshBasicMaterial({ color: 0xc4feff }));
  sightDot.position.set(0, 0.258, -0.054);
  gun.add(sightDot);

  // Pressure vial (left side)
  const vialGlass = cyl(0.075, 0.075, 0.32, glass, -0.17, -0.05, -0.12, 18);
  vialGlass.rotation.z = Math.PI / 2;
  gun.add(vialGlass);
  const vialCore = cyl(0.044, 0.044, 0.3, orange, -0.17, -0.05, -0.12, 14);
  vialCore.rotation.z = Math.PI / 2;
  gun.add(vialCore);
  for (const x of [-0.34, 0.0]) {
    const cap = cyl(0.095, 0.095, 0.035, steelDark, x, -0.05, -0.12, 18);
    cap.rotation.z = Math.PI / 2;
    gun.add(cap);
  }
  const vialBracket = box(0.05, 0.16, 0.04, steel, -0.17, -0.05, 0.01, 0.008);
  gun.add(vialBracket);

  // Small holographic readout
  const displayCanvas = document.createElement('canvas');
  displayCanvas.width = 256;
  displayCanvas.height = 128;
  const dctx = displayCanvas.getContext('2d');
  dctx.fillStyle = '#04100f';
  dctx.fillRect(0, 0, 256, 128);
  dctx.fillStyle = '#7ceef5';
  dctx.font = '700 56px "Arial Narrow", sans-serif';
  dctx.fillText('12', 18, 70);
  dctx.font = '600 16px "Arial Narrow", sans-serif';
  dctx.fillText('PURGE-9', 18, 101);
  dctx.fillStyle = 'rgba(255,90,31,0.9)';
  dctx.fillRect(18, 109, 120, 4);
  dctx.strokeStyle = 'rgba(124,238,245,0.3)';
  dctx.strokeRect(1, 1, 254, 126);
  const displayTex = new THREE.CanvasTexture(displayCanvas);
  displayTex.colorSpace = THREE.SRGBColorSpace;
  const displayMat = new THREE.MeshBasicMaterial({ map: displayTex, transparent: true, opacity: 0.9 });
  const display = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.08), displayMat);
  display.position.set(-0.135, 0.045, 0.18);
  display.rotation.y = -Math.PI / 2;
  gun.add(display);

  const displayFrame = box(0.02, 0.11, 0.19, steelDark, -0.13, 0.045, 0.18, 0.005);
  gun.add(displayFrame);

  // Muzzle assembly
  const flashTex = makeGlowTexture('255,210,160');
  const flashMat = new THREE.SpriteMaterial({
    map: flashTex,
    color: 0xffc38a,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0,
  });
  const flash = new THREE.Sprite(flashMat);
  flash.scale.set(0.5, 0.5, 1);
  flash.position.z = -0.04;
  muzzle.add(flash);
  const flashCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.065, 0.28, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd0a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  flashCone.rotation.x = -Math.PI / 2;
  flashCone.position.z = -0.13;
  muzzle.add(flashCone);
  const muzzleLight = new THREE.PointLight(0xff8a3d, 0, 3.2, 2);
  muzzleLight.position.set(0, 0.02, -1.13);
  gun.add(muzzleLight);

  // Ejection port glow
  const portGlow = box(0.005, 0.055, 0.1, cyan, 0.126, 0.008, -0.24, 0.002);
  gun.add(portGlow);

  const state = {
    base: new THREE.Vector3(0.31, -0.34, -0.68),
    aimBase: new THREE.Vector3(0.002, -0.17, -0.52),
    recoil: 0,
    recoilRot: 0,
    swayX: 0,
    swayY: 0,
    muzzle: 0,
    bob: 0,
    reload: 0,
    lookX: 0,
    lookY: 0,
    flashLife: 0,
  };

  function pullTrigger() {
    state.recoil = 1;
    state.recoilRot = 1;
    state.flashLife = 0.055;
    flashMat.opacity = 1;
    flashCone.material.opacity = 1;
    muzzleLight.intensity = 9;
    flash.scale.setScalar(0.45 + Math.random() * 0.28);
  }

  function setReload(progress) {
    state.reload = progress;
    displayTex.needsUpdate = true;
  }

  function updateAmmoDisplay(ammo, reloading) {
    dctx.clearRect(0, 0, 256, 128);
    dctx.fillStyle = '#04100f';
    dctx.fillRect(0, 0, 256, 128);
    dctx.fillStyle = reloading ? '#ff8b42' : '#7ceef5';
    dctx.font = '700 58px "Arial Narrow", sans-serif';
    dctx.fillText(String(ammo).padStart(2, '0'), 18, 72);
    dctx.font = '600 15px "Arial Narrow", sans-serif';
    dctx.fillText(reloading ? 'VENTING' : 'PURGE-9', 18, 101);
    dctx.fillStyle = 'rgba(255,90,31,0.9)';
    dctx.fillRect(18, 109, 120 * (reloading ? state.reload : ammo / 12), 4);
    dctx.strokeStyle = 'rgba(124,238,245,0.3)';
    dctx.strokeRect(1, 1, 254, 126);
    displayTex.needsUpdate = true;
  }

  function update(dt, elapsed, input) {
    const aiming = input.aiming;
    const sprinting = input.sprinting;
    const moving = input.moving;
    const mouseDX = input.lookX || 0;
    const mouseDY = input.lookY || 0;

    state.swayX += (mouseDX * 0.00085 - state.swayX) * Math.min(1, dt * 8);
    state.swayY += (mouseDY * 0.00085 - state.swayY) * Math.min(1, dt * 8);
    state.recoil = THREE.MathUtils.damp(state.recoil, 0, 13, dt);
    state.recoilRot = THREE.MathUtils.damp(state.recoilRot, 0, 11, dt);
    state.flashLife = Math.max(0, state.flashLife - dt);
    const flashOn = state.flashLife > 0;
    flashMat.opacity = flashOn ? 0.85 + Math.random() * 0.15 : 0;
    flashCone.material.opacity = flashOn ? 0.7 : 0;
    muzzleLight.intensity = flashOn ? 6 + Math.random() * 5 : 0;

    let speed = moving ? (sprinting ? 1.35 : 0.72) : 0;
    state.bob += dt * (sprinting ? 11.5 : 8.4) * (moving ? 1 : 0.18);
    const bobAmt = aiming ? 0.0006 : 0.0065;
    const bobX = Math.sin(state.bob * 0.5) * bobAmt * speed;
    const bobY = Math.sin(state.bob) * bobAmt * speed;

    const target = aiming ? state.aimBase : state.base;
    const sprintOffset = sprinting ? 0.07 : 0;
    let px = THREE.MathUtils.damp(gun.position.x, target.x + bobX + state.swayX + sprintOffset, 12, dt);
    let py = THREE.MathUtils.damp(gun.position.y, target.y + bobY + state.swayY - sprintOffset * 0.6, 12, dt);
    let pz = THREE.MathUtils.damp(gun.position.z, target.z + state.recoil * 0.1, 14, dt);

    let rx = 0.02 + state.swayY * 0.7 + state.recoilRot * 0.12;
    let ry = 0.09 + state.swayX * 0.9;
    let rz = 0;
    if (sprinting) {
      rx += 0.09;
      ry += 0.3;
      rz -= 0.14;
    }
    if (aiming) {
      rx *= 0.3;
      ry *= 0.3;
      rz = 0;
    }
    if (state.reload > 0) {
      const r = state.reload;
      const arc = Math.sin(Math.min(1, r) * Math.PI);
      py -= arc * 0.17;
      rx += arc * 0.4;
      rz += arc * 0.35;
      ry -= arc * 0.2;
    }

    gun.position.set(px, py, pz);
    gun.rotation.set(rx, ry, rz);

    if (flashOn) muzzleLight.intensity = 6 + Math.random() * 5;
  }

  return {
    root,
    gun,
    muzzle,
    state,
    update,
    pullTrigger,
    setReload,
    updateAmmoDisplay,
    getMuzzleWorld(target = new THREE.Vector3()) {
      muzzle.getWorldPosition(target);
      return target;
    },
  };
}
