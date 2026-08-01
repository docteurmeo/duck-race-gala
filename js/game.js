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
    btnUpload: $("btnUpload"), fileInput: $("fileInput"), uploadStatus: $("uploadStatus"),
    modeSelect: $("modeSelect"), brandTitle: $("brandTitle"),
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
    roster: [],       // {id, name, color, acc, pat, num, out:false}
    winners: [],      // {name, color}
    round: 1,
    duration: 9,
    mode: "duck",     // duck | horse
    phase: "idle"     // idle | countdown | running | finishing | finished
  };
  // saddle-cloth accent colours for horse mode (indexed by acc)
  var BLANKET = ["#ff5d73", "#ffd34e", "#22c55e", "#3d7bff", "#a855f7", "#ff9f1c", "#ec4899", "#14b8a6"];
  function sttOf(name, fallback) {
    var m = String(name).match(/^\s*(\d{1,4})\b/);
    return m ? m[1] : String(fallback);
  }

  var race = null;    // active round data
  var dpr = 1, W = 0, H = 0;
  var lbRows = {};    // id -> DOM row (pool for leaderboard)
  var lastLbUpdate = 0;
  var lastFrame = 0;

  /* ---------------- Utils ---------------- */
  var TAU = Math.PI * 2, ACC_COUNT = 8, PAT_COUNT = 3;
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
        round: state.round, duration: state.duration, mode: state.mode
      }));
    } catch (e) {}
  }
  function load() {
    try {
      var d = JSON.parse(localStorage.getItem(STORE_KEY));
      if (d && d.roster) {
        state.roster = d.roster; state.winners = d.winners || [];
        state.round = d.round || 1; state.duration = d.duration || 9;
        state.mode = d.mode || "duck";
        // backfill pattern/accessory/number for lists saved before these features
        state.roster.forEach(function (p, i) {
          if (p.acc == null) p.acc = i % ACC_COUNT;
          if (p.pat == null) p.pat = Math.floor(i / ACC_COUNT) % PAT_COUNT;
          if (p.num == null) p.num = sttOf(p.name, i + 1);
        });
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
      return {
        id: uid(), name: nm, color: colorFor(i, n),
        acc: i % ACC_COUNT, pat: Math.floor(i / ACC_COUNT) % PAT_COUNT,
        num: sttOf(nm, i + 1),
        out: false
      };
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
    reflectMode();
    el.setupScrim.classList.add("open");
  }
  function closeSetup() { el.setupScrim.classList.remove("open"); }

  /* ---------------- Race mode (duck / horse) ---------------- */
  function reflectMode() {
    var opts = el.modeSelect.querySelectorAll(".mode-opt");
    Array.prototype.forEach.call(opts, function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-mode") === state.mode);
    });
    el.brandTitle.textContent = state.mode === "horse" ? "Đua Ngựa" : "Đua Vịt";
  }
  function setMode(m) {
    if (m !== "duck" && m !== "horse" || m === state.mode) return;
    state.mode = m;
    save();
    reflectMode();          // render loop picks up the new sprite next frame
  }
  function updateNameCount() {
    var n = el.namesInput.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean).length;
    el.nameCount.textContent = n;
  }

  /* ---------------- File upload (Excel / CSV / TXT) ---------------- */
  function showUploadStatus(msg, isErr) {
    el.uploadStatus.hidden = false;
    el.uploadStatus.textContent = msg;
    el.uploadStatus.classList.toggle("err", !!isErr);
  }
  // detect header/title rows whose "name" cell is actually a label, not a person
  function isHeaderText(name) {
    if (/^(stt|số thứ tự|no\.?|họ và tên|họ tên|tên|name|full ?name|giới tính|ngày sinh|phòng|ban|phòng\/ban)$/i.test(name)) return true;
    if (/danh s[áa]ch/i.test(name)) return true;   // title rows e.g. "DANH SÁCH CHIA PHÒNG…"
    return false;
  }
  function rowsToNames(rows) {
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var cells = (rows[i] || []).map(function (c) { return c == null ? "" : String(c).trim(); });
      if (!cells.some(function (c) { return c; })) continue;
      var stt = null, name = null;
      for (var j = 0; j < cells.length; j++) {
        var c = cells[j];
        if (!c) continue;
        if (stt === null && /^\d{1,4}(\.0+)?$/.test(c)) { stt = String(parseInt(c, 10)); continue; }
        if (name === null && /[A-Za-zÀ-ỹ]/.test(c)) name = c;   // first cell containing a letter
      }
      if (!name || isHeaderText(name)) continue;                // skip header/title rows
      out.push(stt !== null ? (stt + " - " + name) : name);
    }
    return out;
  }
  function loadNamesIntoInput(names, sourceLabel) {
    el.namesInput.value = names.join("\n");
    updateNameCount();
    showUploadStatus("✓ Đã nạp " + names.length + " người" + (sourceLabel ? " từ " + sourceLabel : ""), false);
  }
  function handleFile(file) {
    if (!file) return;
    var ext = (file.name.split(".").pop() || "").toLowerCase();
    showUploadStatus("Đang đọc " + file.name + "…", false);
    var reader = new FileReader();
    reader.onerror = function () { showUploadStatus("Không đọc được file.", true); };

    if (ext === "csv" || ext === "txt") {
      reader.onload = function (e) {
        var lines = String(e.target.result).split(/\r?\n/);
        var rows = lines.map(function (l) { return l.split(/[,;\t]/); });
        var names = rowsToNames(rows);
        if (!names.length) { showUploadStatus("Không tìm thấy tên nào trong file.", true); return; }
        loadNamesIntoInput(names, file.name);
      };
      reader.readAsText(file);
      return;
    }

    // Excel (.xlsx/.xls) via SheetJS — pick the sheet yielding the most names
    if (typeof XLSX === "undefined") { showUploadStatus("Chưa tải được thư viện đọc Excel — thử lại hoặc dùng CSV.", true); return; }
    reader.onload = function (e) {
      try {
        var wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
        var best = { names: [], sheet: "" };
        wb.SheetNames.forEach(function (sn) {
          var rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, blankrows: false, raw: true });
          var names = rowsToNames(rows);
          if (names.length > best.names.length) best = { names: names, sheet: sn };
        });
        if (!best.names.length) { showUploadStatus("Không tìm thấy tên nào trong file Excel.", true); return; }
        loadNamesIntoInput(best.names, "sheet “" + best.sheet + "” (" + file.name + ")");
      } catch (err) {
        showUploadStatus("Lỗi đọc Excel: " + err.message, true);
      }
    };
    reader.readAsArrayBuffer(file);
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

  // Cute cartoon rubber-duck, tinted by color, with per-duck pattern + accessory.
  function drawDuck(x, y, size, p, bob, leader) {
    var s = size;
    var col = p.color, dark = shade(col, -20), lite = shade(col, 16);
    var b = Math.sin(bob) * s * 0.08;
    y += b;
    ctx.save();
    ctx.translate(x, y);

    // soft shadow on water
    ctx.globalAlpha = 0.18; ctx.fillStyle = "#02061c";
    ctx.beginPath(); ctx.ellipse(0, s * 0.86, s * 0.8, s * 0.2, 0, 0, TAU); ctx.fill();
    // wake
    ctx.globalAlpha = 0.22; ctx.fillStyle = "#cfe0ff";
    ctx.beginPath(); ctx.ellipse(-s * 0.7, s * 0.6, s * 1.05, s * 0.24, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;

    if (leader) {
      ctx.save();
      ctx.shadowColor = "rgba(255,197,61,0.95)"; ctx.shadowBlur = s * 1.1;
      ctx.strokeStyle = "rgba(255,214,102,0.95)"; ctx.lineWidth = s * 0.13;
      ctx.beginPath(); ctx.arc(0, s * 0.05, s * 1.04, 0, TAU); ctx.stroke();
      ctx.restore();
    }

    // body
    ctx.fillStyle = col; ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.beginPath(); ctx.ellipse(0, s * 0.18, s * 0.82, s * 0.64, 0, 0, TAU); ctx.fill();
    // tail flick
    ctx.beginPath();
    ctx.moveTo(-s * 0.72, s * 0.02);
    ctx.quadraticCurveTo(-s * 1.16, -s * 0.26, -s * 0.58, s * 0.18);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, s * 0.18, s * 0.82, s * 0.64, 0, 0, TAU); ctx.stroke();

    // pattern (clipped to body)
    if (s >= 12 && p.pat) {
      ctx.save();
      ctx.beginPath(); ctx.ellipse(0, s * 0.18, s * 0.82, s * 0.64, 0, 0, TAU); ctx.clip();
      drawPattern(p.pat, dark, s);
      ctx.restore();
    }
    // belly highlight
    ctx.globalAlpha = 0.4; ctx.fillStyle = lite;
    ctx.beginPath(); ctx.ellipse(s * 0.1, s * 0.42, s * 0.48, s * 0.32, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    // wing
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.ellipse(-s * 0.02, s * 0.22, s * 0.36, s * 0.26, -0.15, 0, TAU); ctx.fill();

    // head
    var hx = s * 0.46, hy = -s * 0.52, hr = s * 0.52;
    ctx.fillStyle = col; ctx.strokeStyle = dark;
    ctx.beginPath(); ctx.arc(hx, hy, hr, 0, TAU); ctx.fill(); ctx.stroke();
    // cheek blush
    ctx.fillStyle = "rgba(255,128,128,0.42)";
    ctx.beginPath(); ctx.arc(hx - s * 0.06, hy + s * 0.2, s * 0.13, 0, TAU); ctx.fill();
    // eye (big, glossy)
    ctx.fillStyle = "#14213f";
    ctx.beginPath(); ctx.arc(hx + s * 0.16, hy - s * 0.04, s * 0.15, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(hx + s * 0.21, hy - s * 0.1, s * 0.055, 0, TAU); ctx.fill();
    // beak
    ctx.fillStyle = "#ffb02e"; ctx.strokeStyle = "#e8850c"; ctx.lineWidth = s * 0.03;
    ctx.beginPath();
    ctx.moveTo(hx + s * 0.3, hy - s * 0.06);
    ctx.quadraticCurveTo(hx + s * 0.96, hy - s * 0.02, hx + s * 0.86, hy + s * 0.16);
    ctx.quadraticCurveTo(hx + s * 0.5, hy + s * 0.26, hx + s * 0.32, hy + s * 0.14);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    if (s >= 12) drawAccessory(p.acc, hx, hy, hr, s);
    ctx.restore();
  }

  function drawPattern(pat, dk, s) {
    ctx.fillStyle = dk; ctx.strokeStyle = dk;
    if (pat === 1) {                       // polka dots
      var pts = [[-0.38, -0.05], [0.1, 0.28], [-0.08, -0.15], [0.4, 0.02], [-0.46, 0.4], [0.24, 0.58]];
      for (var i = 0; i < pts.length; i++) {
        ctx.beginPath(); ctx.arc(pts[i][0] * s, (pts[i][1] + 0.18) * s, s * 0.1, 0, TAU); ctx.fill();
      }
    } else if (pat === 2) {                // diagonal stripes
      ctx.lineWidth = s * 0.13;
      for (var j = -3; j <= 4; j++) {
        ctx.beginPath();
        ctx.moveTo(j * s * 0.34 - s * 0.4, -s);
        ctx.lineTo(j * s * 0.34 + s * 0.5, s * 1.2);
        ctx.stroke();
      }
    }
  }

  function drawAccessory(acc, hx, hy, hr, s) {
    if (!acc) return;                      // 0 = bare head
    var topY = hy - hr;
    ctx.save();
    ctx.lineJoin = "round";
    if (acc === 1) {                       // party hat
      ctx.fillStyle = "#ff4d8d";
      ctx.beginPath();
      ctx.moveTo(hx - s * 0.32, topY + s * 0.12);
      ctx.lineTo(hx + s * 0.32, topY + s * 0.12);
      ctx.lineTo(hx + s * 0.02, topY - s * 0.66);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ffd34e";
      ctx.beginPath(); ctx.arc(hx + s * 0.02, topY - s * 0.66, s * 0.1, 0, TAU); ctx.fill();
    } else if (acc === 2) {                // top hat
      ctx.fillStyle = "#171c36";
      ctx.fillRect(hx - s * 0.42, topY, s * 0.84, s * 0.12);
      ctx.fillRect(hx - s * 0.26, topY - s * 0.58, s * 0.52, s * 0.6);
      ctx.fillStyle = "#ff4d5e";
      ctx.fillRect(hx - s * 0.26, topY - s * 0.14, s * 0.52, s * 0.1);
    } else if (acc === 3) {                // crown
      ctx.fillStyle = "#ffca3a"; ctx.strokeStyle = "#e0a000"; ctx.lineWidth = s * 0.03;
      ctx.beginPath();
      ctx.moveTo(hx - s * 0.34, topY + s * 0.14);
      ctx.lineTo(hx - s * 0.34, topY - s * 0.24);
      ctx.lineTo(hx - s * 0.15, topY - s * 0.02);
      ctx.lineTo(hx, topY - s * 0.34);
      ctx.lineTo(hx + s * 0.15, topY - s * 0.02);
      ctx.lineTo(hx + s * 0.34, topY - s * 0.24);
      ctx.lineTo(hx + s * 0.34, topY + s * 0.14);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (acc === 4) {                // bow
      var bx = hx - s * 0.16, by = topY + s * 0.08;
      ctx.fillStyle = "#ff5d73";
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - s * 0.26, by - s * 0.17); ctx.lineTo(bx - s * 0.26, by + s * 0.17); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + s * 0.26, by - s * 0.17); ctx.lineTo(bx + s * 0.26, by + s * 0.17); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ffd34e"; ctx.beginPath(); ctx.arc(bx, by, s * 0.08, 0, TAU); ctx.fill();
    } else if (acc === 5) {                // sunglasses (side profile)
      ctx.fillStyle = "#12203f";
      ctx.beginPath(); ctx.ellipse(hx + s * 0.16, hy - s * 0.03, s * 0.21, s * 0.17, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = "#12203f"; ctx.lineWidth = s * 0.05;
      ctx.beginPath(); ctx.moveTo(hx - s * 0.05, hy - s * 0.06); ctx.lineTo(hx - s * 0.32, hy - s * 0.12); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = s * 0.035;
      ctx.beginPath(); ctx.arc(hx + s * 0.16, hy - s * 0.03, s * 0.11, -2.4, -1.5); ctx.stroke();
    } else if (acc === 6) {                // cap
      ctx.fillStyle = "#22c55e";
      ctx.beginPath(); ctx.arc(hx, topY + s * 0.14, s * 0.4, Math.PI, TAU); ctx.fill();
      ctx.fillRect(hx, topY + s * 0.06, s * 0.5, s * 0.1);
    } else if (acc === 7) {                // flower
      var fx = hx - s * 0.26, fy = topY + s * 0.18;
      ctx.fillStyle = "#ff7ab5";
      for (var k = 0; k < 5; k++) {
        var a = k / 5 * TAU;
        ctx.beginPath(); ctx.arc(fx + Math.cos(a) * s * 0.13, fy + Math.sin(a) * s * 0.13, s * 0.09, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = "#ffd34e"; ctx.beginPath(); ctx.arc(fx, fy, s * 0.08, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function capsule(x1, y1, x2, y2, w, col) {
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  // A leg that swings around its hip pivot with the gallop phase (animated stride).
  function drawLeg(px, py, len, phase, col, w) {
    var a = 0.5 * Math.sin(phase);
    var hx = px + Math.sin(a) * len;
    var hy = py + Math.cos(a) * len;
    capsule(px, py, hx, hy, w, col);
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(a);
    ctx.fillStyle = "#241a2e";
    ctx.beginPath(); ctx.ellipse(0, w * 0.12, w * 0.62, w * 0.42, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function drawHorsePattern(pat, coat, s) {
    if (pat === 1) {                          // dapples
      ctx.fillStyle = shade(coat, 16); ctx.globalAlpha = 0.5;
      var pts = [[-0.4, 0.16], [-0.12, 0.38], [-0.44, 0.5], [-0.22, 0.1], [0.06, 0.46], [0.14, 0.22]];
      for (var i = 0; i < pts.length; i++) { ctx.beginPath(); ctx.arc(pts[i][0] * s, pts[i][1] * s, s * 0.1, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    } else if (pat === 2) {                    // pinto patch (cream)
      ctx.fillStyle = "#f6ead0";
      ctx.beginPath(); ctx.ellipse(-0.3 * s, 0.42 * s, 0.4 * s, 0.32 * s, 0.15, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0.06 * s, 0.2 * s, 0.17 * s, 0.14 * s, 0, 0, TAU); ctx.fill();
    }
  }

  // Cute chibi race horse, tinted by coat colour, with numbered saddle cloth (STT).
  function drawHorse(x, y, size, p, bob, leader) {
    var s = size, coat = p.color, mane = shade(coat, -32), dark = shade(coat, -16);
    var blanket = BLANKET[(p.acc || 0) % BLANKET.length];
    var num = p.num != null ? p.num : "";
    var b = Math.sin(bob) * s * 0.07;
    var S = function (v) { return v * s; };
    ctx.save();
    ctx.translate(x, y + b);

    // shadow
    ctx.globalAlpha = 0.16; ctx.fillStyle = "#02061c";
    ctx.beginPath(); ctx.ellipse(0, S(1.04), S(0.78), S(0.16), 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;

    if (leader) {
      ctx.save();
      ctx.shadowColor = "rgba(255,197,61,0.95)"; ctx.shadowBlur = s * 1.1;
      ctx.strokeStyle = "rgba(255,214,102,0.95)"; ctx.lineWidth = s * 0.12;
      ctx.beginPath(); ctx.ellipse(0, S(0.2), S(1.16), S(0.96), 0, 0, TAU); ctx.stroke();
      ctx.restore();
    }

    // tail
    ctx.fillStyle = mane;
    ctx.beginPath();
    ctx.moveTo(S(-0.62), S(-0.02));
    ctx.quadraticCurveTo(S(-1.15), S(0.05), S(-1.0), S(0.55));
    ctx.quadraticCurveTo(S(-0.92), S(0.9), S(-0.66), S(0.82));
    ctx.quadraticCurveTo(S(-0.82), S(0.55), S(-0.7), S(0.3));
    ctx.quadraticCurveTo(S(-0.6), S(0.12), S(-0.5), S(0.12));
    ctx.closePath(); ctx.fill();
    // far legs (animated gallop — diagonal pairs)
    drawLeg(S(-0.3), S(0.62), S(0.46), bob, dark, S(0.2));
    drawLeg(S(0.32), S(0.62), S(0.46), bob + Math.PI, dark, S(0.2));
    // body
    ctx.fillStyle = coat; ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1, S(0.05));
    ctx.beginPath(); ctx.ellipse(S(-0.05), S(0.32), S(0.7), S(0.56), 0, 0, TAU); ctx.fill();
    // coat pattern (clipped to body)
    if (s >= 12 && p.pat) {
      ctx.save();
      ctx.beginPath(); ctx.ellipse(S(-0.05), S(0.32), S(0.7), S(0.56), 0, 0, TAU); ctx.clip();
      drawHorsePattern(p.pat, coat, s);
      ctx.restore();
    }
    // near legs (animated gallop)
    drawLeg(S(0.5), S(0.6), S(0.48), bob, coat, S(0.22));
    drawLeg(S(-0.42), S(0.6), S(0.48), bob + Math.PI, coat, S(0.22));
    // saddle blanket + number
    ctx.fillStyle = blanket; ctx.strokeStyle = "rgba(0,0,0,0.2)"; ctx.lineWidth = Math.max(1, S(0.03));
    ctx.beginPath(); ctx.moveTo(S(-0.5), S(0.02)); ctx.lineTo(S(0.12), S(0.05)); ctx.lineTo(S(0.06), S(0.5)); ctx.lineTo(S(-0.52), S(0.46)); ctx.closePath(); ctx.fill();
    if (s >= 11) {
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(S(-0.24), S(0.26), S(0.19), 0, TAU); ctx.fill();
      ctx.fillStyle = "#14213f"; ctx.font = "800 " + S(0.28) + "px " + fontFamily();
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(num), S(-0.24), S(0.28));
    }
    // mane band behind head
    ctx.fillStyle = mane;
    ctx.beginPath();
    ctx.moveTo(S(0.28), S(-0.78));
    ctx.quadraticCurveTo(S(-0.02), S(-0.5), S(0.02), S(0.05));
    ctx.quadraticCurveTo(S(0.2), S(-0.15), S(0.24), S(-0.4));
    ctx.quadraticCurveTo(S(0.34), S(-0.62), S(0.5), S(-0.72));
    ctx.closePath(); ctx.fill();
    // head: cheek + muzzle
    ctx.fillStyle = coat; ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1, S(0.045));
    ctx.beginPath(); ctx.arc(S(0.62), S(-0.4), S(0.5), 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(S(1.08), S(-0.2), S(0.4), S(0.3), 0.15, 0, TAU); ctx.fill();
    ctx.fillStyle = shade(coat, 12); ctx.beginPath(); ctx.ellipse(S(1.2), S(-0.14), S(0.24), S(0.19), 0.15, 0, TAU); ctx.fill();
    ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(S(1.28), S(-0.2), S(0.035), S(0.05), 0.2, 0, TAU); ctx.fill();
    // ears
    ctx.fillStyle = coat; ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1, S(0.035));
    ctx.beginPath(); ctx.moveTo(S(0.3), S(-0.78)); ctx.quadraticCurveTo(S(0.2), S(-1.02), S(0.42), S(-0.86)); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(S(0.62), S(-0.84)); ctx.quadraticCurveTo(S(0.66), S(-1.08), S(0.8), S(-0.82)); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(coat, -14); ctx.beginPath(); ctx.moveTo(S(0.64), S(-0.86)); ctx.quadraticCurveTo(S(0.68), S(-1.0), S(0.76), S(-0.85)); ctx.closePath(); ctx.fill();
    // forelock
    ctx.fillStyle = mane; ctx.beginPath(); ctx.moveTo(S(0.4), S(-0.82)); ctx.quadraticCurveTo(S(0.6), S(-0.78), S(0.56), S(-0.5)); ctx.quadraticCurveTo(S(0.48), S(-0.66), S(0.36), S(-0.64)); ctx.closePath(); ctx.fill();
    // eye
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(S(0.78), S(-0.34), S(0.2), 0, TAU); ctx.fill();
    ctx.fillStyle = "#14213f"; ctx.beginPath(); ctx.arc(S(0.82), S(-0.32), S(0.14), 0, TAU); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(S(0.87), S(-0.37), S(0.05), 0, TAU); ctx.fill();
    // blush
    ctx.fillStyle = "rgba(255,120,120,0.4)"; ctx.beginPath(); ctx.arc(S(0.92), S(-0.16), S(0.12), 0, TAU); ctx.fill();

    // accessory on the head (shared with duck mode)
    if (s >= 12) drawAccessory(p.acc, S(0.62), S(-0.4), S(0.5), s);

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
      // Ducks are sized to slightly overlap when lanes are tight, so a big
      // field still reads as chunky cartoon ducks instead of tiny dots.
      var size = clamp(geo.laneH * 0.62, 13, 46);
      var racing = state.phase === "running" || state.phase === "finishing" || state.phase === "finished";
      var isLeader = racing && d.p.id === leaderId;
      if (state.mode === "horse") drawHorse(x, y, size, d.p, d.bob, isLeader);
      else drawDuck(x, y, size, d.p, d.bob, isLeader);
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
    Array.prototype.forEach.call(el.modeSelect.querySelectorAll(".mode-opt"), function (btn) {
      btn.addEventListener("click", function () { setMode(btn.getAttribute("data-mode")); });
    });
    el.namesInput.addEventListener("input", updateNameCount);
    el.btnUpload.addEventListener("click", function () { el.fileInput.click(); });
    el.fileInput.addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0];
      handleFile(f);
      el.fileInput.value = "";   // allow re-selecting the same file
    });
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
    reflectMode();
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
    _finish: finishRace,
    _handleFile: handleFile
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
