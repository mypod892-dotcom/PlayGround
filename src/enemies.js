import * as THREE from 'three';
import { makeGlowTexture, makePortalTexture, makeSmokeTexture } from './textures.js';

const TAU = Math.PI * 2;

function rand(min, max) {
  return min + Math.random() * (max - min);
}

export function createEnemySystem(scene) {
  const glowOrange = makeGlowTexture('255,94,38');
  const glowCyan = makeGlowTexture('126,242,248');
  const portalTex = makePortalTexture();
  const smokeTex = makeSmokeTexture();

  const bodyGeo = new THREE.OctahedronGeometry(0.66, 0);
  const coreGeo = new THREE.IcosahedronGeometry(0.27, 1);
  const ringGeo = new THREE.TorusGeometry(0.92, 0.025, 5, 32);
  const ringGeo2 = new THREE.TorusGeometry(0.72, 0.018, 5, 28);
  const finGeo = new THREE.BoxGeometry(0.08, 0.72, 0.18);
  const eyeGeo = new THREE.BoxGeometry(0.24, 0.055, 0.04);

  const matBody = new THREE.MeshStandardMaterial({ color: 0x2a3634, metalness: 0.88, roughness: 0.32 });
  const matArmor = new THREE.MeshStandardMaterial({ color: 0x46534f, metalness: 0.92, roughness: 0.26 });
  const matCore = new THREE.MeshStandardMaterial({ color: 0xffb27d, emissive: 0xff3f10, emissiveIntensity: 4.6, roughness: 0.15, metalness: 0.1 });
  const matRune = new THREE.MeshStandardMaterial({ color: 0xff5c32, emissive: 0xff2c0a, emissiveIntensity: 2.6, roughness: 0.3, metalness: 0.4 });
  const matEye = new THREE.MeshBasicMaterial({ color: 0xffd1ad });

  const enemies = [];
  const projectiles = [];
  const portals = [];
  const bursts = [];

  const projGeo = new THREE.SphereGeometry(0.06, 8, 6);
  const projMat = new THREE.MeshBasicMaterial({ color: 0xff7a42, blending: THREE.AdditiveBlending, transparent: true });
  const projGlowMat = new THREE.SpriteMaterial({ map: glowOrange, color: 0xff4f1f, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false });

  function buildEnemy() {
    const group = new THREE.Group();
    const spin = new THREE.Group();
    group.add(spin);

    const body = new THREE.Mesh(bodyGeo, matBody);
    body.scale.set(1, 0.82, 1);
    spin.add(body);

    const core = new THREE.Mesh(coreGeo, matCore);
    core.position.z = 0.38;
    spin.add(core);
    const eye = new THREE.Mesh(eyeGeo, matEye);
    eye.position.set(0, 0.13, 0.63);
    spin.add(eye);

    const r1 = new THREE.Mesh(ringGeo, matRune);
    r1.rotation.x = Math.PI / 2;
    spin.add(r1);
    const r2 = new THREE.Mesh(ringGeo2, matRune);
    r2.rotation.y = Math.PI / 2;
    spin.add(r2);

    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU;
      const fin = new THREE.Mesh(finGeo, matArmor);
      fin.position.set(Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62 - 0.08);
      fin.rotation.z = Math.cos(a) * 0.55;
      fin.rotation.y = -a;
      spin.add(fin);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.3, 0.035), matRune);
      tip.position.set(Math.cos(a) * 0.82, 0.34, Math.sin(a) * 0.82 - 0.08);
      tip.rotation.z = Math.cos(a) * 0.55 - 0.2;
      tip.rotation.y = -a;
      spin.add(tip);
    }

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowOrange,
      color: 0xff6e33,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    glow.scale.set(2.2, 2.2, 1);
    glow.position.z = 0.28;
    group.add(glow);

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 1.8),
      new THREE.MeshBasicMaterial({ map: makeGlowTexture('0,0,0'), transparent: true, opacity: 0.35, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.025;
    group.add(shadow);

    return { group, spin, core, r1, r2, glow };
  }

  function spawnPortal(position) {
    const group = new THREE.Group();
    group.position.copy(position);
    group.position.y = 1.6;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.05, 0.03, 4, 32),
      new THREE.MeshBasicMaterial({ color: 0xff7b3c, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: portalTex,
      color: 0xff6a28,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    sprite.scale.set(1.8, 1.8, 1);
    group.add(sprite, ring);
    const light = new THREE.PointLight(0xff5a1f, 12, 9, 2);
    group.add(light);
    scene.add(group);
    portals.push({ group, sprite, ring, light, life: 0.7, max: 0.7 });
  }

  function spawnWave(count, wave, playerPos, yaw = 0, onSpawn) {
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    for (let i = 0; i < count; i++) {
      const theta = wave === 1
        ? -1.3 + (i / Math.max(1, count - 1)) * 2.6 + rand(-0.12, 0.12)
        : (i / count) * TAU + rand(-0.15, 0.15);
      const dir = forward.clone().multiplyScalar(Math.cos(theta)).addScaledVector(right, Math.sin(theta));
      const dist = rand(9.5, 14.5);
      const pos = playerPos.clone().addScaledVector(dir, dist);
      const core = Math.hypot(pos.x, pos.z);
      if (core < 6.8) {
        pos.x = (pos.x / Math.max(0.01, core)) * 6.8;
        pos.z = (pos.z / Math.max(0.01, core)) * 6.8;
      } else if (core > 27.2) {
        pos.x = (pos.x / core) * 27.2;
        pos.z = (pos.z / core) * 27.2;
      }
      pos.y = 1.7 + rand(0, 1.1);
      spawnPortal(pos);

      const e = buildEnemy();
      e.group.position.copy(pos);
      e.group.position.y = 1.6 + rand(0.2, 1.2);
      e.group.scale.setScalar(0.01);
      scene.add(e.group);
      const enemy = {
        ...e,
        pos: e.group.position,
        health: 3 + Math.min(4, Math.floor(wave / 2)),
        maxHealth: 3 + Math.min(4, Math.floor(wave / 2)),
        speed: 2.1 + Math.min(2.1, wave * 0.16) + rand(-0.25, 0.35),
        orbitRadius: rand(7.5, 13),
        orbitDir: Math.random() > 0.5 ? 1 : -1,
        orbitAngle: Math.atan2(pos.z - playerPos.z, pos.x - playerPos.x),
        hoverOffset: rand(0, TAU),
        fireCooldown: 1.4 + rand(0.2, 2.8),
        spawnDelay: 0.22 + i * 0.17,
        age: 0,
        dying: false,
        deathTime: 0,
        bob: rand(0, TAU),
      };
      enemies.push(enemy);
      onSpawn?.(enemy);
    }
  }

  function spawnBurst(position, color = 0xff6a2e, count = 22, scale = 1) {
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array(count * 3);
    const vel = [];
    for (let i = 0; i < count; i++) {
      arr[i * 3] = position.x;
      arr[i * 3 + 1] = position.y;
      arr[i * 3 + 2] = position.z;
      const dir = new THREE.Vector3(rand(-1, 1), rand(-0.6, 1), rand(-1, 1)).normalize().multiplyScalar(rand(1.5, 5.5) * scale);
      vel.push(dir);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const mat = new THREE.PointsMaterial({
      color,
      size: 0.16 * scale,
      map: glowOrange,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.4, 0.03, 5, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    ring.position.copy(position);
    ring.rotation.x = Math.random() * Math.PI;
    scene.add(ring);
    bursts.push({ pts, arr, vel, mat, ring, life: 0.8, max: 0.8 });
  }

  function update(dt, elapsed, playerPos, callbacks) {
    // portals
    for (let i = portals.length - 1; i >= 0; i--) {
      const p = portals[i];
      p.life -= dt;
      const k = Math.max(0, p.life / p.max);
      p.sprite.material.opacity = Math.sin((1 - k) * Math.PI) * 0.9 + k * 0.25;
      p.sprite.scale.setScalar(1.5 + (1 - k) * 2.6);
      p.ring.scale.setScalar(0.2 + (1 - k) * 20);
      p.ring.material.opacity = k * 0.45;
      p.ring.rotation.z += dt * 3;
      p.light.intensity = k * 14;
      if (p.life <= 0) {
        scene.remove(p.group);
        p.ring.geometry.dispose();
        p.ring.material.dispose();
        p.sprite.material.dispose();
        portals.splice(i, 1);
      }
    }

    // enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.age += dt;

      if (e.dying) {
        e.deathTime += dt;
        const k = Math.max(0, 1 - e.deathTime / 0.3);
        e.group.scale.setScalar(k * 1.2);
        e.spin.rotation.y += dt * 14;
        if (e.deathTime > 0.3) {
          scene.remove(e.group);
          enemies.splice(i, 1);
        }
        continue;
      }

      // spawn scale
      if (e.age < e.spawnDelay + 0.45) {
        const k = Math.min(1, Math.max(0.01, (e.age - e.spawnDelay) / 0.45));
        e.group.scale.setScalar(k <= 0 ? 0.01 : k * (1 + Math.sin(k * Math.PI) * 0.12));
      } else {
        e.group.scale.setScalar(1.14);
      }

      const toPlayer = new THREE.Vector3(playerPos.x - e.pos.x, 0, playerPos.z - e.pos.z);
      const dist = toPlayer.length();
      toPlayer.normalize();
      const tangent = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).multiplyScalar(e.orbitDir);

      e.orbitAngle += dt * 0.25 * e.orbitDir;
      const desiredDist = e.orbitRadius + Math.sin(elapsed * 0.42 + e.bob) * 2.2;
      const desired = new THREE.Vector3(
        playerPos.x - toPlayer.x * desiredDist + tangent.x * Math.sin(elapsed * 0.55 + e.bob) * 2.5,
        1.9 + Math.sin(elapsed * 1.25 + e.hoverOffset) * 0.45,
        playerPos.z - toPlayer.z * desiredDist + tangent.z * Math.sin(elapsed * 0.55 + e.bob) * 2.5
      );
      if (dist > 28) desired.copy(playerPos);

      const move = desired.sub(e.pos);
      const moveLen = move.length();
      if (moveLen > 0.05) {
        move.normalize();
        const accel = e.speed * (dist > 18 ? 1.6 : 1);
        e.pos.x += move.x * accel * dt;
        e.pos.y += move.y * Math.min(1, 2.4 * dt);
        e.pos.z += move.z * accel * dt;
      }
      e.pos.y = THREE.MathUtils.damp(e.pos.y, 1.85 + Math.sin(elapsed * 1.3 + e.hoverOffset) * 0.35, 4, dt);

      // face player
      const targetYaw = Math.atan2(playerPos.x - e.pos.x, playerPos.z - e.pos.z);
      e.group.rotation.y = THREE.MathUtils.damp(e.group.rotation.y, targetYaw, 5, dt);
      e.group.rotation.z = Math.sin(elapsed * 1.1 + e.bob) * 0.06;
      e.spin.rotation.y += dt * 0.85;
      e.spin.rotation.x = Math.sin(elapsed * 0.7 + e.bob) * 0.13;
      e.r1.rotation.z += dt * 2.6;
      e.r2.rotation.z -= dt * 1.8;
      e.glow.material.opacity = 0.45 + Math.sin(elapsed * 4 + e.bob) * 0.14;

      // fire
      e.fireCooldown -= dt;
      if (e.fireCooldown <= 0 && e.age > e.spawnDelay + 0.7 && dist < 26 && !e.dying) {
        e.fireCooldown = rand(1.9, 3.4) + Math.max(0, 8 - dist) * 0.05;
        fireProjectile(e, playerPos);
      }
    }

    // projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += dt * 4;
      p.mesh.rotation.z += dt * 3;
      p.glow.material.opacity = 0.55 + Math.sin(elapsed * 22 + p.seed) * 0.25;
      const dx = p.mesh.position.x - playerPos.x;
      const dz = p.mesh.position.z - playerPos.z;
      const dy = p.mesh.position.y - (playerPos.y - 0.25);
      if (dx * dx + dz * dz < 0.62 * 0.62 && Math.abs(dy) < 1.1) {
        callbacks?.onPlayerHit?.(p.damage);
        spawnBurst(p.mesh.position, 0xff4c28, 9, 0.65);
        removeProjectile(i);
        continue;
      }
      if (p.life <= 0) {
        removeProjectile(i);
      }
    }

    // bursts
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.life -= dt;
      const posAttr = b.pts.geometry.attributes.position;
      for (let j = 0; j < b.vel.length; j++) {
        b.arr[j * 3] += b.vel[j].x * dt;
        b.arr[j * 3 + 1] += b.vel[j].y * dt;
        b.arr[j * 3 + 2] += b.vel[j].z * dt;
        b.vel[j].y -= 5.2 * dt;
        b.vel[j].multiplyScalar(1 - dt * 1.1);
      }
      posAttr.needsUpdate = true;
      b.mat.opacity = Math.max(0, b.life / b.max);
      b.mat.size = 0.16 + (1 - b.life / b.max) * 0.1;
      const k = 1 - b.life / b.max;
      b.ring.scale.setScalar(1 + k * 8);
      b.ring.material.opacity = (1 - k) * 0.7;
      if (b.life <= 0) {
        scene.remove(b.pts, b.ring);
        b.pts.geometry.dispose();
        b.pts.material.dispose();
        b.ring.geometry.dispose();
        b.ring.material.dispose();
        bursts.splice(i, 1);
      }
    }
  }

  function fireProjectile(e, playerPos) {
    const origin = e.pos.clone().add(new THREE.Vector3(0, 0.02, 0));
    const target = playerPos.clone();
    target.y -= 0.28;
    const dir = target.sub(origin).normalize();
    dir.x += rand(-0.035, 0.035);
    dir.y += rand(-0.02, 0.02);
    dir.z += rand(-0.035, 0.035);
    dir.normalize();
    const mesh = new THREE.Mesh(projGeo, projMat);
    mesh.position.copy(origin);
    const glow = new THREE.Sprite(projGlowMat.clone());
    glow.scale.set(0.34, 0.34, 1);
    mesh.add(glow);
    scene.add(mesh);
    projectiles.push({
      mesh,
      glow,
      vel: dir.multiplyScalar(13.5 + Math.random() * 2.5),
      life: 4,
      damage: 7 + Math.random() * 3,
      seed: Math.random() * 10,
    });
  }

  function removeProjectile(index) {
    const p = projectiles[index];
    scene.remove(p.mesh);
    p.glow.material.dispose();
    projectiles.splice(index, 1);
  }

  function tryHit(origin, direction, maxDistance = 60) {
    const ray = new THREE.Ray(origin, direction);
    let best = null;
    let bestDist = maxDistance;
    const sphere = new THREE.Sphere();
    for (const e of enemies) {
      if (e.dying || e.age < e.spawnDelay) continue;
      sphere.center.copy(e.pos);
      sphere.radius = 0.95;
      const hit = ray.intersectSphere(sphere, new THREE.Vector3());
      if (hit) {
        const d = origin.distanceTo(hit);
        if (d < bestDist) {
          bestDist = d;
          best = { enemy: e, point: hit, dist: d };
        }
      }
    }
    return best;
  }

  function damageEnemy(enemy, amount, point) {
    if (enemy.dying) return { killed: false, critical: false };
    const hitCore = point && point.distanceTo(enemy.pos) < 0.52;
    const dealt = amount * (hitCore ? 2 : 1);
    enemy.health -= dealt;
    enemy.spin.rotation.z += 0.6;
    spawnBurst(point || enemy.pos, hitCore ? 0xfff0c0 : 0xff7a3f, 8, 0.45);
    if (enemy.health <= 0) {
      enemy.dying = true;
      enemy.deathTime = 0;
      spawnBurst(enemy.pos, 0xff5a1f, 26, 1.1);
      return { killed: true, critical: hitCore };
    }
    return { killed: false, critical: hitCore };
  }

  function clear() {
    for (const e of enemies) scene.remove(e.group);
    enemies.length = 0;
    for (const p of projectiles) {
      scene.remove(p.mesh);
      p.glow.material.dispose();
    }
    projectiles.length = 0;
    for (const b of bursts) {
      scene.remove(b.pts, b.ring);
      b.pts.geometry.dispose();
      b.pts.material.dispose();
      b.ring.geometry.dispose();
      b.ring.material.dispose();
    }
    bursts.length = 0;
    for (const p of portals) {
      scene.remove(p.group);
      p.ring.geometry.dispose();
      p.ring.material.dispose();
      p.sprite.material.dispose();
    }
    portals.length = 0;
  }

  return {
    enemies,
    projectiles,
    bursts,
    spawnWave,
    spawnBurst,
    tryHit,
    damageEnemy,
    update,
    clear,
    get aliveCount() {
      return enemies.filter((e) => !e.dying).length;
    },
  };
}
