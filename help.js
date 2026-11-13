// Help: in-app user manuals (volunteer + coordinator), and the Patrol Run ski game.
// The game opens from the patrol dog on the map (placed by the head coordinator in Manage).
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
    <li>${dot("var(--missing)")}<b>Purple</b>: sign reported missing</li>
    <li>${dot("#e03131")}<b>Small red dot</b>: dropped off, needs someone to pick it up</li>
    <li>🐕 <b>The patrol dog</b>: tap it for a quick game of Patrol Run</li></ul>

    <h3>3. Drop off your signs</h3>
    <ol><li>The <b>Next</b> panel shows your next address. Tap <b>Navigate</b> to open it in your maps app.</li>
    <li>Place the sign, then tap <b>✓ Sign dropped off</b>. The pin turns green.</li>
    <li>Repeat until you're done. You'll get confetti at the end!</li></ol>

    <h3>4. Pick up your signs</h3>
    <ol><li>On pickup day, go to each sign you're tasked with.</li>
    <li>Tap <b>✓ Sign picked up</b>. The pin turns grey.</li>
    <li>Sign not there? Tap <b>? Report missing</b>. The pin turns purple and a coordinator takes it from there.</li></ol>

    <h3>5. Take on more</h3>
    <ul><li>Grey pin: tap <b>🙋 I'll sign that</b> to drop a sign off there.</li>
    <li>Red-dot pin: tap <b>🙋 I'll pick this up</b>.</li>
    <li>Found a good spot? Tap <b>+ New sign</b>, drop the pin, add the address, a description and any hazards.</li></ul>

    <h3>6. Good to know</h3>
    <ul><li>Tapped by mistake? Use <b>Undo</b> on the sign's card.</li>
    <li>No signal? Keep going. Your taps save and sync when you're back online.</li>
    <li>The <b>Emergency</b> tab has your contacts.</li>
    <li>The sun/moon button switches light and dark view.</li></ul>

    <h3>Add the app to your home screen</h3>
    <p style="margin:0 0 6px">Open it like a regular app, full screen, with one tap.</p>
    <b>iPhone / iPad (Safari)</b>
    <ol><li>Open the app link in <b>Safari</b>.</li>
    <li>Tap the <b>Share</b> button (square with an up arrow).</li>
    <li>Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.</li></ol>
    <b>Android (Chrome)</b>
    <ol><li>Open the app link in <b>Chrome</b>.</li>
    <li>Tap the <b>⋮</b> menu (top right).</li>
    <li>Tap <b>Add to Home screen</b> (or <b>Install app</b>), then <b>Add</b>.</li></ol>
    <p style="margin:6px 0 0">Look for the Winter Extreme icon on your home screen.</p>
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

    <h3>Missing signs</h3>
    <ul><li>When a pickup volunteer taps <b>Report missing</b>, the pin turns <b>purple</b> and the sign goes back into <b>Last Call Stragglers</b> under <b>Pickup</b>.</li>
    <li>To send someone to look for it: <b>Assign → Pickup</b>, select it, <b>Assign to…</b>. If they find it, they tag it picked up.</li>
    <li>To give up on it: open the sign and tap <b>Clear missing</b>. It goes back to grey (potential location).</li></ul>

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

    <h3>Add the app to your home screen</h3>
    <p style="margin:0 0 6px">Open it like a regular app, full screen, with one tap.</p>
    <b>iPhone / iPad (Safari)</b>
    <ol><li>Open the app link in <b>Safari</b>.</li>
    <li>Tap the <b>Share</b> button (square with an up arrow).</li>
    <li>Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.</li></ol>
    <b>Android (Chrome)</b>
    <ol><li>Open the app link in <b>Chrome</b>.</li>
    <li>Tap the <b>⋮</b> menu (top right).</li>
    <li>Tap <b>Add to Home screen</b> (or <b>Install app</b>), then <b>Add</b>.</li></ol>
    <p style="margin:6px 0 0">Look for the Winter Extreme icon on your home screen.</p>
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

  // ---------- Shared high score (Firestore game/leader; local fallback in demo mode) ----------
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const first = (n) => String(n || "").trim().split(/\s+/)[0] || "Someone";
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
  let fbP = null;
  function fb() {
    if (!fbP) fbP = (async () => {
      try {
        if (!window.APP_CONFIG?.firebase?.projectId) return null;
        const U = (m) => `https://www.gstatic.com/firebasejs/10.14.1/firebase-${m}.js`;
        const [{ getApps }, A, F] = await Promise.all([import(U("app")), import(U("auth")), import(U("firestore"))]);
        const app = getApps()[0]; if (!app) return null;
        const auth = A.getAuth(app); if (!auth.currentUser) return null;
        return { F, db: F.getFirestore(app), uid: auth.currentUser.uid };
      } catch (e) { return null; }
    })();
    return fbP;
  }
  let myName = null;
  async function getMyName() {
    if (myName) return myName;
    const c = await fb();
    if (c) { try { const d = await withTimeout(c.F.getDoc(c.F.doc(c.db, "members", c.uid)), 5000); myName = d.data()?.name || null; } catch (e) {} }
    if (!myName) { try { myName = JSON.parse(localStorage.getItem("signtracker.demo.me") || "null")?.name || null; } catch (e) {} }
    return myName || ($("#meBtn")?.textContent || "").trim() || "You";
  }
  async function loadLeader() {
    const c = await fb();
    if (c) {
      try { const d = await withTimeout(c.F.getDoc(c.F.doc(c.db, "game", "leader")), 5000); const v = d.data(); return v ? { best: v.best || 0, name: v.name || "" } : { best: 0, name: "" }; }
      catch (e) { return null; }
    }
    try { return JSON.parse(localStorage.getItem("st.patrolLeader") || "null") || { best: 0, name: "" }; } catch (e) { return { best: 0, name: "" }; }
  }
  async function saveLeader(best) {
    const name = await getMyName();
    const c = await fb();
    if (c) {
      try { await withTimeout(c.F.setDoc(c.F.doc(c.db, "game", "leader"), { best, name, uid: c.uid, at: c.F.serverTimestamp() }), 8000); return { best, name }; }
      catch (e) { return null; }
    }
    try { localStorage.setItem("st.patrolLeader", JSON.stringify({ best, name })); } catch (e) {}
    return { best, name };
  }

  // ---------- Patrol Run: an original downhill dodging game ----------
  function startGame() {
    const wrap = document.createElement("div"); wrap.className = "game-modal";
    wrap.innerHTML = `<canvas></canvas>
      <div class="game-ui"><span id="gScore">0 pts</span><span id="gLead">Patrol Run</span><button class="btn small light" type="button" data-q>✕</button></div>
      <div class="game-over hidden"><div class="box"><h3>Wipeout!</h3><p id="gMsg"></p><div class="row"><button class="btn primary" type="button" data-again>Ski again</button><button class="btn light" type="button" data-q>Close</button></div></div></div>`;
    document.body.appendChild(wrap);
    const cv = wrap.querySelector("canvas"), ctx = cv.getContext("2d");
    const over = wrap.querySelector(".game-over"), scoreEl = wrap.querySelector("#gScore"), leadEl = wrap.querySelector("#gLead"), msg = wrap.querySelector("#gMsg");
    let W = 0, H = 0, dpr = 1;
    function size() { dpr = Math.min(2, window.devicePixelRatio || 1); W = wrap.clientWidth; H = wrap.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    size(); window.addEventListener("resize", size);

    let best = 0; try { best = +localStorage.getItem("st.patrolBest") || 0; } catch (e) {}
    let leader = null; // { best, name } or null when unknown (offline)
    const showLeader = () => {
      if (!leader || !leader.best) { leadEl.textContent = "Patrol Run"; return; }
      const s = g ? score() : 0;
      leadEl.textContent = s > leader.best ? "🏆 You're in the lead!" : `🏆 ${first(leader.name)} ${leader.best}`;
    };
    loadLeader().then((l) => { leader = l; showLeader(); });
    let g, raf = 0, last = 0, keys = { l: false, r: false }, touchX = null;

    function reset() {
      g = { x: W / 2, y: H * 0.28, vx: 0, speed: 160, dist: 0, bonus: 0, things: [], spawn: 0, dead: false, t: 0, flash: 0 };
      over.classList.add("hidden");
    }
    function spawn() {
      const r = Math.random(), x = 20 + Math.random() * (W - 40);
      if (r < 0.55) g.things.push({ k: "tree", x, y: H + 40, s: 0.8 + Math.random() * 0.5, v: pickTree() });
      else if (r < 0.70) g.things.push({ k: "rock", x, y: H + 30 });
      else if (r < 0.77) g.things.push({ k: "coffee", x, y: H + 30 });
      else if (r < 0.82 && g.t > 4 && !g.things.some((o) => o.k === "dog")) {
        // patrol dog trots across, timed to cross the middle about when it reaches you
        const t = (H + 30 - g.y) / g.speed, dir = Math.random() < 0.5 ? 1 : -1;
        const startX = dir > 0 ? -30 : W + 30, targetX = W * (0.3 + Math.random() * 0.4);
        g.things.push({ k: "dog", x: startX, y: H + 30, vx: (targetX - startX) / t, ph: 0 });
      }
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
      for (const o of g.things) { o.y -= dy; if (o.k === "dog") { o.x += o.vx * dt; o.ph += dt * 12; } }
      g.things = g.things.filter((o) => o.y > -60);
      for (const o of g.things) {
        if (o.k === "gate") {
          if (!o.hit && o.y < g.y && o.y + dy >= g.y) { o.hit = true; if (g.x > o.x + 6 && g.x < o.x + o.w - 6) { g.bonus += 50; g.flash = 0.5; g.flashText = "+50 gate!"; } }
          if ((Math.abs(g.x - o.x) < 8 || Math.abs(g.x - (o.x + o.w)) < 8) && Math.abs(o.y - g.y) < 10) die("You clipped a gate pole.");
        } else if (o.k === "kit") {
          if (!o.got && Math.abs(o.x - g.x) < 18 && Math.abs(o.y - g.y) < 18) { o.got = true; g.bonus += 100; g.flash = 0.6; g.flashText = "+100 first aid!"; }
        } else if (o.k === "coffee") {
          if (!o.got && Math.abs(o.x - g.x) < 18 && Math.abs(o.y - g.y) < 20) { o.got = true; g.bonus += 150; g.flash = 0.7; g.flashText = "+150 coffee! ☕"; }
        } else if (o.k === "dog") {
          if (Math.abs(o.x - g.x) < 20 && Math.abs(o.y - g.y) < 14) die("You tripped over the patrol dog. He's fine, just wants pets!");
        } else {
          const rad = o.k === "tree" ? TREES[o.v].rad * o.s : 12;
          const oy = o.k === "tree" ? o.y + 2 * o.s : o.y;
          if (Math.hypot(o.x - g.x, oy - g.y) < rad + 7) die(o.k === "tree" ? "Tree wins this round." : "Hit a rock.");
        }
      }
      if (g.flash > 0) g.flash -= dt;
    }
    function score() { return Math.floor(g.dist) + g.bonus; }
    function die(why) {
      if (g.dead) return; g.dead = true;
      const s = score(); if (s > best) { best = s; try { localStorage.setItem("st.patrolBest", String(best)); } catch (e) {} }
      const line = (l) => l && l.best ? `🏆 Leader: <b>${esc(first(l.name))}</b> with <b>${l.best}</b>` : "";
      msg.innerHTML = `${why}<br>Your score <b>${s}</b> · your best <b>${best}</b><br><span data-lead>${line(leader)}</span>`;
      setTimeout(() => over.classList.remove("hidden"), 450);
      const leadSpan = msg.querySelector("[data-lead]");
      (async () => {
        const l = await loadLeader(); if (l) leader = l;
        if (leader && s > leader.best) {
          const beat = leader.best ? ` You beat ${esc(first(leader.name))}'s ${leader.best}.` : "";
          leadSpan.innerHTML = `🏆 <b>New leader!</b>${beat}`;
          const saved = await saveLeader(s);
          if (saved) leader = saved; else { const l2 = await loadLeader(); if (l2) leader = l2; if (!saved) leadSpan.innerHTML = line(leader) || "Couldn't save the high score. Check your signal."; }
        } else leadSpan.innerHTML = line(leader);
        showLeader();
      })();
    }
    // Pixel-art trees, generated once per game: speckled pines, snowy pines and a bare snag.
    const TREE_PX = 2, TREE_W = 22, TREE_H = 28; // sprite grid (units) and unit size (px)
    function makeTree(kind, seed) {
      let r = seed; const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
      const c = document.createElement("canvas"); c.width = TREE_W * TREE_PX * 2; c.height = TREE_H * TREE_PX * 2;
      const x = c.getContext("2d"); x.scale(2, 2);
      const dot = (u, v, col) => { x.fillStyle = col; x.fillRect(u * TREE_PX, v * TREE_PX, TREE_PX, TREE_PX); };
      const mid = TREE_W / 2;
      if (kind === "snag") {
        for (let v = 3; v < TREE_H; v++) { const w = v > 22 ? 2 : 1; for (let u = Math.floor(mid - w); u < Math.ceil(mid + w); u++) dot(u, v, rnd() < 0.3 ? "#4e342e" : "#6d4c41"); }
        for (let i = 0; i < 6; i++) { const v = 5 + Math.floor(rnd() * 13), dir = rnd() < 0.5 ? -1 : 1, len = 2 + Math.floor(rnd() * 4);
          for (let k = 1; k <= len; k++) dot(mid + dir * k - (dir < 0 ? 1 : 0), v - Math.floor(k / 2), "#5d4037"); }
        return { c, rad: 5 };
      }
      const greens = ["#0f3d1f", "#14532d", "#1b6b30", "#24813a", "#2f9a45", "#4cb456", "#86d36a"];
      const tiers = kind === "bush" ? [[8, 24, 9.5]] : [[0, 9, 5.5], [6, 16, 8.5], [12, 24, 10.5]]; // [top row, bottom row, half-width]
      for (const [top, bot, hw] of tiers) {
        for (let v = top; v <= bot; v++) {
          const t = (v - top) / (bot - top), w = Math.max(0.8, (kind === "bush" ? Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.95)) : 0.08 + t * 0.92) * hw + (rnd() - 0.5) * 1.2);
          const u0 = Math.floor(mid - w), u1 = Math.ceil(mid + w) - 1;
          for (let u = u0; u <= u1; u++) {
            const side = (u - mid) / Math.max(1, w); // -1 left (lit) .. 1 right (shade)
            let k = Math.floor(3 - side * 1.8 + (rnd() - 0.5) * 3.2); k = Math.max(0, Math.min(greens.length - 1, 6 - k));
            let col = greens[k];
            if (kind === "snowy" && ((v - top < 1) || (v >= bot - 1 && (u <= u0 + 2 || u >= u1 - 2) && v !== bot) || (v === bot && (u <= u0 + 3 || u >= u1 - 3) && u !== u0 && u !== u1))) col = side < 0.2 ? "#ffffff" : "#d6e4f2";
            dot(u, v, col);
          }
        }
      }
      for (let v = 23; v < TREE_H; v++) for (let u = mid - 2; u < mid + 2; u++) dot(u, v, rnd() < 0.4 ? "#7a5a12" : "#a3801f");
      return { c, rad: kind === "bush" ? 9 : 11 };
    }
    const TREES = [];
    for (let i = 0; i < 4; i++) TREES.push(makeTree("pine", 101 + i * 977));
    for (let i = 0; i < 2; i++) TREES.push(makeTree("snowy", 7001 + i * 313));
    TREES.push(makeTree("bush", 4242));
    TREES.push(makeTree("snag", 999));
    const pickTree = () => { const r = Math.random(); return r < 0.55 ? Math.floor(Math.random() * 4) : r < 0.80 ? 4 + Math.floor(Math.random() * 2) : r < 0.92 ? 6 : 7; };
    function drawTree(x, y, s, v) {
      const t = TREES[v ?? 0], w = TREE_W * TREE_PX * s, h = TREE_H * TREE_PX * s;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(t.c, Math.round(x - w / 2), Math.round(y + 18 * s - h), Math.round(w), Math.round(h));
      ctx.imageSmoothingEnabled = true;
    }
    function drawCoffee(x, y) {
      ctx.fillStyle = "#fff"; ctx.strokeStyle = "#5d4037"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x - 8, y - 8); ctx.lineTo(x + 8, y - 8); ctx.lineTo(x + 6, y + 10); ctx.lineTo(x - 6, y + 10); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#d32f2f"; ctx.fillRect(x - 9, y - 12, 18, 4); // lid
      ctx.fillStyle = "#8d6e63"; ctx.fillRect(x - 7, y - 1, 14, 5); // sleeve
      ctx.strokeStyle = "rgba(120,120,120,.6)"; ctx.lineWidth = 1.5; const w = Math.sin(performance.now() / 200) * 2;
      ctx.beginPath(); ctx.moveTo(x - 3, y - 14); ctx.quadraticCurveTo(x - 6 + w, y - 19, x - 3, y - 24); ctx.moveTo(x + 3, y - 14); ctx.quadraticCurveTo(x + w, y - 19, x + 3, y - 24); ctx.stroke(); // steam
    }
    function drawDog(o) { drawDogOn(ctx, o); }
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
        if (o.k === "tree") drawTree(o.x, o.y, o.s, o.v);
        else if (o.k === "rock") { ctx.fillStyle = "#78909c"; ctx.beginPath(); ctx.ellipse(o.x, o.y, 13, 8, 0, 0, 7); ctx.fill(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(o.x - 2, o.y - 4, 8, 3, 0, 0, 7); ctx.fill(); }
        else if (o.k === "gate") { for (const px of [o.x, o.x + o.w]) { ctx.fillStyle = "#37474f"; ctx.fillRect(px - 1.5, o.y - 22, 3, 24); ctx.fillStyle = o.hit ? "#bdbdbd" : "#d32f2f"; ctx.fillRect(px + 1.5, o.y - 22, 12, 9); } }
        else if (o.k === "coffee" && !o.got) drawCoffee(o.x, o.y);
        else if (o.k === "dog") drawDog(o);
        else if (o.k === "kit" && !o.got) { ctx.fillStyle = "#fff"; ctx.strokeStyle = "#d32f2f"; ctx.lineWidth = 2; ctx.fillRect(o.x - 10, o.y - 8, 20, 16); ctx.strokeRect(o.x - 10, o.y - 8, 20, 16); ctx.fillStyle = "#d32f2f"; ctx.fillRect(o.x - 2, o.y - 6, 4, 12); ctx.fillRect(o.x - 6, o.y - 2, 12, 4); }
      }
      drawSkier();
      if (g.flash > 0) { ctx.fillStyle = `rgba(46,158,68,${g.flash})`; ctx.font = "800 18px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillText(g.flashText || "+ bonus!", g.x, g.y - 30); }
      if (g.t < 3.5 && !g.dead) { ctx.fillStyle = "rgba(31,41,51,.75)"; ctx.font = "600 15px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillText("Watch out for the patrol dog!", W / 2, H - 62); }
      if (g.t < 3.5 && !g.dead) { ctx.fillStyle = "rgba(31,41,51,.75)"; ctx.font = "600 15px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillText("Drag or ← → · Gates, first-aid kits & coffee = points", W / 2, H - 40); }
      scoreEl.textContent = `${score()} pts`;
      if (!g.dead && leader) showLeader();
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

  // The patrol dog, drawn the same way as in the game
  function drawDogOn(ctx, o) {
    const d = o.vx >= 0 ? 1 : -1, leg = Math.sin(o.ph) * 4;
    ctx.save(); ctx.translate(o.x, o.y); ctx.scale(d, 1);
    ctx.strokeStyle = "#b07a1e"; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-10, 4); ctx.lineTo(-10 + leg, 13); ctx.moveTo(-5, 4); ctx.lineTo(-5 - leg, 13); ctx.moveTo(7, 4); ctx.lineTo(7 + leg, 13); ctx.moveTo(11, 4); ctx.lineTo(11 - leg, 13); ctx.stroke(); // legs
    ctx.beginPath(); ctx.moveTo(-15, -2); ctx.quadraticCurveTo(-24, -10 + leg, -21, -14); ctx.stroke(); // tail
    ctx.fillStyle = "#e0a63a"; ctx.beginPath(); ctx.ellipse(0, 0, 16, 8, 0, 0, 7); ctx.fill(); // body
    ctx.fillStyle = "#d32f2f"; ctx.fillRect(-8, -7, 15, 12); // red vest
    ctx.fillStyle = "#fff"; ctx.fillRect(-2, -5, 3, 8); ctx.fillRect(-4.5, -2.5, 8, 3); // white cross
    ctx.fillStyle = "#e0a63a"; ctx.beginPath(); ctx.ellipse(17, -7, 7, 6, 0, 0, 7); ctx.fill(); // head
    ctx.beginPath(); ctx.ellipse(23, -5, 4, 3, 0, 0, 7); ctx.fill(); // snout
    ctx.fillStyle = "#b07a1e"; ctx.beginPath(); ctx.ellipse(14, -5, 3, 5, 0.3, 0, 7); ctx.fill(); // ear
    ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(26.5, -5.5, 1.6, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(19, -9, 1.2, 0, 7); ctx.fill(); // nose, eye
    ctx.restore();
  }

  // Map icon: the game's dog as an image (64x40 CSS pixels)
  let dogURL = null;
  function dogIcon() {
    if (dogURL) return dogURL;
    const c = document.createElement("canvas"), k = 2; c.width = 64 * k; c.height = 40 * k;
    const x = c.getContext("2d"); x.scale(k, k);
    drawDogOn(x, { x: 30, y: 24, vx: 1, ph: 0.6 });
    return (dogURL = c.toDataURL("image/png"));
  }

  window.PatrolRun = { start: startGame, dogIcon };
  window.dispatchEvent(new Event("patrolrun-ready"));
})();
