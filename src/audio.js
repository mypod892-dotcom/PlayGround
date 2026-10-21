export function createAudio() {
  let ctx = null;
  let master = null;
  let ambientGain = null;
  let enabled = true;
  let started = false;
  let noiseBuffer = null;

  function makeNoise(seconds = 2) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function connect(node, gainValue = 1) {
    const g = ctx.createGain();
    g.gain.value = gainValue;
    node.connect(g);
    g.connect(master);
    return g;
  }

  function init() {
    if (started) {
      if (ctx?.state === 'suspended') ctx.resume();
      return;
    }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = enabled ? 0.45 : 0;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 20;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.25;
      master.connect(comp);
      comp.connect(ctx.destination);
      noiseBuffer = makeNoise(2.5);
      started = true;
      startAmbient();
    } catch {
      started = false;
    }
  }

  function startAmbient() {
    ambientGain = ctx.createGain();
    ambientGain.gain.value = 0;
    ambientGain.connect(master);
    ambientGain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 3);

    const drone = ctx.createOscillator();
    drone.type = 'sawtooth';
    drone.frequency.value = 41.2;
    const drone2 = ctx.createOscillator();
    drone2.type = 'sine';
    drone2.frequency.value = 82.5;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.16;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 170;
    drone.connect(lp);
    drone2.connect(lp);
    lp.connect(droneGain);
    droneGain.connect(ambientGain);
    drone.start();
    drone2.start();

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.055;
    lfo.connect(lfoGain);
    lfoGain.connect(droneGain.gain);
    lfo.start();

    // Air noise bed
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 420;
    nf.Q.value = 0.6;
    const ng = ctx.createGain();
    ng.gain.value = 0.026;
    noise.connect(nf);
    nf.connect(ng);
    ng.connect(ambientGain);
    noise.start();

    // Slow pressure pulses
    const pulse = () => {
      if (!started) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(58, t);
      osc.frequency.exponentialRampToValueAtTime(32, t + 0.55);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.11, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.62);
      osc.connect(g);
      g.connect(ambientGain);
      osc.start(t);
      osc.stop(t + 0.65);
      setTimeout(pulse, 2800 + Math.random() * 1700);
    };
    setTimeout(pulse, 1200);
  }

  function noiseBurst(duration = 0.2, gain = 0.2, filterFreq = 1500, type = 'lowpass') {
    if (!started) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start();
    src.stop(ctx.currentTime + duration);
  }

  function tone(freq, duration, gain = 0.12, type = 'sine', endFreq = null) {
    if (!started) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + duration);
  }

  return {
    init,
    toggle() {
      enabled = !enabled;
      if (master) master.gain.linearRampToValueAtTime(enabled ? 0.45 : 0, ctx.currentTime + 0.15);
      return enabled;
    },
    get enabled() {
      return enabled;
    },
    shoot() {
      if (!started) return;
      noiseBurst(0.09, 0.22, 1900, 'lowpass');
      tone(128, 0.16, 0.24, 'square', 52);
      tone(620, 0.055, 0.06, 'sine', 170);
    },
    hit(critical = false) {
      if (!started) return;
      tone(critical ? 1450 : 980, 0.07, critical ? 0.1 : 0.065, 'sine', critical ? 2100 : 1500);
      noiseBurst(0.035, 0.05, 5000, 'highpass');
    },
    kill() {
      if (!started) return;
      noiseBurst(0.32, 0.18, 750);
      tone(92, 0.38, 0.16, 'sawtooth', 30);
    },
    vent() {
      if (!started) return;
      noiseBurst(0.75, 0.2, 2600, 'bandpass');
      tone(420, 0.5, 0.06, 'sine', 1160);
      tone(82, 0.6, 0.12, 'sine', 44);
    },
    reload() {
      noiseBurst(0.08, 0.08, 2500, 'highpass');
      setTimeout(() => noiseBurst(0.14, 0.09, 1200), 280);
    },
    damage() {
      if (!started) return;
      noiseBurst(0.22, 0.16, 300);
      tone(64, 0.3, 0.12, 'sawtooth', 40);
    },
    wave() {
      if (!started) return;
      tone(180, 0.3, 0.08, 'square', 360);
      setTimeout(() => tone(270, 0.35, 0.08, 'square', 540), 180);
    },
    dash() {
      if (!started) return;
      noiseBurst(0.28, 0.12, 3200, 'highpass');
      tone(220, 0.2, 0.06, 'sine', 660);
    },
    gameover() {
      if (!started) return;
      tone(120, 1.5, 0.18, 'sawtooth', 24);
      noiseBurst(1.3, 0.16, 380);
    },
    empty() {
      if (!started) return;
      tone(240, 0.04, 0.06, 'square', 170);
    },
  };
}
