/* ============================================================
   AudioEngine — nhạc nền + SFX bằng Web Audio API
   Không dùng file ngoài => chạy offline, không vướng bản quyền.
   ============================================================ */
(function () {
  "use strict";

  var ctx = null;
  var master, musicGain, sfxGain, crowdGain;
  var muted = false;
  var musicOn = false;
  var noiseBuffer = null;
  var crowdSrc = null;

  // Music scheduler state
  var schedTimer = null;
  var nextNoteTime = 0;
  var step = 0;
  var stepDur = 0.25; // 8th note @120bpm
  var intensity = 0;

  // A-minor flavoured tension pattern (Hz)
  var BASS = [110.0, 110.0, 82.41, 110.0, 130.81, 110.0, 82.41, 98.0];
  var PAD = [220.0, 261.63, 329.63]; // Am triad-ish

  function ensure() {
    if (ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.0; musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(master);

    // crowd noise bed
    noiseBuffer = makeNoise(2.0);
    crowdGain = ctx.createGain(); crowdGain.gain.value = 0.0; crowdGain.connect(master);
    var bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 900; bp.Q.value = 0.7;
    crowdSrc = ctx.createBufferSource(); crowdSrc.buffer = noiseBuffer; crowdSrc.loop = true;
    crowdSrc.connect(bp); bp.connect(crowdGain); crowdSrc.start();
  }

  function makeNoise(seconds) {
    var len = Math.floor(ctx.sampleRate * seconds);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.6;
    return buf;
  }

  // Generic tone
  function tone(freq, start, dur, type, gainVal, glideTo) {
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, start);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gainVal, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g); g.connect(sfxGain);
    o.start(start); o.stop(start + dur + 0.05);
  }

  function noiseBurst(start, dur, gainVal, freq, q) {
    var src = ctx.createBufferSource(); src.buffer = noiseBuffer;
    var bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = freq || 1200; bp.Q.value = q || 1;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gainVal, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(bp); bp.connect(g); g.connect(sfxGain);
    src.start(start); src.stop(start + dur + 0.05);
  }

  /* ---------------- Music scheduler ---------------- */
  function scheduleStep(t) {
    // Bass pulse
    var bf = BASS[step % BASS.length];
    var o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = bf;
    var lp = ctx.createBiquadFilter(); lp.type = "lowpass";
    lp.frequency.value = 300 + intensity * 1400;
    var g = ctx.createGain();
    var accent = (step % 2 === 0) ? 0.16 : 0.09;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(accent, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + stepDur * 0.9);
    o.connect(lp); lp.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + stepDur);

    // Hi-hat tick on offbeats (brighter with intensity)
    if (step % 2 === 1) noiseBurstMusic(t, 0.05, 0.03 + intensity * 0.05);

    // Pad chord at bar start
    if (step % 8 === 0) {
      for (var i = 0; i < PAD.length; i++) {
        var po = ctx.createOscillator(); po.type = "triangle"; po.frequency.value = PAD[i];
        var pg = ctx.createGain();
        var pv = 0.03 + intensity * 0.03;
        pg.gain.setValueAtTime(0.0001, t);
        pg.gain.exponentialRampToValueAtTime(pv, t + 0.4);
        pg.gain.exponentialRampToValueAtTime(0.0001, t + stepDur * 8);
        po.connect(pg); pg.connect(musicGain);
        po.start(t); po.stop(t + stepDur * 8 + 0.1);
      }
    }
    // Tension arpeggio when intense
    if (intensity > 0.55 && step % 2 === 0) {
      var af = 440 * Math.pow(2, ((step % 8) / 12));
      tone(af, t, 0.12, "square", 0.02 * intensity, null);
    }
  }

  function noiseBurstMusic(start, dur, gainVal) {
    var src = ctx.createBufferSource(); src.buffer = noiseBuffer;
    var hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 6000;
    var g = ctx.createGain();
    g.gain.setValueAtTime(gainVal, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(hp); hp.connect(g); g.connect(musicGain);
    src.start(start); src.stop(start + dur + 0.03);
  }

  function scheduler() {
    while (nextNoteTime < ctx.currentTime + 0.12) {
      scheduleStep(nextNoteTime);
      nextNoteTime += stepDur;
      step++;
    }
  }

  /* ---------------- Public API ---------------- */
  var Engine = {
    unlock: function () {
      ensure();
      if (ctx.state === "suspended") ctx.resume();
    },
    get muted() { return muted; },
    setMuted: function (v) {
      muted = !!v; ensure();
      master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05);
    },
    toggleMuted: function () { this.setMuted(!muted); return muted; },

    startMusic: function () {
      ensure();
      if (musicOn) return;
      musicOn = true;
      musicGain.gain.setTargetAtTime(0.9, ctx.currentTime, 0.5);
      nextNoteTime = ctx.currentTime + 0.05; step = 0;
      schedTimer = setInterval(scheduler, 25);
    },
    stopMusic: function () {
      if (!musicOn) return;
      musicOn = false;
      if (schedTimer) { clearInterval(schedTimer); schedTimer = null; }
      if (musicGain) musicGain.gain.setTargetAtTime(0.0, ctx.currentTime, 0.4);
      this.setIntensity(0);
    },
    // 0..1 — raises music brightness + crowd noise
    setIntensity: function (v) {
      intensity = Math.max(0, Math.min(1, v));
      if (crowdGain) crowdGain.gain.setTargetAtTime(0.02 + intensity * 0.09, ctx.currentTime, 0.3);
    },

    // countdown beep: n = 3/2/1 (rising), n=0 => GO
    tick: function (n) {
      ensure();
      var t = ctx.currentTime;
      if (n > 0) {
        tone(440 + (3 - n) * 80, t, 0.18, "triangle", 0.35, null);
      }
    },
    go: function () {
      ensure();
      var t = ctx.currentTime;
      // rising horn
      tone(300, t, 0.5, "sawtooth", 0.4, 900);
      tone(150, t, 0.5, "square", 0.25, 450);
      noiseBurst(t, 0.35, 0.25, 1500, 0.6);
    },
    finish: function () {
      ensure();
      var t = ctx.currentTime;
      // Fanfare (major arpeggio up)
      var notes = [523.25, 659.25, 783.99, 1046.5];
      for (var i = 0; i < notes.length; i++) {
        tone(notes[i], t + i * 0.09, 0.5, "sawtooth", 0.28, null);
        tone(notes[i] / 2, t + i * 0.09, 0.5, "triangle", 0.18, null);
      }
      // sustained top
      tone(1046.5, t + 0.36, 0.9, "triangle", 0.22, null);
      // applause
      for (var k = 0; k < 5; k++) {
        noiseBurst(t + 0.3 + k * 0.12, 0.6, 0.14, 1400 + k * 200, 0.5);
      }
    }
  };

  window.AudioEngine = Engine;
})();
