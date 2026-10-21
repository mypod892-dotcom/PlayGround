import * as THREE from 'three';

function canvas(size, h = size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = h;
  return [c, c.getContext('2d')];
}

function seeded(seed = 7) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function tex(c, repeat = 1, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function grime(ctx, w, h, rand, count = 900) {
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = rand() * 2.2 + 0.2;
    ctx.fillStyle = `rgba(${6 + rand() * 18},${10 + rand() * 16},${10 + rand() * 14},${rand() * 0.2})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 18; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const len = 30 + rand() * 180;
    const g = ctx.createLinearGradient(x, y, x, y + len);
    g.addColorStop(0, 'rgba(0,0,0,0.18)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, 1 + rand() * 5, len);
  }
}

export function makeFloorTexture() {
  const [c, ctx] = canvas(2048);
  const rand = seeded(21);
  const base = ctx.createRadialGradient(1024, 1024, 20, 1024, 1024, 1024);
  base.addColorStop(0, '#27312e');
  base.addColorStop(0.33, '#182321');
  base.addColorStop(0.72, '#0d1514');
  base.addColorStop(1, '#070b0a');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 2048, 2048);

  // Concentric plate rings
  for (let ring = 1; ring < 9; ring++) {
    const radius = ring * 120;
    ctx.beginPath();
    ctx.arc(1024, 1024, radius, 0, Math.PI * 2);
    ctx.strokeStyle = ring === 4 ? 'rgba(255,90,31,0.16)' : 'rgba(174,193,186,0.09)';
    ctx.lineWidth = ring === 4 ? 5 : 2;
    ctx.stroke();
  }

  // radial seams
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(1024 + Math.cos(a) * 120, 1024 + Math.sin(a) * 120);
    ctx.lineTo(1024 + Math.cos(a) * 1030, 1024 + Math.sin(a) * 1030);
    ctx.strokeStyle = i % 7 === 0 ? 'rgba(255,90,31,0.1)' : 'rgba(180,196,188,0.055)';
    ctx.lineWidth = i % 7 === 0 ? 3 : 1;
    ctx.stroke();
  }

  // plate panels between rings
  for (let ring = 1; ring < 8; ring++) {
    const segments = 12 + ring * 2;
    for (let s = 0; s < segments; s++) {
      const a0 = (s / segments) * Math.PI * 2 + 0.006;
      const a1 = ((s + 1) / segments) * Math.PI * 2 - 0.006;
      const r0 = ring * 120 + 4;
      const r1 = (ring + 1) * 120 - 4;
      const shade = rand();
      ctx.beginPath();
      ctx.arc(1024, 1024, r1, a0, a1);
      ctx.arc(1024, 1024, r0, a1, a0, true);
      ctx.closePath();
      ctx.fillStyle = `rgba(${16 + shade * 16},${24 + shade * 19},${22 + shade * 17},0.35)`;
      ctx.fill();
      // rivets
      const ar = (a0 + a1) / 2;
      for (const rr of [r0 + 8, r1 - 8]) {
        const x = 1024 + Math.cos(ar) * rr;
        const y = 1024 + Math.sin(ar) * rr;
        ctx.beginPath();
        ctx.arc(x, y, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(200,218,209,0.22)';
        ctx.fill();
      }
    }
  }

  // Central vent grating
  const grad = ctx.createRadialGradient(1024, 1024, 20, 1024, 1024, 260);
  grad.addColorStop(0, 'rgba(255,90,31,0.24)');
  grad.addColorStop(0.5, 'rgba(8,12,11,0.9)');
  grad.addColorStop(1, 'rgba(8,12,11,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(1024, 1024, 260, 0, Math.PI * 2);
  ctx.fill();
  for (let i = -10; i <= 10; i++) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(1024 + i * 21, 800, 8, 448);
  }

  // hazard ring
  const hz = ctx.createPattern(makeHazardCanvas(512), 'repeat');
  ctx.save();
  ctx.beginPath();
  ctx.arc(1024, 1024, 880, 0, Math.PI * 2);
  ctx.arc(1024, 1024, 852, 0, Math.PI * 2, true);
  ctx.clip();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = hz;
  ctx.fillRect(0, 0, 2048, 2048);
  ctx.restore();

  // stencil markings
  ctx.save();
  ctx.translate(1024, 1024);
  ctx.rotate(-0.14);
  ctx.strokeStyle = 'rgba(169,245,255,0.1)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 715, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = '700 48px "Arial Narrow", sans-serif';
  ctx.fillStyle = 'rgba(169,245,255,0.12)';
  ctx.textAlign = 'center';
  ctx.fillText('SECTOR 07  //  PRESSURE CONTAINMENT', 0, -690);
  ctx.font = '700 26px "Arial Narrow", sans-serif';
  ctx.fillStyle = 'rgba(255,90,31,0.22)';
  ctx.fillText('CAUTION — HIGH PRESSURE — CAUTION', 0, 700);
  ctx.restore();

  // directional chevrons
  ctx.strokeStyle = 'rgba(255,90,31,0.17)';
  ctx.lineWidth = 10;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    ctx.save();
    ctx.translate(1024 + Math.cos(a) * 480, 1024 + Math.sin(a) * 480);
    ctx.rotate(a + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(-28, 26);
    ctx.lineTo(0, -10);
    ctx.lineTo(28, 26);
    ctx.stroke();
    ctx.restore();
  }

  grime(ctx, 2048, 2048, rand, 1600);

  // soft center glow
  const glow = ctx.createRadialGradient(1024, 1024, 40, 1024, 1024, 500);
  glow.addColorStop(0, 'rgba(255,120,40,0.11)');
  glow.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 2048, 2048);

  return tex(c);
}

function makeHazardCanvas(size) {
  const [c, ctx] = canvas(size);
  ctx.fillStyle = '#14120b';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#b56f1d';
  const step = size / 8;
  for (let i = -8; i < 16; i++) {
    ctx.save();
    ctx.translate(i * step * 1.5, 0);
    ctx.rotate(-0.38);
    ctx.fillRect(0, -size, step * 0.55, size * 3);
    ctx.restore();
  }
  return c;
}

export function makeHazardTexture() {
  const [c, ctx] = canvas(512);
  ctx.drawImage(makeHazardCanvas(512), 0, 0);
  const rand = seeded(4);
  grime(ctx, 512, 512, rand, 180);
  return tex(c);
}

export function makeWallTexture() {
  const [c, ctx] = canvas(2048, 512);
  const rand = seeded(88);
  const base = ctx.createLinearGradient(0, 0, 0, 512);
  base.addColorStop(0, '#080f0e');
  base.addColorStop(0.5, '#111b19');
  base.addColorStop(0.52, '#0a1211');
  base.addColorStop(1, '#050909');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 2048, 512);

  // vertical ribs
  for (let i = 0; i < 64; i++) {
    const x = i * 32;
    ctx.fillStyle = i % 2 ? 'rgba(180,200,192,0.035)' : 'rgba(0,0,0,0.18)';
    ctx.fillRect(x, 0, 3, 512);
    if (i % 8 === 0) {
      ctx.fillStyle = 'rgba(190,208,200,0.09)';
      ctx.fillRect(x - 3, 0, 9, 512);
    }
  }

  // horizontal frames
  for (const y of [36, 168, 344, 476]) {
    ctx.fillStyle = 'rgba(4,7,7,0.6)';
    ctx.fillRect(0, y, 2048, 11);
    ctx.fillStyle = 'rgba(200,216,208,0.11)';
    ctx.fillRect(0, y, 2048, 1.5);
    for (let x = 0; x < 2048; x += 64) {
      ctx.fillStyle = 'rgba(210,226,218,0.13)';
      ctx.beginPath();
      ctx.arc(x + 16, y + 5.5, 2.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // cyan light strips
  for (let i = 0; i < 8; i++) {
    const x = 70 + i * 258;
    const g = ctx.createLinearGradient(x, 0, x + 42, 0);
    g.addColorStop(0, 'rgba(78,220,230,0)');
    g.addColorStop(0.45, 'rgba(130,240,248,0.5)');
    g.addColorStop(0.55, 'rgba(194,252,255,0.72)');
    g.addColorStop(1, 'rgba(78,220,230,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 68, 42, 5);
    ctx.fillStyle = 'rgba(8,13,12,0.9)';
    ctx.fillRect(x - 4, 74, 50, 13);
  }

  // warning labels
  ctx.save();
  ctx.font = '700 18px "Arial Narrow", sans-serif';
  ctx.fillStyle = 'rgba(255,90,31,0.36)';
  ctx.fillText('DANGER — DO NOT OBSTRUCT', 130, 300);
  ctx.fillText('V-ARRAY // SEC-07', 1480, 300);
  ctx.font = '600 11px "Arial Narrow", sans-serif';
  ctx.fillStyle = 'rgba(169,245,255,0.2)';
  for (let i = 0; i < 12; i++) ctx.fillText('PRESSURE LINE 0' + (i + 1), 130 + i * 158, 442);
  ctx.restore();

  // hazard strip
  const hz = ctx.createPattern(makeHazardCanvas(128), 'repeat');
  ctx.save();
  ctx.globalAlpha = 0.34;
  ctx.fillStyle = hz;
  ctx.fillRect(0, 214, 2048, 22);
  ctx.restore();

  grime(ctx, 2048, 512, rand, 1300);

  // vertical grime streaks
  for (let i = 0; i < 80; i++) {
    const x = rand() * 2048;
    const len = 20 + rand() * 190;
    const g = ctx.createLinearGradient(0, 350, 0, 350 + len);
    g.addColorStop(0, 'rgba(0,0,0,0.16)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 350, 1 + rand() * 4, len);
  }

  return tex(c);
}

export function makeMetalTexture(seed = 33, base = [36, 44, 41]) {
  const [c, ctx] = canvas(512);
  const rand = seeded(seed);
  ctx.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 5000; i++) {
    const v = (rand() - 0.5) * 28;
    ctx.fillStyle = `rgba(${base[0] + v},${base[1] + v},${base[2] + v},${rand() * 0.28})`;
    ctx.fillRect(rand() * 512, rand() * 512, 1 + rand() * 2, 1 + rand() * 2);
  }
  for (let i = 0; i < 90; i++) {
    ctx.strokeStyle = `rgba(200,215,208,${rand() * 0.05})`;
    ctx.lineWidth = rand() * 1.2;
    const y = rand() * 512;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y + (rand() - 0.5) * 8);
    ctx.stroke();
  }
  grime(ctx, 512, 512, rand, 220);
  return tex(c, 1);
}

export function makeGrateTexture() {
  const [c, ctx] = canvas(512);
  ctx.fillStyle = '#0a100f';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = 'rgba(126,146,138,0.25)';
    ctx.fillRect(0, i * 32 + 5, 512, 14);
    ctx.fillStyle = 'rgba(230,245,238,0.07)';
    ctx.fillRect(0, i * 32 + 5, 512, 1);
  }
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(i * 128 + 8, 0, 9, 512);
  }
  ctx.fillStyle = 'rgba(255,90,31,0.16)';
  ctx.fillRect(0, 250, 512, 7);
  return tex(c, 3);
}

export function makeGlowTexture(color = '255,180,110') {
  const [c, ctx] = canvas(128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${color},1)`);
  g.addColorStop(0.18, `rgba(${color},0.88)`);
  g.addColorStop(0.45, `rgba(${color},0.25)`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeSmokeTexture() {
  const [c, ctx] = canvas(256);
  const rand = seeded(12);
  const g = ctx.createRadialGradient(128, 128, 4, 128, 128, 126);
  g.addColorStop(0, 'rgba(208,232,226,0.55)');
  g.addColorStop(0.35, 'rgba(168,200,196,0.22)');
  g.addColorStop(1, 'rgba(120,160,158,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 34; i++) {
    const x = 128 + (rand() - 0.5) * 120;
    const y = 128 + (rand() - 0.5) * 120;
    const r = 10 + rand() * 42;
    const gg = ctx.createRadialGradient(x, y, 0, x, y, r);
    gg.addColorStop(0, `rgba(230,246,241,${0.025 + rand() * 0.045})`);
    gg.addColorStop(1, 'rgba(230,246,241,0)');
    ctx.fillStyle = gg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeLabelTexture(lines, options = {}) {
  const [c, ctx] = canvas(512, 128);
  ctx.clearRect(0, 0, 512, 128);
  if (options.bg !== false) {
    ctx.fillStyle = options.bg || 'rgba(6,12,11,0.95)';
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = options.border || 'rgba(255,90,31,0.7)';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, 508, 124);
  }
  ctx.textAlign = 'left';
  const arr = Array.isArray(lines) ? lines : [lines];
  arr.forEach((line, i) => {
    ctx.font = `${i === 0 ? 700 : 500} ${i === 0 ? 42 : 22}px "Arial Narrow", sans-serif`;
    ctx.fillStyle = i === 0 ? (options.color || '#f2eadc') : 'rgba(242,234,220,0.45)';
    ctx.fillText(line, 24, i === 0 ? 55 : 92 + (i - 1) * 26);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeGaugeTexture() {
  const [c, ctx] = canvas(256);
  ctx.clearRect(0, 0, 256, 256);
  ctx.translate(128, 128);
  ctx.beginPath();
  ctx.arc(0, 0, 116, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(4,9,8,0.94)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(210,230,224,0.4)';
  ctx.lineWidth = 4;
  ctx.stroke();

  // tick marks
  for (let i = 0; i <= 40; i++) {
    const a = -Math.PI * 0.75 + (i / 40) * Math.PI * 1.5;
    const r0 = i % 5 === 0 ? 92 : 100;
    ctx.strokeStyle = i > 30 ? 'rgba(255,70,40,0.9)' : i > 22 ? 'rgba(255,176,46,0.9)' : 'rgba(169,245,255,0.75)';
    ctx.lineWidth = i % 5 === 0 ? 3 : 1.4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    ctx.lineTo(Math.cos(a) * 108, Math.sin(a) * 108);
    ctx.stroke();
  }

  // danger arc
  ctx.strokeStyle = 'rgba(255,59,50,0.8)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, 111, -Math.PI * 0.05, Math.PI * 0.15);
  ctx.stroke();

  // needle
  ctx.rotate(-Math.PI * 0.75 + Math.PI * 1.5 * 0.68);
  ctx.fillStyle = '#ff5a1f';
  ctx.shadowColor = '#ff5a1f';
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.moveTo(-5, 0);
  ctx.lineTo(98, 2.5);
  ctx.lineTo(-5, 5);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.rotate(-(-Math.PI * 0.75 + Math.PI * 1.5 * 0.68));
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fillStyle = '#1a2421';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,90,31,0.8)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = 'rgba(242,234,220,0.55)';
  ctx.textAlign = 'center';
  ctx.font = '700 18px "Arial Narrow", sans-serif';
  ctx.fillText('PSI', 0, 60);
  ctx.font = '500 11px "Arial Narrow", sans-serif';
  ctx.fillStyle = 'rgba(242,234,220,0.3)';
  ctx.fillText('V-RELIEF', 0, 78);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makePortalTexture() {
  const [c, ctx] = canvas(256);
  ctx.clearRect(0, 0, 256, 256);
  ctx.translate(128, 128);
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(0, 0, 30 + i * 17, Math.PI * 0.2 * i, Math.PI * 1.55 + Math.PI * 0.2 * i);
    ctx.strokeStyle = `rgba(255,${70 + i * 12},40,${0.5 - i * 0.055})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 110);
  g.addColorStop(0, 'rgba(255,220,180,0.55)');
  g.addColorStop(0.25, 'rgba(255,100,30,0.24)');
  g.addColorStop(1, 'rgba(255,60,20,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 110, 0, Math.PI * 2);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeBrushedRoughness(seed = 5) {
  const [c, ctx] = canvas(512);
  const rand = seeded(seed);
  ctx.fillStyle = '#8c8c8c';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2500; i++) {
    const v = 80 + rand() * 120;
    ctx.fillStyle = `rgba(${v},${v},${v},${rand() * 0.25})`;
    ctx.fillRect(rand() * 512, rand() * 512, 6 + rand() * 70, 1 + rand() * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
