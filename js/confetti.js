/* ============================================================
   Confetti — pháo giấy ăn mừng trên canvas overlay
   ============================================================ */
(function () {
  "use strict";

  var canvas, ctx, W, H, dpr;
  var parts = [];
  var running = false;
  var COLORS = ["#1158f2", "#3d7bff", "#ffc53d", "#ffe08a", "#ffffff", "#6f9bff"];

  function init() {
    canvas = document.getElementById("confetti");
    ctx = canvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
  }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function rnd(a, b) { return a + Math.random() * (b - a); }

  function spawn(n, originX) {
    var ox = originX == null ? W / 2 : originX;
    for (var i = 0; i < n; i++) {
      parts.push({
        x: ox + rnd(-W * 0.18, W * 0.18),
        y: rnd(-40, H * 0.25),
        vx: rnd(-3.2, 3.2),
        vy: rnd(-4, 2),
        g: rnd(0.12, 0.24),
        w: rnd(7, 14), h: rnd(9, 18),
        rot: rnd(0, Math.PI * 2),
        vr: rnd(-0.24, 0.24),
        color: COLORS[(Math.random() * COLORS.length) | 0],
        sway: rnd(0.5, 1.6),
        phase: rnd(0, Math.PI * 2),
        life: rnd(140, 260)
      });
    }
    if (!running) { running = true; requestAnimationFrame(loop); }
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.phase += 0.08;
      p.vy += p.g;
      p.x += p.vx + Math.sin(p.phase) * p.sway;
      p.y += p.vy;
      p.rot += p.vr;
      p.life--;
      if (p.y > H + 30 || p.life <= 0) { parts.splice(i, 1); continue; }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.min(1, p.life / 60);
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (parts.length > 0) requestAnimationFrame(loop);
    else { running = false; ctx.clearRect(0, 0, W, H); }
  }

  window.Confetti = {
    init: init,
    burst: function (count, originX) {
      if (!ctx) init();
      spawn(count || 160, originX);
    },
    // Sustained celebration for a few seconds
    celebrate: function (durationMs) {
      if (!ctx) init();
      var end = performance.now() + (durationMs || 2600);
      var self = this;
      (function pump() {
        self.burst(40);
        if (performance.now() < end) setTimeout(pump, 260);
      })();
    },
    clear: function () { parts = []; if (ctx) ctx.clearRect(0, 0, W, H); }
  };
})();
