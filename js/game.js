/* ============================================================
   ĐUA VỊT PROTON — game.js
   - Chế độ loại dần: mỗi vòng 1 người về đích -> popup -> loại -> đua tiếp
   - Người thắng chọn NGẪU NHIÊN đồng đều (công bằng), animation kịch tính
   - Tối ưu desktop / màn LED
   ============================================================ */
(function () {
  "use strict";

  /* ---------------- DOM ---------------- */
  var $ = function (id) { return document.getElementById(id); };
  var canvas = $("track");
  var ctx = canvas.getContext("2d");

  var el = {
    roundNum: $("roundNum"), remainCount: $("remainCount"),
    winnersStrip: $("winnersStrip"), statusText: $("statusText"),
    countdown: $("countdown"), countNum: $("countNum"), idleHint: $("idleHint"),
    lbList: $("lbList"),
    btnStart: $("btnStart"), btnBackSetup: $("btnBackSetup"),
    btnRoster: $("btnRoster"), btnSound: $("btnSound"), btnFull: $("btnFull"),
    setupScrim: $("setupScrim"), winnerScrim: $("winnerScrim"),
    namesInput: $("namesInput"), nameCount: $("nameCount"),
    btnSample: $("btnSample"), btnShuffle: $("btnShuffle"), btnClear: $("btnClear"),
    btnApply: $("btnApply"),
    durationRange: $("durationRange"), durationVal: $("durationVal"),
    winnerName: $("winnerName"), winnerKicker: $("winnerKicker"),
    btnEliminate: $("btnEliminate"), btnRematch: $("btnRematch"), btnCloseWinner: $("btnCloseWinner")
  };

  var SAMPLE = [
    "Nguyễn Văn An","Trần Thị Bình","Lê Hoàng Cường","Phạm Thu Dung","Hoàng Minh Đức",
    "Vũ Thị Hà","Đặng Quốc Huy","Bùi Khánh Linh","Đỗ Thanh Nam","Ngô Phương Oanh",
    "Dương Tấn Phát","Lý Bảo Trân","Phan Gia Bảo","Võ Ngọc Hân","Huỳnh Tấn Lộc",
    "Đinh Thùy Trang","Trương Công Danh","Mai Thị Kim","Cao Đức Thịnh","Lâm Nhật Minh",
    "Hà Bảo Ngọc","Chu Văn Khánh","Tạ Quang Vinh","Vương Mỹ Linh","Đoàn Hải Đăng",
    "Lương Thảo My","Trịnh Xuân Bắc","Phùng Thị Loan","Tô Hoài Nam","Đào Duy Anh",
    "Hồ Ngọc Ánh","Nguyễn Hữu Phước","Trần Gia Hân","Lê Thị Ngân","Phạm Đình Khôi",
    "Hoàng Yến Nhi","Vũ Đức Toàn","Đặng Thị Mai","Bùi Tiến Dũng","Đỗ Hồng Nhung",
    "Ngô Quang Huy","Dương Thị Thảo","Lý Minh Quân","Phan Thị Hồng","Võ Thành Long",
    "Huỳnh Bảo Châu","Đinh Công Thành","Trương Thảo Vy","Mai Anh Tuấn","Cao Thị Lan",
    "Lâm Gia Huy","Hà Thị Thu","Chu Bảo Nam","Tạ Thị Hằng","Vương Đức Mạnh",
    "Đoàn Thị Diễm","Lương Chí Cường","Trịnh Thị Ánh","Phùng Gia Khang","Tô Thị Bích",
    "Đào Minh Tú","Hồ Thanh Tùng","Nguyễn Thị Mỹ Duyên"
  ];

  /* ---------------- State ---------------- */
  var STORE_KEY = "duavit_proton_v1";
  var state = {
    roster: [],       // {id, name, color, out:false}
    winners: [],      // {name, color}
    round: 1,
    duration: 9,
    phase: "idle"     // idle | countdown | running | finishing | finished
  };

  var race = null;    // active round data
  var dpr = 1, W = 0, H = 0;
  var lbRows = {};    // id -> DOM row (pool for leaderboard)
  var lastLbUpdate = 0;
  var lastFrame = 0;

  /* ---------------- Utils ---------------- */
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function uid() { return "p" + Math.random().toString(36).slice(2, 9); }
  function colorFor(i, n) { return "hsl(" + Math.round((i * 360 / Math.max(n, 8) + i * 47) % 360) + ",72%,58%)"; }
  function shade(hsl, dl) { return hsl.replace(/(\d+)%\)$/, function (_, l) { return clamp(+l + dl, 0, 100) + "%)"; }); }
  function active() { return state.roster.filter(function (p) { return !p.out; }); }

  /* ---------------- Persistence ---------------- */
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        roster: state.roster, winners: state.winners,
        round: state.round, duration: state.duration
      }));
    } catch (e) {}
  }
  function load() {
    try {
      var d = JSON.parse(localStorage.getItem(STORE_KEY));
      if (d && d.roster) {
        state.roster = d.roster; state.winners = d.winners || [];
        state.round = d.round || 1; state.duration = d.duration || 9;
        return true;
      }
    } catch (e) {}
    return false;
  }

  /* ---------------- Roster ---------------- */
  function setNamesFromText(text) {
    var names = text.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
    var n = names.length;
    state.roster = names.map(function (nm, i) {
      return { id: uid(), name: nm, color: colorFor(i, n), out: false };
    });
    state.winners = [];
    state.round = 1;
    save();
  }
  function rosterText() { return state.roster.map(function (p) { return p.name; }).join("\n"); }

  /* ---------------- Setup modal ---------------- */
  function openSetup() {
    el.namesInput.value = rosterText();
    updateNameCount();
    el.durationRange.value = state.duration;
    el.durationVal.textContent = state.duration;
    el.setupScrim.classList.add("open");
  }
  function closeSetup() { el.setupScrim.classList.remove("open"); }
  function updateNameCount() {
    var n = el.namesInput.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean).length;
    el.nameCount.textContent = n;
  }

  /* ---------------- Canvas sizing ---------------- */
  function sizeCanvas() {
    var r = canvas.getBoundingClientRect();
    W = Math.max(320, r.width); H = Math.max(200, r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }

  /* ---------------- Track geometry ---------------- */
  function geometry(n) {
    var padT = Math.max(18, H * 0.04), padB = Math.max(18, H * 0.04);
    var padL = Math.max(70, W * 0.06), padR = Math.max(90, W * 0.09);
    var laneH = (H - padT - padB) / n;
    var finishX = W - padR;
    return { padT: padT, padB: padB, padL: padL, padR: padR, laneH: laneH, finishX: finishX };
  }

  /* ---------------- Build a round ---------------- */
  function buildRace() {
    var list = active();
    var n = list.length;
    var winnerIdx = Math.floor(Math.random() * n);   // uniform fair winner

    // choose a lead pack of contenders for a tense photo finish
    var contenders = {};
    var cCount = Math.min(n - 1, Math.max(2, Math.round(n * 0.18)));
    contenders[winnerIdx] = true;
    var picked = 0, guard = 0;
    while (picked < cCount && guard++ < n * 4) {
      var idx = Math.floor(Math.random() * n);
      if (!contenders[idx]) { contenders[idx] = true; picked++; }
    }

    var ducks = list.map(function (p, i) {
      var isWin = (i === winnerIdx);
      var isCont = !!contenders[i];
      var f = isWin ? 1.0 : isCont ? rnd(0.94, 0.985) : rnd(0.74, 0.93);
      var ampMax = isCont ? 0.18 : 0.10;
      return {
        p: p, lane: i, isWinner: isWin,
        f: f,
        a1: rnd(0.05, ampMax), k1: rnd(1.4, 3.2), ph1: rnd(0, Math.PI * 2),
        a2: rnd(0.03, ampMax * 0.6), k2: rnd(2.0, 4.5), ph2: rnd(0, Math.PI * 2),
        bob: rnd(0, Math.PI * 2),
        prog: 0
      };
    });

    race = {
      list: list, ducks: ducks, n: n, winnerIdx: winnerIdx,
      u: 0, geo: geometry(n),
      cam: { s: 1, fx: W / 2, fy: H / 2 },
      done: false
    };
    buildLeaderboard();
  }

  function progressAt(d, u) {
    var wob = (d.a1 * Math.sin(2 * Math.PI * d.k1 * u + d.ph1)
             + d.a2 * Math.sin(2 * Math.PI * d.k2 * u + d.ph2)) * (u * (1 - u));
    var v = d.f * u + wob;
    return clamp(v, 0, d.isWinner ? 1 : 0.992);
  }

  /* ---------------- Drawing ---------------- */
  function drawWater() {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0a2472"); g.addColorStop(0.5, "#08194f"); g.addColorStop(1, "#040f30");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // moving shimmer bands
    var t = performance.now() / 1000;
    ctx.save(); ctx.globalAlpha = 0.06; ctx.strokeStyle = "#8fb4ff"; ctx.lineWidth = 2;
    for (var i = 0; i < 6; i++) {
      var yy = (i / 6) * H + ((t * 20 + i * 40) % H);
      ctx.beginPath();
      for (var x = 0; x <= W; x += 24) ctx.lineTo(x, yy % H + Math.sin(x / 60 + t + i) * 6);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawLanes(geo, n) {
    ctx.save();
    ctx.strokeStyle = "rgba(143,180,255,0.08)"; ctx.lineWidth = 1;
    for (var i = 0; i <= n; i++) {
      var y = geo.padT + geo.laneH * i;
      ctx.beginPath(); ctx.moveTo(geo.padL - 30, y); ctx.lineTo(geo.finishX + 40, y); ctx.stroke();
    }
    // start gate
    ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(geo.padL, geo.padT); ctx.lineTo(geo.padL, H - geo.padB); ctx.stroke();

    // finish line — checkered
    var sq = Math.max(8, geo.laneH / 3);
    for (var yy = geo.padT; yy < H - geo.padB; yy += sq) {
      for (var c = 0; c < 2; c++) {
        var row = Math.floor((yy - geo.padT) / sq);
        ctx.fillStyle = ((row + c) % 2 === 0) ? "#ffffff" : "#0b1a5c";
        ctx.fillRect(geo.finishX + c * sq, yy, sq, sq);
      }
    }
    ctx.restore();
  }

  function drawDuck(x, y, size, color, bob, leader) {
    var b = Math.sin(bob) * size * 0.06;
    y += b;
    ctx.save();
    ctx.translate(x, y);

    // wake
    ctx.save();
    ctx.globalAlpha = 0.25; ctx.fillStyle = "#bcd4ff";
    ctx.beginPath();
    ctx.ellipse(-size * 0.9, size * 0.35, size * 1.0, size * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (leader) {
      ctx.save();
      ctx.shadowColor = "rgba(255,197,61,0.9)"; ctx.shadowBlur = size * 0.9;
      ctx.fillStyle = "rgba(255,197,61,0.0)";
      ctx.beginPath(); ctx.arc(0, 0, size * 0.9, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // body
    ctx.fillStyle = color;
    ctx.strokeStyle = shade(color, -22); ctx.lineWidth = Math.max(1, size * 0.06);
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.78, size * 0.58, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // tail
    ctx.beginPath();
    ctx.moveTo(-size * 0.6, -size * 0.1);
    ctx.quadraticCurveTo(-size * 1.1, -size * 0.35, -size * 0.55, size * 0.15);
    ctx.closePath(); ctx.fill();

    // head
    var hx = size * 0.6, hy = -size * 0.55;
    ctx.beginPath(); ctx.arc(hx, hy, size * 0.42, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // beak
    ctx.fillStyle = "#ff9f1c";
    ctx.beginPath();
    ctx.moveTo(hx + size * 0.32, hy - size * 0.02);
    ctx.lineTo(hx + size * 0.85, hy + size * 0.05);
    ctx.lineTo(hx + size * 0.32, hy + size * 0.2);
    ctx.closePath(); ctx.fill();

    // eye
    ctx.fillStyle = "#0b1330";
    ctx.beginPath(); ctx.arc(hx + size * 0.16, hy - size * 0.08, size * 0.09, 0, Math.PI * 2); ctx.fill();

    // wing
    ctx.fillStyle = shade(color, -12);
    ctx.beginPath();
    ctx.ellipse(-size * 0.05, size * 0.05, size * 0.42, size * 0.3, -0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawNameLabel(text, duckX, y, size, geo, leader) {
    var fs = clamp(geo.laneH * 0.42, 10, 40);
    ctx.save();
    ctx.font = "700 " + fs + "px " + fontFamily();
    ctx.textBaseline = "middle";
    var w = ctx.measureText(text).width;
    var pad = fs * 0.4;
    var boxRight = duckX - size * 0.95;
    var boxLeft = boxRight - w - pad * 2;
    if (boxLeft < 2) { boxLeft = 2; boxRight = boxLeft + w + pad * 2; }
    // pill bg
    ctx.fillStyle = leader ? "rgba(255,197,61,0.92)" : "rgba(3,10,38,0.55)";
    roundRect(boxLeft, y - fs * 0.72, w + pad * 2, fs * 1.44, fs * 0.6);
    ctx.fill();
    ctx.fillStyle = leader ? "#08194f" : "#eaf0ff";
    ctx.textAlign = "left";
    ctx.fillText(text, boxLeft + pad, y);
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function fontFamily() { return '"Be Vietnam Pro", system-ui, sans-serif'; }

  /* ---------------- Render frame ---------------- */
  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawWater();
    if (!race) return;

    var geo = race.geo, cam = race.cam;

    ctx.save();
    // camera transform (zoom towards focus)
    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.s, cam.s);
    ctx.translate(-cam.fx, -cam.fy);

    drawLanes(geo, race.n);

    // rank order to know leader
    var order = race.ducks.slice().sort(function (a, b) { return b.prog - a.prog; });
    var leaderId = order[0] ? order[0].p.id : null;

    // draw ducks (winner/leader last for top z)
    for (var i = 0; i < race.ducks.length; i++) {
      var d = race.ducks[i];
      var y = geo.padT + geo.laneH * (d.lane + 0.5);
      var x = geo.padL + d.prog * (geo.finishX - geo.padL);
      var size = clamp(geo.laneH * 0.36, 7, 46);
      var racing = state.phase === "running" || state.phase === "finishing" || state.phase === "finished";
      var isLeader = racing && d.p.id === leaderId;
      drawDuck(x, y, size, d.p.color, d.bob, isLeader);
      if (geo.laneH > 16 || cam.s > 1.3 || isLeader) {
        drawNameLabel(d.p.name, x, y, size, geo, isLeader && state.phase === "running");
      }
    }
    ctx.restore();
  }

  /* ---------------- Camera update ---------------- */
  function updateCamera(dt) {
    var geo = race.geo, cam = race.cam;
    var win = race.ducks[race.winnerIdx];
    var wp = win.prog;
    var tS = 1, tfx = W / 2, tfy = H / 2;
    if (wp > 0.8 && state.phase !== "finished") {
      var k = clamp((wp - 0.8) / 0.2, 0, 1);
      tS = lerp(1, Math.min(2.0, 1 + (geo.laneH < 26 ? 1.0 : 0.55)), k);
      var wx = geo.padL + wp * (geo.finishX - geo.padL);
      var wy = geo.padT + geo.laneH * (win.lane + 0.5);
      tfx = lerp(W / 2, clamp(wx, W * 0.35, geo.finishX - 20), k);
      tfy = lerp(H / 2, wy, k);
    }
    var sp = 1 - Math.pow(0.001, dt); // frame-rate independent smoothing
    cam.s = lerp(cam.s, tS, sp);
    cam.fx = lerp(cam.fx, tfx, sp);
    cam.fy = lerp(cam.fy, tfy, sp);
  }

  /* ---------------- Leaderboard ---------------- */
  var LB_STEP = 70, LB_VISIBLE = 6;
  function clearLeaderboard() {
    el.lbList.innerHTML = "";
    lbRows = {};
  }
  // One persistent row per participant — created once, only re-positioned by rank.
  function buildLeaderboard() {
    clearLeaderboard();
    race.list.forEach(function (p) {
      var row = document.createElement("div");
      row.className = "lb-row";
      row.innerHTML = '<div class="lb-rank"></div>'
        + '<div class="lb-duck"></div>'
        + '<div class="lb-info"><div class="lb-name"></div><div class="lb-bar"><i></i></div></div>';
      row.querySelector(".lb-duck").style.background = p.color;
      row.querySelector(".lb-name").textContent = p.name;
      row.style.transform = "translateY(" + (LB_VISIBLE * LB_STEP) + "px)";
      row.style.opacity = "0";
      el.lbList.appendChild(row);
      lbRows[p.id] = row;
    });
  }
  function updateLeaderboard(force) {
    var now = performance.now();
    if (!force && now - lastLbUpdate < 90) return;
    lastLbUpdate = now;

    var order = race.ducks.slice().sort(function (a, b) { return b.prog - a.prog; });
    for (var i = 0; i < order.length; i++) {
      var d = order[i], row = lbRows[d.p.id];
      if (!row) continue;
      if (i < LB_VISIBLE) {
        row.querySelector(".lb-rank").textContent = (i + 1);
        row.querySelector(".lb-bar > i").style.width = Math.round(d.prog * 100) + "%";
        row.classList.toggle("lead", i === 0);
        row.style.transform = "translateY(" + (i * LB_STEP) + "px)";
        row.style.opacity = "1";
        row.style.zIndex = String(LB_VISIBLE - i);
      } else {
        row.style.transform = "translateY(" + (LB_VISIBLE * LB_STEP) + "px)";
        row.style.opacity = "0";
        row.style.zIndex = "0";
      }
    }
  }

  /* ---------------- Main loop ---------------- */
  function loop(ts) {
    var dt = lastFrame ? Math.min(0.05, (ts - lastFrame) / 1000) : 0.016;
    lastFrame = ts;

    if (race && state.phase === "running") {
      var speed = race.u > 0.9 ? 0.5 : 1;               // slow-mo final stretch
      race.u = clamp(race.u + (dt / state.duration) * speed, 0, 1);
      for (var i = 0; i < race.ducks.length; i++) {
        race.ducks[i].prog = progressAt(race.ducks[i], race.u);
        race.ducks[i].bob += dt * 6;
      }
      updateCamera(dt);
      updateLeaderboard(false);
      if (AudioEngine) AudioEngine.setIntensity(0.2 + race.u * 0.8);

      if (race.u >= 1) finishRace();
    } else if (race && (state.phase === "finishing" || state.phase === "finished")) {
      updateCamera(dt);
    } else if (race && (state.phase === "idle" || state.phase === "countdown")) {
      // gentle idle bobbing on the starting grid
      for (var j = 0; j < race.ducks.length; j++) race.ducks[j].bob += dt * 2.2;
    }

    render();
    requestAnimationFrame(loop);
  }

  /* ---------------- Flow: countdown -> race ---------------- */
  function startRound() {
    if (active().length < 2) { flashStatus("Cần ít nhất 2 người để đua."); return; }
    if (state.phase === "running" || state.phase === "countdown") return;

    AudioEngine.unlock();
    if (!AudioEngine.muted) AudioEngine.startMusic();

    buildRace();
    el.idleHint.style.display = "none";
    el.btnStart.disabled = true;
    el.btnBackSetup.disabled = true;
    state.phase = "countdown";
    setStatus("");

    var seq = [3, 2, 1, 0];
    el.countdown.hidden = false;
    var step = 0;
    (function next() {
      var n = seq[step];
      el.countNum.textContent = n === 0 ? "XUẤT PHÁT!" : n;
      el.countNum.classList.toggle("go", n === 0);
      // re-trigger pop animation
      el.countNum.style.animation = "none"; void el.countNum.offsetWidth; el.countNum.style.animation = "";
      if (n === 0) { AudioEngine.go(); } else { AudioEngine.tick(n); }
      step++;
      if (step < seq.length) { setTimeout(next, 850); }
      else {
        setTimeout(function () {
          el.countdown.hidden = true;
          el.countNum.classList.remove("go");
          state.phase = "running";
          race.u = 0;
          updateLeaderboard(true);
        }, 700);
      }
    })();
  }

  function finishRace() {
    if (race.done) return;
    race.done = true;
    state.phase = "finishing";
    // snap winner to line, freeze others just behind
    var win = race.ducks[race.winnerIdx];
    win.prog = 1;
    for (var i = 0; i < race.ducks.length; i++) {
      if (i !== race.winnerIdx) race.ducks[i].prog = Math.min(race.ducks[i].prog, 0.99);
    }
    updateLeaderboard(true);
    AudioEngine.finish();
    AudioEngine.setIntensity(0.15);
    Confetti.celebrate(2600);

    setTimeout(function () {
      state.phase = "finished";
      showWinner(win.p);
    }, 1300);
  }

  /* ---------------- Winner modal ---------------- */
  function showWinner(person) {
    el.winnerName.textContent = person.name;
    el.winnerKicker.textContent = "VỀ ĐÍCH · HẠNG " + (state.winners.length + 1);
    el.winnerScrim.classList.add("open");
    el.winnerScrim._person = person;
    Confetti.burst(220);
  }
  function closeWinner() { el.winnerScrim.classList.remove("open"); }

  function eliminateWinner() {
    var person = el.winnerScrim._person;
    if (!person) return;
    var p = state.roster.filter(function (x) { return x.id === person.id; })[0];
    if (p) p.out = true;
    state.winners.push({ name: person.name, color: person.color });
    state.round++;
    save();
    closeWinner();
    resetToIdle();
    renderMeta();

    if (active().length < 2) {
      var champ = active()[0];
      if (champ) {
        setStatus("🏁 Chỉ còn " + champ.name + " — đã trao hết giải! Mở ☰ để chơi lại.");
      } else {
        setStatus("🏁 Đã trao hết giải! Mở ☰ để chơi lại.");
      }
      el.btnStart.disabled = true;
    } else {
      setStatus("Sẵn sàng vòng " + state.round + " với " + active().length + " người.");
    }
  }

  function rematch() {
    closeWinner();
    resetToIdle();
    setTimeout(startRound, 250);
  }

  function resetToIdle() {
    state.phase = "idle";
    el.btnStart.disabled = active().length < 2;
    el.btnBackSetup.disabled = false;
    el.idleHint.style.display = "";
    if (active().length >= 2) {
      buildRace();          // show the starting grid (ducks at the line + finish) while waiting
    } else {
      race = null;
      clearLeaderboard();
    }
    if (AudioEngine) AudioEngine.setIntensity(0);
  }

  /* ---------------- Meta UI ---------------- */
  function renderMeta() {
    el.roundNum.textContent = state.round;
    el.remainCount.textContent = active().length;
    // winners strip
    el.winnersStrip.innerHTML = "";
    state.winners.forEach(function (w, i) {
      var chip = document.createElement("div");
      chip.className = "winner-chip";
      chip.innerHTML = '<span class="rank">#' + (i + 1) + '</span><span class="wname"></span>';
      chip.querySelector(".wname").textContent = w.name;
      el.winnersStrip.appendChild(chip);
    });
  }
  var statusTimer = null;
  function setStatus(t) { el.statusText.textContent = t; }
  function flashStatus(t) {
    setStatus(t);
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { if (state.phase === "idle") setStatus(""); }, 2600);
  }

  /* ---------------- Fullscreen ---------------- */
  function toggleFull() {
    var app = document.getElementById("app");
    if (!document.fullscreenElement) {
      (app.requestFullscreen || app.webkitRequestFullscreen).call(app);
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    }
  }

  /* ---------------- Events ---------------- */
  function bind() {
    el.btnStart.addEventListener("click", startRound);
    el.btnBackSetup.addEventListener("click", function () { if (state.phase === "idle") openSetup(); });
    el.btnRoster.addEventListener("click", function () { if (state.phase === "idle" || state.phase === "finished") openSetup(); });

    el.btnSound.addEventListener("click", function () {
      AudioEngine.unlock();
      var m = AudioEngine.toggleMuted();
      el.btnSound.textContent = m ? "🔇" : "🔊";
      el.btnSound.classList.toggle("muted", m);
      if (!m && (state.phase === "running" || state.phase === "countdown")) AudioEngine.startMusic();
      if (m) AudioEngine.stopMusic();
    });
    el.btnFull.addEventListener("click", toggleFull);

    // setup modal
    el.namesInput.addEventListener("input", updateNameCount);
    el.btnSample.addEventListener("click", function () {
      el.namesInput.value = SAMPLE.join("\n"); updateNameCount();
    });
    el.btnShuffle.addEventListener("click", function () {
      var arr = el.namesInput.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
      el.namesInput.value = arr.join("\n"); updateNameCount();
    });
    el.btnClear.addEventListener("click", function () { el.namesInput.value = ""; updateNameCount(); });
    el.durationRange.addEventListener("input", function () { el.durationVal.textContent = el.durationRange.value; });
    el.btnApply.addEventListener("click", function () {
      var n = el.namesInput.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean).length;
      if (n < 2) { el.namesInput.focus(); return; }
      setNamesFromText(el.namesInput.value);
      state.duration = parseInt(el.durationRange.value, 10) || 9;
      save();
      closeSetup();
      resetToIdle();
      renderMeta();
      setStatus("Sẵn sàng! " + n + " người trong danh sách.");
    });

    // winner modal
    el.btnEliminate.addEventListener("click", eliminateWinner);
    el.btnRematch.addEventListener("click", rematch);
    el.btnCloseWinner.addEventListener("click", function () { closeWinner(); resetToIdle(); });

    // keyboard: space = start, F = fullscreen
    window.addEventListener("keydown", function (e) {
      if (e.code === "Space" && state.phase === "idle" && !el.setupScrim.classList.contains("open")) {
        e.preventDefault(); startRound();
      } else if (e.key === "f" || e.key === "F") { toggleFull(); }
    });

    window.addEventListener("resize", function () {
      sizeCanvas();
      if (race) { race.geo = geometry(race.n); }
    });

    // Keep the canvas backing store in sync with its displayed size
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () {
        sizeCanvas();
        if (race) { race.geo = geometry(race.n); }
      });
      ro.observe(canvas);
    }
  }

  /* ---------------- Init ---------------- */
  function init() {
    Confetti.init();
    bind();
    sizeCanvas();

    var had = load();
    renderMeta();
    resetToIdle();

    if (had && state.roster.length >= 2) {
      setStatus("Đã tải danh sách " + state.roster.length + " người (vòng " + state.round + ").");
    } else {
      openSetup();
    }
    requestAnimationFrame(loop);
  }

  /* ---------------- Public / debug API ---------------- */
  window.DuckRace = {
    start: startRound,
    openSetup: openSetup,
    info: function () {
      return {
        phase: state.phase, u: race ? race.u : null, remain: active().length,
        round: state.round, winners: state.winners.map(function (w) { return w.name; }),
        winnerName: race ? race.ducks[race.winnerIdx].p.name : null,
        winnerOpen: el.winnerScrim.classList.contains("open")
      };
    },
    // testing helpers (used to verify logic when rAF is paused / headless)
    _step: function (u) {
      if (!race) return;
      race.u = clamp(u, 0, 1);
      for (var i = 0; i < race.ducks.length; i++) race.ducks[i].prog = progressAt(race.ducks[i], race.u);
      updateLeaderboard(true); render();
    },
    _finish: finishRace
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
