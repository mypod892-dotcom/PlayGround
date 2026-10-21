import * as THREE from 'three';
import {
  makeFloorTexture,
  makeHazardTexture,
  makeWallTexture,
  makeMetalTexture,
  makeGrateTexture,
  makeGlowTexture,
  makeSmokeTexture,
  makeLabelTexture,
  makeGaugeTexture,
  makePortalTexture,
  makeBrushedRoughness,
} from './textures.js';

const TAU = Math.PI * 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

function addShadow(scene, x, z, radius, opacity = 0.45) {
  const mat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity,
    depthWrite: false,
    map: makeGlowTexture('0,0,0'),
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.018, z);
  m.renderOrder = 1;
  scene.add(m);
  return m;
}

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

export function createWorld(scene) {
  const world = {
    valves: [],
    coreRings: [],
    coreLights: [],
    embers: null,
    dust: null,
    steamSystems: [],
    ventFlashes: [],
    portalTexture: makePortalTexture(),
    animate: null,
    vent(valve, flash = true) {
      valve.venting = 1.5;
      valve.cooldown = 9;
      if (flash) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(1.4, 0.055, 8, 64),
          new THREE.MeshBasicMaterial({ color: 0x9ff8ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
        );
        ring.position.copy(valve.group.position);
        ring.position.y = 2.25;
        ring.rotation.copy(valve.wheel.rotation);
        scene.add(ring);
        world.ventFlashes.push({ mesh: ring, life: 1 });
        valve.light.color.setHex(0x77f7ff);
        valve.light.intensity = 14;
      }
    },
    setValveCooldown(id, value) {
      const v = world.valves[id];
      if (v) v.cooldown = value;
    },
  };

  scene.background = new THREE.Color(0x020606);
  scene.fog = new THREE.FogExp2(0x04100f, 0.0135);

  const floorTex = makeFloorTexture();
  const wallTex = makeWallTexture();
  const metalTex = makeMetalTexture(31, [34, 42, 40]);
  const metalDarkTex = makeMetalTexture(77, [18, 24, 22]);
  const hazardTex = makeHazardTexture();
  const grateTex = makeGrateTexture();
  const rustRough = makeBrushedRoughness(6);
  const glowOrange = makeGlowTexture('255,132,56');
  const glowCyan = makeGlowTexture('150,245,255');
  const glowRed = makeGlowTexture('255,66,38');
  const smokeTex = makeSmokeTexture();
  const gaugeTex = makeGaugeTexture();

  const matFloor = new THREE.MeshStandardMaterial({
    map: floorTex,
    metalness: 0.62,
    roughness: 0.5,
    roughnessMap: rustRough,
    envMapIntensity: 0.95,
  });
  const matWall = new THREE.MeshStandardMaterial({
    map: wallTex,
    metalness: 0.66,
    roughness: 0.52,
    side: THREE.BackSide,
    envMapIntensity: 0.75,
  });
  const matMetal = new THREE.MeshStandardMaterial({ map: metalTex, metalness: 0.82, roughness: 0.36, roughnessMap: rustRough, envMapIntensity: 0.85 });
  const matMetalDark = new THREE.MeshStandardMaterial({ map: metalDarkTex, metalness: 0.84, roughness: 0.42, roughnessMap: rustRough, envMapIntensity: 0.7 });
  const matHazard = new THREE.MeshStandardMaterial({ map: hazardTex, metalness: 0.35, roughness: 0.7 });
  const matGrate = new THREE.MeshStandardMaterial({ map: grateTex, metalness: 0.9, roughness: 0.42 });
  const matCyan = new THREE.MeshStandardMaterial({ color: 0x9ff6ff, emissive: 0x53d9e6, emissiveIntensity: 1.35, roughness: 0.25, metalness: 0.3 });
  const matOrange = new THREE.MeshStandardMaterial({ color: 0xff8b42, emissive: 0xff4c12, emissiveIntensity: 1.7, roughness: 0.3, metalness: 0.1 });
  const matRed = new THREE.MeshStandardMaterial({ color: 0xff4636, emissive: 0xff1a0e, emissiveIntensity: 1.8, roughness: 0.35, metalness: 0.2 });
  const matBlackGlass = new THREE.MeshPhysicalMaterial({
    color: 0x06100e,
    metalness: 0.2,
    roughness: 0.08,
    transparent: true,
    opacity: 0.85,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });
  const matGlass = new THREE.MeshPhysicalMaterial({
    color: 0x7adbe1,
    metalness: 0.1,
    roughness: 0.06,
    transparent: true,
    opacity: 0.10,
    side: THREE.DoubleSide,
    depthWrite: false,
    clearcoat: 1,
  });

  // ---------------- FLOOR & WALLS ----------------

  const floor = new THREE.Mesh(new THREE.CircleGeometry(32, 128), matFloor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const underFloor = new THREE.Mesh(
    new THREE.CylinderGeometry(33, 35, 1.3, 128, 1, false),
    matMetalDark
  );
  underFloor.position.y = -0.66;
  scene.add(underFloor);

  const grimeRing = new THREE.Mesh(
    new THREE.RingGeometry(27.2, 30.4, 128),
    new THREE.MeshStandardMaterial({ map: matHazard.map, metalness: 0.4, roughness: 0.68, opacity: 0.65, transparent: true })
  );
  grimeRing.rotation.x = -Math.PI / 2;
  grimeRing.position.y = 0.012;
  grimeRing.material.map = makeHazardTexture();
  grimeRing.material.map.repeat.set(18, 1);
  scene.add(grimeRing);

  const wall = new THREE.Mesh(new THREE.CylinderGeometry(31.7, 31.7, 22, 96, 1, true), matWall);
  wall.position.y = 10.8;
  scene.add(wall);
  wallTex.repeat.set(1.5, 1);

  const ceiling = new THREE.Mesh(
    new THREE.CircleGeometry(31.8, 96),
    new THREE.MeshStandardMaterial({ color: 0x030707, metalness: 0.8, roughness: 0.7, side: THREE.DoubleSide })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 21.8;
  scene.add(ceiling);

  // Grating walkway ring
  const walk = new THREE.Mesh(new THREE.RingGeometry(20.2, 24.2, 128), matGrate);
  walk.rotation.x = -Math.PI / 2;
  walk.position.y = 0.045;
  scene.add(walk);

  const walkTrim = new THREE.Mesh(new THREE.TorusGeometry(24.2, 0.09, 6, 128), matHazard);
  walkTrim.rotation.x = Math.PI / 2;
  walkTrim.position.y = 0.09;
  scene.add(walkTrim);
  for (const [r, mat] of [[20.22, matCyan], [24.22, matOrange]]) {
    const edgeLight = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 5, 128), mat);
    edgeLight.rotation.x = Math.PI / 2;
    edgeLight.position.y = 0.08;
    scene.add(edgeLight);
  }

  // Raised central dais
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.6, 0.5, 64), matMetal);
  dais.position.y = 0.25;
  scene.add(dais);
  const daisTop = new THREE.Mesh(new THREE.RingGeometry(4.3, 7.0, 64), matGrate);
  daisTop.rotation.x = -Math.PI / 2;
  daisTop.position.y = 0.505;
  scene.add(daisTop);
  const daisRing = new THREE.Mesh(new THREE.TorusGeometry(7.18, 0.07, 6, 96), matOrange);
  daisRing.rotation.x = Math.PI / 2;
  daisRing.position.y = 0.52;
  scene.add(daisRing);

  const centerShadow = addShadow(scene, 0, 0, 8.4, 0.62);

  // ---------------- PERIMETER COLUMNS / PIPES ----------------

  const colGroup = new THREE.Group();
  scene.add(colGroup);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + 0.08;
    const x = Math.cos(a) * 29.5;
    const z = Math.sin(a) * 29.5;
    const h = 15 + (i % 3) * 1.4;
    const col = box(2.0, h, 2.4, matMetalDark, x, h / 2, z);
    col.rotation.y = -a;
    colGroup.add(col);

    const face = box(0.45, h * 0.64, 0.12, matMetal, x + Math.cos(a) * 1.0, h * 0.5, z + Math.sin(a) * 1.0);
    face.rotation.y = -a;
    colGroup.add(face);

    // Emissive conduit strip
    const strip = box(0.07, h * 0.48, 0.08, i % 4 === 0 ? matOrange : matCyan, x + Math.cos(a) * 1.26, h * 0.52, z + Math.sin(a) * 1.26);
    strip.rotation.y = -a;
    strip.material = strip.material.clone();
    strip.material.emissiveIntensity = i % 4 === 0 ? 3.4 : 2.5;
    colGroup.add(strip);

    // Hanging lamp
    if (i % 2 === 0) {
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, 0.4, 10), matMetal);
      lamp.position.set(x - Math.cos(a) * 2.5, 10.8, z - Math.sin(a) * 2.5);
      colGroup.add(lamp);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 8), i % 4 === 0 ? matOrange : matCyan);
      bulb.position.set(x - Math.cos(a) * 2.5, 10.55, z - Math.sin(a) * 2.5);
      colGroup.add(bulb);
    }

    // Vertical pipe beside column
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, h + 1, 10), matMetal);
    pipe.position.set(x + Math.cos(a + 0.1) * 1.65, (h + 1) / 2, z + Math.sin(a + 0.1) * 1.65);
    colGroup.add(pipe);
    for (let k = 0; k < 4; k++) {
      const clamp = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.045, 5, 12), matMetalDark);
      clamp.rotation.x = Math.PI / 2;
      clamp.position.set(pipe.position.x, 2.2 + k * 3.3, pipe.position.z);
      colGroup.add(clamp);
    }
  }

  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU + 0.09;
    const panel = box(0.1, 1.1, 0.1, i % 3 === 0 ? matOrange : matCyan, Math.cos(a) * 30.4, 4.1 + (i % 2) * 1.8, Math.sin(a) * 30.4);
    panel.rotation.y = -a;
    scene.add(panel);
  }

  // Ring pipes and cable bundles around hall
  const pipeRings = [
    { r: 25.8, y: 8.2, t: 0.26, mat: matMetalDark },
    { r: 26.4, y: 8.75, t: 0.15, mat: matMetal },
    { r: 25.2, y: 14.5, t: 0.3, mat: matMetalDark },
    { r: 24.7, y: 15.0, t: 0.13, mat: matMetalDark },
  ];
  for (const p of pipeRings) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(p.r, p.t, 10, 128), p.mat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = p.y;
    scene.add(ring);
    if (p.t < 0.2) {
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * TAU;
        const clamp = box(0.13, 0.42, 0.3, matMetalDark, Math.cos(a) * p.r, p.y + 0.28, Math.sin(a) * p.r);
        clamp.rotation.y = -a + Math.PI / 2;
        scene.add(clamp);
      }
    }
  }

  // Overhead cable curves
  const cableMat = new THREE.LineBasicMaterial({ color: 0x101817, transparent: true, opacity: 0.9 });
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU;
    const pts = [];
    for (let j = 0; j <= 12; j++) {
      const t = j / 12;
      const sag = Math.sin(t * Math.PI) * (1.5 + (i % 4) * 0.55);
      pts.push(V(Math.cos(a + t * 0.16) * 27.6, 17 - sag, Math.sin(a + t * 0.16) * 27.6));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(48)), cableMat);
    scene.add(line);
  }

  // Hanging warning signage
  const signTex = makeLabelTexture(['SECTOR 07', 'PRESSURE RELIEF ARRAY'], { bg: 'rgba(4,9,8,0.9)' });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.35;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), new THREE.MeshBasicMaterial({ map: signTex, transparent: true, side: THREE.DoubleSide }));
    sign.position.set(Math.cos(a) * 26.5, 5.6, Math.sin(a) * 26.5);
    sign.rotation.y = -a + Math.PI;
    scene.add(sign);
  }

  // Spot light cones
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.68;
    const cone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 3.1, 21, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color: i % 2 ? 0x6edce4 : 0xff7a3c,
        transparent: true,
        opacity: 0.023,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    cone.position.set(Math.cos(a) * 20, 10.5, Math.sin(a) * 20);
    scene.add(cone);
  }

  // ---------------- CENTRAL REACTOR ----------------

  const reactor = new THREE.Group();
  scene.add(reactor);

  const base1 = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.8, 0.7, 48), matMetalDark);
  base1.position.y = 0.86;
  reactor.add(base1);
  const base2 = new THREE.Mesh(new THREE.CylinderGeometry(3.65, 4.15, 0.5, 48), matMetal);
  base2.position.y = 1.42;
  reactor.add(base2);
  const base3 = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.55, 0.32, 48), matMetalDark);
  base3.position.y = 1.82;
  reactor.add(base3);

  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const x = Math.cos(a) * 3.55;
    const z = Math.sin(a) * 3.55;
    const support = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.2, 0.45), matMetal);
    support.position.set(x, 1.25, z);
    support.rotation.y = -a;
    reactor.add(support);
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.14, 8), matMetalDark);
    bolt.position.set(x, 1.9, z);
    reactor.add(bolt);
  }

  const innerGlassMat = matBlackGlass.clone();
  innerGlassMat.opacity = 0.2;
  const coreInner = new THREE.Mesh(new THREE.CylinderGeometry(1.52, 1.74, 6.9, 40, 1, true), innerGlassMat);
  coreInner.position.y = 5.2;
  reactor.add(coreInner);

  const shellMat = matMetalDark.clone();
  shellMat.side = THREE.DoubleSide;
  const shellSegments = 7;
  for (let i = 0; i < shellSegments; i++) {
    const a0 = (i / shellSegments) * TAU + 0.1;
    const arc = 0.78;
    const panel = new THREE.Mesh(
      new THREE.CylinderGeometry(2.22, 2.48, 6.8, 10, 1, true, a0, arc),
      shellMat
    );
    panel.position.y = 5.2;
    reactor.add(panel);

    for (const edge of [a0, a0 + arc]) {
      const rib = box(0.17, 6.95, 0.34, matMetal, Math.cos(edge) * 2.32, 5.2, Math.sin(edge) * 2.32);
      rib.rotation.y = -edge;
      reactor.add(rib);
      const edgeLight = box(0.05, 5.6, 0.06, i % 2 ? matOrange : matCyan, Math.cos(edge) * 2.51, 5.2, Math.sin(edge) * 2.51);
      edgeLight.rotation.y = -edge;
      reactor.add(edgeLight);
    }

    const midA = a0 + arc / 2;
    const latch = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.14, 8), matMetal);
    latch.rotation.z = Math.PI / 2;
    latch.position.set(Math.cos(midA) * 2.42, 5.2, Math.sin(midA) * 2.42);
    reactor.add(latch);
  }

  for (const y of [2.3, 4.2, 6.2, 8.1]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(2.42, 0.13, 8, 48), matMetal);
    band.rotation.x = Math.PI / 2;
    band.position.y = y;
    reactor.add(band);
  }

  const coreLabelTex = makeLabelTexture(['CORE 07', 'THERMAL LOCK'], { bg: 'rgba(4,8,7,0.94)' });
  const coreLabel = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.5), new THREE.MeshBasicMaterial({ map: coreLabelTex, transparent: true }));
  coreLabel.position.set(0, 7.55, 2.47);
  reactor.add(coreLabel);

  const energy = new THREE.Mesh(
    new THREE.CylinderGeometry(1.05, 1.25, 7.6, 32, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff5a1f, transparent: true, opacity: 0.46, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  );
  energy.position.y = 5.25;
  energy.userData.dynamic = true;
  reactor.add(energy);

  const energyCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.33, 0.52, 8.4, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffc184, transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  energyCore.position.y = 5.35;
  energyCore.userData.dynamic = true;
  reactor.add(energyCore);

  for (let i = 0; i < shellSegments; i++) {
    const a = ((i + 0.5) / shellSegments) * TAU + 0.1;
    const slit = box(0.2, 5.7, 0.2, i % 2 ? matOrange : matCyan, Math.cos(a) * 2.08, 5.2, Math.sin(a) * 2.08);
    slit.material = slit.material.clone();
    slit.material.emissiveIntensity = i % 2 ? 3.6 : 2.8;
    slit.rotation.y = -a;
    reactor.add(slit);
    const innerSlit = box(0.07, 5.7, 0.07, matOrange, Math.cos(a) * 1.92, 5.2, Math.sin(a) * 1.92);
    innerSlit.rotation.y = -a;
    reactor.add(innerSlit);
  }

  const glassShield = new THREE.Mesh(new THREE.CylinderGeometry(2.62, 2.62, 7.5, 48, 1, true), matGlass);
  glassShield.position.y = 5.2;
  reactor.add(glassShield);

  const shieldRings = [2.2, 4.3, 5.9, 8.5];
  for (const y of shieldRings) {
    const thick = y === 4.3 || y === 7.4;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.64, thick ? 0.16 : 0.09, 8, 64), thick ? matOrange : matCyan);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    reactor.add(ring);
  }

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.55, 2.0, 1.1, 48), matMetalDark);
  cap.position.y = 9.3;
  reactor.add(cap);
  const capRing = new THREE.Mesh(new THREE.TorusGeometry(2.14, 0.12, 8, 48), matOrange);
  capRing.rotation.x = Math.PI / 2;
  capRing.position.y = 9.9;
  reactor.add(capRing);

  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 1.2, 3.3, 24), matMetalDark);
  stack.position.y = 11.4;
  reactor.add(stack);
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(1.04 - i * 0.1, 0.07, 6, 30), matMetal);
    r.rotation.x = Math.PI / 2;
    r.position.y = 10.4 + i * 0.85;
    reactor.add(r);
  }

  // Rotating containment rings
  function addCoreRing(radius, tube, y, color) {
    const pivot = new THREE.Group();
    pivot.position.y = y;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 64), color);
    pivot.add(ring);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      const pod = box(0.24, 0.32, 0.24, matMetalDark, Math.cos(a) * radius, 0, Math.sin(a) * radius);
      pivot.add(pod);
      const light = box(0.08, 0.11, 0.08, matCyan, Math.cos(a) * radius, 0, Math.sin(a) * radius);
      pivot.add(light);
    }
    pivot.userData.dynamic = true;
    reactor.add(pivot);
    world.coreRings.push(pivot);
  }
  addCoreRing(3.15, 0.085, 3.55, matOrange);
  addCoreRing(3.15, 0.085, 6.95, matOrange);
  const midRing = new THREE.Group();
  midRing.position.y = 5.2;
  const midTorus = new THREE.Mesh(new THREE.TorusGeometry(3.75, 0.05, 6, 64), matCyan);
  midRing.userData.dynamic = true;
  midRing.add(midTorus);
  reactor.add(midRing);
  world.coreRings.push(midRing);

  // Steam around core
  const coreSteam = makeSteamEmitter(scene, new THREE.Vector3(0, 1.8, 0), 48, 1.7, 0.3, 0.38, smokeTex);
  world.steamSystems.push(coreSteam);

  // Core light
  const coreLight = new THREE.PointLight(0xff6b24, 36, 30, 1.9);
  coreLight.position.set(0, 4.2, 0);
  scene.add(coreLight);
  world.coreLights.push(coreLight);
  const coreLight2 = new THREE.PointLight(0x72ecf2, 22, 25, 2);
  coreLight2.position.set(0, 9.4, 0);
  scene.add(coreLight2);
  world.coreLights.push(coreLight2);

  // Hazard floor stencil around core
  const stencilTex = makeLabelTexture(['CAUTION', 'PRESSURE HAZARD'], { bg: 'rgba(0,0,0,0)' });
  const stencil = new THREE.Mesh(
    new THREE.PlaneGeometry(3.8, 0.95),
    new THREE.MeshBasicMaterial({ map: stencilTex, transparent: true, opacity: 0.45 })
  );
  stencil.position.set(0, 0.53, 5.7);
  stencil.rotation.x = -Math.PI / 2;
  stencil.rotation.z = Math.PI;
  scene.add(stencil);

  // ---------------- VALVE STATIONS ----------------

  const valveAngles = [Math.PI * 1.24, Math.PI * 1.76, Math.PI * 0.53];
  const valveNames = ['PRESSURE RELIEF / 01', 'PRESSURE RELIEF / 02', 'PRESSURE RELIEF / 03'];
  for (let i = 0; i < 3; i++) {
    const a = valveAngles[i];
    const radius = 17.3;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a));
    scene.add(group);

    const platform = box(4.1, 0.22, 2.8, matGrate, 0, 0.11, 0);
    group.add(platform);
    addShadow(scene, x, z, 2.6, 0.36);

    const housing = box(2.7, 0.85, 1.9, matMetalDark, 0, 0.56, 0);
    group.add(housing);
    const housingTop = box(2.95, 0.12, 2.1, matMetal, 0, 1.02, 0);
    group.add(housingTop);
    const hazardEdge = box(2.98, 0.1, 0.11, matHazard, 0, 1.06, 1.06);
    group.add(hazardEdge);

    // Vertical relief stack
    const stackPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 4.6, 20), matMetal);
    stackPipe.position.set(-0.95, 3.3, -0.35);
    group.add(stackPipe);
    const stackCap = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.35, 0.3, 20), matMetalDark);
    stackCap.position.set(-0.95, 5.7, -0.35);
    group.add(stackCap);
    for (let k = 0; k < 4; k++) {
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.055, 6, 18), matMetalDark);
      collar.rotation.x = Math.PI / 2;
      collar.position.set(-0.95, 1.4 + k * 1.1, -0.35);
      group.add(collar);
    }

    // Wheel
    const wheel = new THREE.Group();
    wheel.userData.dynamic = true;
    wheel.position.set(0.25, 2.5, 0.56);
    group.add(wheel);
    const wheelTorus = new THREE.Mesh(new THREE.TorusGeometry(1.03, 0.12, 10, 40), matMetal);
    wheel.add(wheelTorus);
    const wheelTorus2 = new THREE.Mesh(new THREE.TorusGeometry(0.83, 0.035, 6, 40), matCyan);
    wheel.add(wheelTorus2);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.33, 0.28, 12), matMetalDark);
    hub.rotation.x = Math.PI / 2;
    wheel.add(hub);
    for (let k = 0; k < 6; k++) {
      const spoke = box(0.11, 1.72, 0.09, matMetal, 0, 0, 0);
      spoke.rotation.z = (k / 6) * Math.PI;
      wheel.add(spoke);
    }
    const wheelLight = new THREE.Mesh(new THREE.TorusGeometry(1.115, 0.015, 4, 40), matOrange);
    wheelLight.position.z = 0.1;
    wheel.add(wheelLight);

    // Gauge
    const gauge = new THREE.Mesh(new THREE.CircleGeometry(0.53, 32), new THREE.MeshBasicMaterial({ map: gaugeTex, transparent: true }));
    gauge.position.set(1.18, 3.12, 0.57);
    gauge.userData.dynamic = true;
    group.add(gauge);
    const gaugeRim = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.05, 6, 32), matMetal);
    gaugeRim.position.set(1.18, 3.12, 0.55);
    group.add(gaugeRim);

    // Valve label
    const labelTex = makeLabelTexture([`V-0${i + 1}`, 'PRESSURE RELIEF'], { bg: 'rgba(5,10,9,0.96)' });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 0.39), new THREE.MeshBasicMaterial({ map: labelTex, transparent: true }));
    label.position.set(0, 1.36, 1.03);
    group.add(label);

    // warning beacon
    const beaconBase = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.3, 10), matMetalDark);
    beaconBase.position.set(1.22, 1.32, -0.72);
    group.add(beaconBase);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), matOrange.clone());
    beacon.material.emissiveIntensity = 2.6;
    beacon.position.set(1.22, 1.54, -0.72);
    group.add(beacon);
    const light = new THREE.PointLight(0xff6d2e, 0, 1, 2);
    const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowOrange,
      color: 0xff6d2e,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    glowSprite.scale.set(0.9, 0.9, 1);
    glowSprite.position.set(1.22, 1.7, -0.72);
    group.add(glowSprite);

    // pressure pipe from station to wall
    const p0 = V(x, 0.4, z);
    const p1 = V(x * 1.22, 0.4, z * 1.22);
    const p2 = V(x * 1.48, 7.5, z * 1.48);
    const curve = new THREE.CatmullRomCurve3([p0, p1, p2]);
    const pipe = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.22, 10, false), matMetal);
    scene.add(pipe);

    const steam = makeSteamEmitter(group, new THREE.Vector3(-0.95, 5.9, -0.35), 34, 2.5, 0.6, 0.16, smokeTex);
    world.steamSystems.push(steam);

    const valve = {
      id: i,
      group,
      wheel,
      wheelTorus,
      gauge,
      light,
      beacon,
      steam,
      label: valveNames[i],
      position: new THREE.Vector3(x, 0, z),
      cooldown: i === 2 ? 3 : 0,
      venting: 0,
      spin: 0,
    };
    world.valves.push(valve);
  }

  // ---------------- PROPS ----------------

  const crates = [
    [-21.5, 0, 8.8, 1.2, 0.3],
    [-22.3, 0, 6.2, 0.85, -0.2],
    [20.9, 0, -9.8, 1.3, 0.9],
    [18.7, 0, -12.2, 0.8, 0.2],
    [8.4, 0, 21.4, 1.1, -0.5],
    [-8.0, 0, 19.5, 0.9, 0.7],
    [22.3, 0, 13.5, 1.35, 0.1],
    [-18.0, 0, -16.4, 1.0, -0.9],
  ];
  for (const [x, , z, s, r] of crates) {
    const crate = new THREE.Group();
    crate.position.set(x, 0, z);
    crate.rotation.y = r;
    const body = box(2.1 * s, 1.5 * s, 1.4 * s, matMetalDark, 0, 0.75 * s, 0);
    crate.add(body);
    const top = box(2.15 * s, 0.09 * s, 1.45 * s, matMetal, 0, 1.51 * s, 0);
    crate.add(top);
    for (let e = -1; e <= 1; e += 2) {
      crate.add(box(0.08 * s, 1.2 * s, 0.09 * s, matOrange, e * 0.82 * s, 0.8 * s, 0.72 * s));
    }
    const stencilTex = makeLabelTexture(['V-DYN', 'PRESSURIZED'], { bg: 'rgba(8,14,12,0.0)', border: 'rgba(0,0,0,0)', color: 'rgba(255,120,55,0.8)' });
    const stencil = new THREE.Mesh(new THREE.PlaneGeometry(1.1 * s, 0.3 * s), new THREE.MeshBasicMaterial({ map: stencilTex, transparent: true, opacity: 0.7 }));
    stencil.position.set(0, 0.8 * s, 0.705 * s);
    crate.add(stencil);
    scene.add(crate);
    addShadow(scene, x, z, 1.7 * s, 0.3);
  }

  // Canister clusters
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + 0.16;
    const r = 23 + (i % 3) * 1.2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const canister = new THREE.Group();
    canister.position.set(x, 0, z);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 1.55, 16), matMetal);
    body.position.y = 0.78;
    canister.add(body);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.43, 16, 8, 0, TAU, 0, Math.PI / 2), matMetalDark);
    top.position.y = 1.55;
    canister.add(top);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.035, 5, 20), i % 2 ? matOrange : matCyan);
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.95;
    canister.add(band);
    scene.add(canister);
    addShadow(scene, x, z, 0.9, 0.26);
  }

  // ---------------- LIGHTING & ATMOSPHERE ----------------

  scene.add(new THREE.HemisphereLight(0x5b8d94, 0x0d100c, 1.08));
  const key = new THREE.DirectionalLight(0xffa46d, 2.4);
  key.position.set(11, 20, 12);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x63cbd7, 1.9);
  rim.position.set(-15, 11, -18);
  scene.add(rim);
  const sideWarm = new THREE.PointLight(0xff7b3b, 26, 32, 2);
  sideWarm.position.set(18, 8.5, -10);
  scene.add(sideWarm);
  const sideCool = new THREE.PointLight(0x5acdd8, 11, 30, 2);
  sideCool.position.set(-18, 7.5, 11);
  scene.add(sideCool);

  // Dust
  const dustCount = 900;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(dustCount * 3);
  const dustSeed = new Float32Array(dustCount);
  let rnd = 1234567;
  const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < dustCount; i++) {
    const r = Math.sqrt(rand()) * 28;
    const a = rand() * TAU;
    dustPos[i * 3] = Math.cos(a) * r;
    dustPos[i * 3 + 1] = 0.5 + rand() * 15;
    dustPos[i * 3 + 2] = Math.sin(a) * r;
    dustSeed[i] = rand();
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0xbfeee9,
    size: 0.055,
    map: glowCyan,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);
  world.dust = { points: dust, pos: dustPos, seeds: dustSeed };

  // Embers
  const emberCount = 260;
  const emberGeo = new THREE.BufferGeometry();
  const emberPos = new Float32Array(emberCount * 3);
  const emberSeed = new Float32Array(emberCount);
  for (let i = 0; i < emberCount; i++) {
    const r = rand() * 3.1;
    const a = rand() * TAU;
    emberPos[i * 3] = Math.cos(a) * r;
    emberPos[i * 3 + 1] = 0.6 + rand() * 8.5;
    emberPos[i * 3 + 2] = Math.sin(a) * r;
    emberSeed[i] = rand();
  }
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  const emberMat = new THREE.PointsMaterial({
    color: 0xff7a2e,
    size: 0.115,
    map: glowOrange,
    transparent: true,
    opacity: 0.84,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const embers = new THREE.Points(emberGeo, emberMat);
  scene.add(embers);
  world.embers = { points: embers, pos: emberPos, seeds: emberSeed };

  // Floor haze sprites
  const hazeMat = new THREE.SpriteMaterial({ map: smokeTex, color: 0x8fc9c4, transparent: true, opacity: 0.055, depthWrite: false });
  for (let i = 0; i < 16; i++) {
    const a = rand() * TAU;
    const r = 8 + rand() * 18;
    const sprite = new THREE.Sprite(hazeMat);
    sprite.position.set(Math.cos(a) * r, 0.8 + rand() * 2.2, Math.sin(a) * r);
    sprite.scale.set(5 + rand() * 7, 2 + rand() * 4, 1);
    scene.add(sprite);
  }

  // Extra vent steam
  for (const [x, z, color] of [[-12, -3, 0x6edce4], [12, 3, 0xff7c3a], [3, 14, 0x6edce4]]) {
    const vent = new THREE.Group();
    vent.position.set(x, 0.1, z);
    const grate = new THREE.Mesh(new THREE.CircleGeometry(0.75, 16), matGrate);
    grate.rotation.x = -Math.PI / 2;
    vent.add(grate);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.05, 5, 20), color === 0x6edce4 ? matCyan : matOrange);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.03;
    vent.add(ring);
    scene.add(vent);
    world.steamSystems.push(makeSteamEmitter(scene, new THREE.Vector3(x, 0.2, z), 28, 2.2, 0.35, 0.14, smokeTex));
  }

  // Reactive card in world: central warning stripe
  const midStripe = new THREE.Mesh(
    new THREE.TorusGeometry(16.2, 0.05, 5, 128),
    new THREE.MeshBasicMaterial({ color: 0xff5a1f, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  midStripe.rotation.x = Math.PI / 2;
  midStripe.position.y = 0.06;
  scene.add(midStripe);

  // ---------------- ANIMATION ----------------

  world.update = (dt, elapsed, pressureRatio = 0.63, active = false) => {
    // Reactor rotation & pulse
    world.coreRings.forEach((ring, i) => {
      ring.rotation.y += dt * (i === 1 ? -0.22 : i === 0 ? 0.16 : 0.07);
      ring.rotation.z = Math.sin(elapsed * 0.14 + i) * 0.04;
    });
    const pressure = 0.65 + pressureRatio * 1.8;
    const pulse = 1 + Math.sin(elapsed * (2.1 + pressureRatio * 3.4)) * 0.06 * pressure;
    energy.scale.set(pulse, 1, pulse);
    energyCore.scale.set(0.7 + pulse * 0.3, 1, 0.7 + pulse * 0.3);
    energy.material.opacity = 0.10 + Math.sin(elapsed * 3.6) * 0.025 + pressureRatio * 0.08;
    energyCore.material.opacity = 0.38 + Math.sin(elapsed * 5.1) * 0.08;
    coreLight.intensity = (30 + Math.sin(elapsed * 4.2) * 5) * (0.6 + pressureRatio * 0.7);
    coreLight2.intensity = 17 + Math.sin(elapsed * 2.2) * 4;
    matOrange.emissiveIntensity = 1.5 + Math.sin(elapsed * 3.2) * 0.4;
    midStripe.material.opacity = 0.15 + pressureRatio * 0.18 + Math.sin(elapsed * 2) * 0.04;

    // Floor haze drift
    // Dust
    const dp = world.dust.pos;
    for (let i = 0; i < dp.length / 3; i++) {
      const s = world.dust.seeds[i];
      dp[i * 3 + 1] += dt * (0.1 + s * 0.16);
      dp[i * 3] += Math.sin(elapsed * 0.13 + i) * dt * 0.045;
      dp[i * 3 + 2] += Math.cos(elapsed * 0.1 + i * 0.7) * dt * 0.04;
      if (dp[i * 3 + 1] > 17) dp[i * 3 + 1] = 0.6;
    }
    world.dust.points.geometry.attributes.position.needsUpdate = true;

    // Embers rise around core
    const ep = world.embers.pos;
    for (let i = 0; i < ep.length / 3; i++) {
      const s = world.embers.seeds[i];
      ep[i * 3 + 1] += dt * (0.55 + s * 0.9);
      ep[i * 3] += Math.sin(elapsed * 1.2 + i) * dt * 0.16;
      ep[i * 3 + 2] += Math.cos(elapsed * 1.1 + i * 1.3) * dt * 0.16;
      if (ep[i * 3 + 1] > 9.4) {
        ep[i * 3 + 1] = 0.55;
        const a = Math.random() * TAU;
        const r = Math.random() * 2.3;
        ep[i * 3] = Math.cos(a) * r;
        ep[i * 3 + 2] = Math.sin(a) * r;
      }
    }
    world.embers.points.geometry.attributes.position.needsUpdate = true;

    // Valves
    for (const v of world.valves) {
      v.cooldown = Math.max(0, v.cooldown - dt);
      v.venting = Math.max(0, v.venting - dt);
      const venting = v.venting > 0;
      v.spin += dt * (venting ? 7 : v.cooldown > 0 ? 0.35 : 0.12);
      v.wheel.rotation.z = v.spin;
      const cooldownRatio = Math.min(1, v.cooldown / 9);
      v.beacon.material.emissiveIntensity = v.cooldown > 0 ? 1.2 + Math.sin(elapsed * 9) * 0.5 : 3.5 + Math.sin(elapsed * 2) * 0.8;
      v.light.intensity = (v.cooldown > 0 ? 5 : 8) + Math.sin(elapsed * 5 + v.id) * 2;
      v.light.color.lerp(new THREE.Color(v.cooldown > 0 ? 0xff5a1f : 0x77f7ff), dt * 2.5);
      v.wheelTorus.material = v.cooldown > 0 ? matOrange : matCyan;
      if (venting) {
        v.light.intensity = 20 + Math.sin(elapsed * 22) * 8;
      }
      v.steam.mat.opacity = venting ? 0.35 : 0.06 + cooldownRatio * 0.05;
      v.steam.speed = venting ? 3.8 : 1.1;
      // pressure jitter gauge
      v.gauge.rotation.z = Math.sin(elapsed * (v.cooldown > 0 ? 18 : 3) + v.id) * (v.cooldown > 0 ? 0.09 : 0.02);
    }

    // Steam systems
    for (const s of world.steamSystems) {
      s.update(dt, elapsed);
    }

    // vent shockwaves
    for (let i = world.ventFlashes.length - 1; i >= 0; i--) {
      const f = world.ventFlashes[i];
      f.life -= dt * 1.8;
      f.mesh.scale.setScalar(1 + (1 - f.life) * 6);
      f.mesh.material.opacity = Math.max(0, f.life) * 0.65;
      if (f.life <= 0) {
        scene.remove(f.mesh);
        f.mesh.geometry.dispose();
        f.mesh.material.dispose();
        world.ventFlashes.splice(i, 1);
      }
    }
  };

  return world;
}

function makeSteamEmitter(parent, position, count, speed, spread, opacity, texture) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const rand = mulberry(Math.floor(position.x * 111 + position.z * 71 + position.y * 13) + count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rand() - 0.5) * spread * 2;
    pos[i * 3 + 1] = rand() * 2.6;
    pos[i * 3 + 2] = (rand() - 0.5) * spread * 2;
    seed[i] = rand();
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xb8d8d2,
    size: 0.78,
    map: texture,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.NormalBlending,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.position.copy(position);
  parent.add(points);
  return {
    points,
    mat,
    base: position.clone(),
    speed,
    pos,
    seed,
    spread,
    update(dt, elapsed) {
      const speedNow = this.speed || 1.1;
      for (let i = 0; i < this.pos.length / 3; i++) {
        const s = this.seed[i];
        this.pos[i * 3 + 1] += dt * (0.4 + s * 0.75) * speedNow;
        this.pos[i * 3] += Math.sin(elapsed * 0.7 + i * 2.1) * dt * 0.13;
        this.pos[i * 3 + 2] += Math.cos(elapsed * 0.6 + i * 1.7) * dt * 0.13;
        if (this.pos[i * 3 + 1] > 3.6) {
          this.pos[i * 3 + 1] = 0;
          this.pos[i * 3] = (Math.random() - 0.5) * this.spread * 2;
          this.pos[i * 3 + 2] = (Math.random() - 0.5) * this.spread * 2;
        }
      }
      this.points.geometry.attributes.position.needsUpdate = true;
    },
  };
}

function mulberry(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
