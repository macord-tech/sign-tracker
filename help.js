// Help: in-app user manuals (volunteer + coordinator), and a hidden ski game.
// Easter egg: tap the Winter Extreme logo 5 times quickly.
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);

  // ---------- styles ----------
  const css = `
  .help-modal { position: fixed; inset: 0; z-index: 70; background: rgba(0,0,0,.5); display: flex; justify-content: center; align-items: stretch; }
  .help-card { background: var(--bg); color: var(--ink); width: 100%; max-width: 560px; display: flex; flex-direction: column; border-left: 3px solid var(--brand); border-right: 3px solid var(--brand); }
  .help-head { display: flex; align-items: center; gap: 8px; padding: calc(10px + env(safe-area-inset-top)) 12px 10px; background: var(--card); border-bottom: 1px solid var(--line); }
  .help-head h2 { margin: 0; font-size: 18px; flex: 1; color: var(--brand); }
  .help-tabs { display: flex; gap: 6px; padding: 10px 12px 0; }
  .help-tabs button { flex: 1; padding: 9px 6px; border-radius: 10px; border: 1px solid var(--line); background: var(--card); color: var(--ink); font-weight: 700; font-size: 14px; cursor: pointer; }
  .help-tabs button.on { background: var(--brand); border-color: var(--brand); color: #fff; }
  .help-body { overflow-y: auto; padding: 6px 16px calc(30px + env(safe-area-inset-bottom)); line-height: 1.45; font-size: 15px; }
  .help-body h3 { color: var(--brand); font-size: 14px; text-transform: uppercase; letter-spacing: .04em; margin: 18px 0 6px; }
  .help-body ol, .help-body ul { margin: 0; padding-left: 22px; }
  .help-body li { margin: 4px 0; }
  .help-body .tip { background: color-mix(in srgb, var(--brand) 10%, var(--card)); border-left: 4px solid var(--brand); padding: 8px 10px; border-radius: 6px; margin: 12px 0; font-size: 14px; }
  .help-dot { display: inline-block; width: 11px; height: 11px; border-radius: 50%; vertical-align: -1px; margin-right: 4px; border: 1px solid rgba(0,0,0,.2); }
  .help-btn { font-weight: 900; font-size: 19px; }
  @media (max-width: 430px) {
    .topbar .event-name { display: none; }
    .top-actions { gap: 4px; }
    .top-actions .icon-btn { width: 34px; }
    #meBtn { max-width: 84px; }
  }
  .brand-logo { cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .game-modal { position: fixed; inset: 0; z-index: 80; background: #eef4fa; touch-action: none; user-select: none; -webkit-user-select: none; }
  .game-modal canvas { display: block; width: 100%; height: 100%; }
  .game-ui { position: absolute; left: 0; right: 0; top: calc(8px + env(safe-area-inset-top)); display: flex; justify-content: space-between; align-items: center; padding: 0 12px; pointer-events: none; font: 800 16px system-ui, sans-serif; color: #1f2933; }
  .game-ui button { pointer-events: auto; }
  .game-over { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
  .game-over .box { pointer-events: auto; background: #fff; color: #1f2933; border-radius: 16px; padding: 20px 22px; text-align: center; box-shadow: 0 8px 30px rgba(0,0,0,.25); border-top: 5px solid #d32f2f; max-width: 300px; }
  .game-over h3 { margin: 0 0 6px; color: #d32f2f; font-size: 22px; }
  .game-over p { margin: 4px 0 14px; }
  .game-over .row { display: flex; gap: 8px; justify-content: center; }
  `;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  // ---------- manuals ----------
  const dot = (c) => `<span class="help-dot" style="background:${c}"></span>`;
  const VOL = `
    <h3>1. Sign in</h3>
    <ol><li>Enter your code: the <b>last 4 digits of your phone number + CSP</b> (example: <b>0142CSP</b>).</li>
    <li>Read the <b>Safety</b> tab before you head out.</li></ol>

    <h3>2. Read the map</h3>
    <ul><li>${dot("var(--retrieved)")}<b>Grey</b>: potential location, nobody on it yet</li>
    <li>${dot("var(--pending)")}<b>Orange</b>: to drop off</li>
    <li>${dot("var(--placed)")}<b>Green</b>: sign dropped off</li>
    <li>${dot("#e03131")}<b>Small red dot</b>: dropped off, needs someone to pick it up</li></ul>

    <h3>3. Drop off your signs</h3>
    <ol><li>The <b>Next</b> panel shows your next address. Tap <b>Navigate</b> to open it in your maps app.</li>
    <li>Place the sign, then tap <b>✓ Sign dropped off</b>. The pin turns green.</li>
    <li>Repeat until you're done. You'll get confetti at the end!</li></ol>

    <h3>4. Pick up your signs</h3>
    <ol><li>On pickup day, go to each sign you're tasked with.</li>
    <li>Tap <b>✓ Sign picked up</b>. The pin turns grey.</li></ol>

    <h3>5. Take on more</h3>
    <ul><li>Grey pin: tap <b>🙋 I'll sign that</b> to drop a sign off there.</li>
    <li>Red-dot pin: tap <b>🙋 I'll pick this up</b>.</li>
    <li>Found a good spot? Tap <b>+ New sign</b>, drop the pin, add the address, a description and any hazards.</li></ul>

    <h3>6. Good to know</h3>
    <ul><li>Tapped by mistake? Use <b>Undo</b> on the sign's card.</li>
    <li>No signal? Keep going. Your taps save and sync when you're back online.</li>
    <li>The <b>Emergency</b> tab has your contacts.</li>
    <li>The sun/moon button switches light and dark view.</li></ul>
    <div class="tip">Safety first: park legally, wear your vest, and never place a sign where it blocks a driver's view.</div>`;

  const ADM = `
    <h3>1. Sign in</h3>
    <ol><li>Enter the master code <b>CSPadmin</b> and your name.</li>
    <li>You'll see a <b>Manage</b> button at the top.</li></ol>

    <h3>2. Add volunteers</h3>
    <ol><li><b>Manage → Volunteers &amp; access codes</b>.</li>
    <li>Enter their name and phone number. Their code is the last 4 digits + CSP.</li>
    <li>Give them their code. That's all they need to sign in.</li></ol>

    <h3>3. Add sign locations</h3>
    <ul><li><b>+ New sign</b>: drop a pin, add the address, description and hazards.</li>
    <li><b>Manage → Add many at once</b>: paste one address per line, then <b>Add all</b>.</li>
    <li>New locations start <b>grey</b> (potential).</li></ul>

    <h3>4. Assign drop-offs</h3>
    <ol><li>Tap <b>Assign</b> on the map and choose <b>Drop-off</b>.</li>
    <li>Tap pins to select them (or use <b>Last Call Stragglers</b>, the list of unassigned signs).</li>
    <li>Tap <b>Assign to…</b> and pick a volunteer. Pins turn orange.</li></ol>

    <h3>5. Assign pickups</h3>
    <ol><li>Wait until signs are tagged dropped off (green, small red dot).</li>
    <li><b>Assign → Pickup</b>, select the pins, <b>Assign to…</b>.</li>
    <li>You can't assign a pickup before the drop-off happens. Volunteers can also claim red-dot pins themselves.</li></ol>

    <h3>6. Fix things</h3>
    <ul><li>Drop-off never happened? Select it, <b>Assign to… → Unassign</b>. It goes back to grey.</li>
    <li>You can tag any sign dropped off or picked up yourself.</li>
    <li>Wrong spot? Open the sign, <b>Edit</b>, and move the pin.</li>
    <li>Only coordinators can delete a sign.</li></ul>

    <h3>7. Safety and contacts</h3>
    <ul><li><b>Safety</b> tab → <b>Edit safety notes</b>. Volunteers see a red dot when notes change.</li>
    <li><b>Emergency</b> tab → <b>Edit contacts</b>.</li></ul>

    <h3>8. Track and wrap up</h3>
    <ul><li>The <b>List</b> tab filters by status. <b>Manage</b> shows each volunteer's progress.</li>
    <li><b>Download CSV</b> exports who did what and when.</li>
    <li>Locations stay after pickup. Next year use <b>↺ Use location again</b>, or <b>Reset all to "To drop off"</b>.</li></ul>
    <div class="tip">Volunteers lose their code? It's always the last 4 digits of their phone + CSP.</div>`;

  // ---------- help button + modal ----------
  const isAdmin = () => { const b = $("#adminBtn"); return !!b && !b.classList.contains("hidden"); };
  const modal = document.createElement("div");
  modal.className = "help-modal hidden"; modal.setAttribute("role", "dialog"); modal.setAttribute("aria-label", "User guide");
  modal.innerHTML = `<div class="help-card">
    <div class="help-head"><h2>User guide</h2><button class="btn small light" type="button" data-x>Close</button></div>
    <div class="help-tabs"><button type="button" data-t="vol">Volunteer guide</button><button type="button" data-t="adm">Coordinator guide</button></div>
    <div class="help-body"></div></div>`;
  document.body.appendChild(modal);
  const body = modal.querySelector(".help-body");
  function show(t) {
    body.innerHTML = t === "adm" ? ADM : VOL; body.scrollTop = 0;
    modal.querySelectorAll("[data-t]").forEach((b) => b.classList.toggle("on", b.dataset.t === t));
  }
  function openHelp() {
    const adm = isAdmin();
    modal.querySelector(".help-tabs").style.display = adm ? "flex" : "none";
    show(adm ? "adm" : "vol");
    modal.classList.remove("hidden");
  }
  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.closest("[data-x]")) modal.classList.add("hidden");
    const t = e.target.closest("[data-t]"); if (t) show(t.dataset.t);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") modal.classList.add("hidden"); });

  const acts = $(".topbar .top-actions");
  if (acts) {
    const b = document.createElement("button");
    b.id = "helpBtn"; b.type = "button"; b.className = "btn on-top icon-btn help-btn"; b.textContent = "?";
    b.title = "User guide"; b.setAttribute("aria-label", "Open the user guide");
    b.onclick = openHelp;
    acts.insertBefore(b, acts.firstChild);
  }

  // ---------- Easter egg: tap the logo 5 times ----------
  let taps = [];
  const logo = $(".topbar .brand-logo");
  if (logo) logo.addEventListener("click", () => {
    const now = Date.now(); taps = taps.filter((t) => now - t < 2500); taps.push(now);
    if (taps.length >= 5) { taps = []; startGame(); }
  });

  // ---------- Patrol Run: an original downhill dodging game ----------
  function startGame() {
    const wrap = document.createElement("div"); wrap.className = "game-modal";
    wrap.innerHTML = `<canvas></canvas>
      <div class="game-ui"><span id="gScore">0 m</span><span>Patrol Run</span><button class="btn small light" type="button" data-q>✕</button></div>
      <div class="game-over hidden"><div class="box"><h3>Wipeout!</h3><p id="gMsg"></p><div class="row"><button class="btn primary" type="button" data-again>Ski again</button><button class="btn light" type="button" data-q>Close</button></div></div></div>`;
    document.body.appendChild(wrap);
    const cv = wrap.querySelector("canvas"), ctx = cv.getContext("2d");
    const over = wrap.querySelector(".game-over"), scoreEl = wrap.querySelector("#gScore"), msg = wrap.querySelector("#gMsg");
    let W = 0, H = 0, dpr = 1;
    function size() { dpr = Math.min(2, window.devicePixelRatio || 1); W = wrap.clientWidth; H = wrap.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    size(); window.addEventListener("resize", size);

    let best = 0; try { best = +localStorage.getItem("st.patrolBest") || 0; } catch (e) {}
    let g, raf = 0, last = 0, keys = { l: false, r: false }, touchX = null;

    function reset() {
      g = { x: W / 2, y: H * 0.28, vx: 0, speed: 160, dist: 0, bonus: 0, things: [], spawn: 0, dead: false, t: 0, flash: 0 };
      over.classList.add("hidden");
    }
    function spawn() {
      const r = Math.random(), x = 20 + Math.random() * (W - 40);
      if (r < 0.62) g.things.push({ k: "tree", x, y: H + 40, s: 0.8 + Math.random() * 0.6 });
      else if (r < 0.80) g.things.push({ k: "rock", x, y: H + 30 });
      else if (r < 0.92) { const gw = 90; const gx = Math.max(30, Math.min(W - 30 - gw, x)); g.things.push({ k: "gate", x: gx, w: gw, y: H + 30, hit: false }); }
      else g.things.push({ k: "kit", x, y: H + 30 });
    }
    function step(dt) {
      g.t += dt;
      g.speed = Math.min(520, 160 + g.t * 9);
      const dir = (keys.r ? 1 : 0) - (keys.l ? 1 : 0);
      if (touchX != null) g.vx = (touchX - g.x) * 6; else g.vx += (dir * 900 - g.vx * 3) * dt;
      g.x = Math.max(12, Math.min(W - 12, g.x + g.vx * dt));
      const dy = g.speed * dt; g.dist += dy / 20;
      g.spawn -= dy; if (g.spawn <= 0) { spawn(); g.spawn = 70 + Math.random() * Math.max(40, 160 - g.t * 3); }
      for (const o of g.things) o.y -= dy;
      g.things = g.things.filter((o) => o.y > -60);
      for (const o of g.things) {
        if (o.k === "gate") {
          if (!o.hit && o.y < g.y && o.y + dy >= g.y) { o.hit = true; if (g.x > o.x + 6 && g.x < o.x + o.w - 6) { g.bonus += 50; g.flash = 0.5; } }
          if ((Math.abs(g.x - o.x) < 8 || Math.abs(g.x - (o.x + o.w)) < 8) && Math.abs(o.y - g.y) < 10) die("You clipped a gate pole.");
        } else if (o.k === "kit") {
          if (!o.got && Math.abs(o.x - g.x) < 18 && Math.abs(o.y - g.y) < 18) { o.got = true; g.bonus += 100; g.flash = 0.6; }
        } else {
          const rad = o.k === "tree" ? 11 * o.s : 12;
          const oy = o.k === "tree" ? o.y + 6 * o.s : o.y;
          if (Math.hypot(o.x - g.x, oy - g.y) < rad + 7) die(o.k === "tree" ? "Tree wins this round." : "Hit a rock.");
        }
      }
      if (g.flash > 0) g.flash -= dt;
    }
    function score() { return Math.floor(g.dist) + g.bonus; }
    function die(why) {
      if (g.dead) return; g.dead = true;
      const s = score(); if (s > best) { best = s; try { localStorage.setItem("st.patrolBest", String(best)); } catch (e) {} }
      msg.innerHTML = `${why}<br><b>${s}</b> points · best <b>${best}</b>`;
      setTimeout(() => over.classList.remove("hidden"), 450);
    }
    function drawTree(x, y, s) {
      ctx.fillStyle = "#6d4c41"; ctx.fillRect(x - 2 * s, y + 8 * s, 4 * s, 7 * s);
      ctx.fillStyle = "#2e7d32";
      for (let i = 0; i < 3; i++) { const w = (14 - i * 3) * s, ty = y - 14 * s + i * 7 * s; ctx.beginPath(); ctx.moveTo(x, ty - 6 * s); ctx.lineTo(x - w, ty + 10 * s); ctx.lineTo(x + w, ty + 10 * s); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(x, y - 20 * s); ctx.lineTo(x - 4 * s, y - 14 * s); ctx.lineTo(x + 4 * s, y - 14 * s); ctx.fill();
    }
    function drawSkier() {
      const x = g.x, y = g.y, lean = Math.max(-0.5, Math.min(0.5, g.vx / 500));
      ctx.save(); ctx.translate(x, y);
      if (g.dead) { ctx.rotate(1.3); }
      ctx.rotate(-lean * 0.6);
      ctx.strokeStyle = "#263238"; ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-6, 10); ctx.lineTo(-6 + lean * 8, 22); ctx.moveTo(6, 10); ctx.lineTo(6 + lean * 8, 22); ctx.stroke(); // skis
      ctx.fillStyle = "#d32f2f"; ctx.fillRect(-7, -8, 14, 16); // red patrol jacket
      ctx.fillStyle = "#fff"; ctx.fillRect(-1.5, -5, 3, 9); ctx.fillRect(-4.5, -2, 9, 3); // white cross
      ctx.fillStyle = "#ffcc80"; ctx.beginPath(); ctx.arc(0, -13, 5, 0, 7); ctx.fill();
      ctx.fillStyle = "#263238"; ctx.fillRect(-5, -18, 10, 4); // toque
      ctx.strokeStyle = "#90a4ae"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-8, -2); ctx.lineTo(-12, 12); ctx.moveTo(8, -2); ctx.lineTo(12, 12); ctx.stroke(); // poles
      ctx.restore();
    }
    function draw() {
      ctx.fillStyle = "#f7fbff"; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(120,150,190,.18)"; ctx.lineWidth = 1;
      const off = (g.dist * 20) % 60;
      for (let y = -off; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.quadraticCurveTo(W / 2, y + 18, W, y); ctx.stroke(); }
      for (const o of g.things) {
        if (o.k === "tree") drawTree(o.x, o.y, o.s);
        else if (o.k === "rock") { ctx.fillStyle = "#78909c"; ctx.beginPath(); ctx.ellipse(o.x, o.y, 13, 8, 0, 0, 7); ctx.fill(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(o.x - 2, o.y - 4, 8, 3, 0, 0, 7); ctx.fill(); }
        else if (o.k === "gate") { for (const px of [o.x, o.x + o.w]) { ctx.fillStyle = "#37474f"; ctx.fillRect(px - 1.5, o.y - 22, 3, 24); ctx.fillStyle = o.hit ? "#bdbdbd" : "#d32f2f"; ctx.fillRect(px + 1.5, o.y - 22, 12, 9); } }
        else if (o.k === "kit" && !o.got) { ctx.fillStyle = "#fff"; ctx.strokeStyle = "#d32f2f"; ctx.lineWidth = 2; ctx.fillRect(o.x - 10, o.y - 8, 20, 16); ctx.strokeRect(o.x - 10, o.y - 8, 20, 16); ctx.fillStyle = "#d32f2f"; ctx.fillRect(o.x - 2, o.y - 6, 4, 12); ctx.fillRect(o.x - 6, o.y - 2, 12, 4); }
      }
      drawSkier();
      if (g.flash > 0) { ctx.fillStyle = `rgba(46,158,68,${g.flash})`; ctx.font = "800 18px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillText("+ bonus!", g.x, g.y - 30); }
      if (g.t < 3 && !g.dead) { ctx.fillStyle = "rgba(31,41,51,.75)"; ctx.font = "600 15px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillText("Drag or use ← → · Go through red gates · Grab first-aid kits", W / 2, H - 40); }
      scoreEl.textContent = `${score()} pts`;
    }
    function loop(ts) {
      const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts;
      if (!g.dead) step(dt);
      draw(); raf = requestAnimationFrame(loop);
    }
    const kd = (e) => { if (e.key === "ArrowLeft") keys.l = true; if (e.key === "ArrowRight") keys.r = true; if (e.key === "Escape") quit(); if (g.dead && (e.key === " " || e.key === "Enter") && !over.classList.contains("hidden")) reset(); };
    const ku = (e) => { if (e.key === "ArrowLeft") keys.l = false; if (e.key === "ArrowRight") keys.r = false; };
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
    cv.addEventListener("pointerdown", (e) => { touchX = e.clientX; });
    cv.addEventListener("pointermove", (e) => { if (touchX != null) touchX = e.clientX; });
    const up = () => { touchX = null; }; cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up); cv.addEventListener("pointerleave", up);
    function quit() { cancelAnimationFrame(raf); window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); window.removeEventListener("resize", size); wrap.remove(); }
    wrap.addEventListener("click", (e) => { if (e.target.closest("[data-q]")) quit(); if (e.target.closest("[data-again]")) reset(); });
    reset(); raf = requestAnimationFrame(loop);
  }
})();
