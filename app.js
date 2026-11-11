import { createStore, normalizeCode, isVolunteerCode, codeFromPhone } from "./store.js";

const cfg = window.APP_CONFIG || {};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const STATUS_LABEL = { pending: "To place", placed: "Placed", retrieved: "Retrieved" };
const COLORS = { pending: "var(--pending)", placed: "var(--placed)", retrieved: "var(--retrieved)" };

const state = {
  store: null, me: null, signs: [], members: [],
  scope: localStorage.getItem("st.scope") || "mine",
  status: "all", sort: "num", selectedId: null,
  userPos: null, offline: false,
  skipped: new Set(), nextHidden: false,
  assign: { on: false, job: "drop", sel: new Set() },
  info: { contacts: null, safety: null }, roster: [], editing: { contacts: false, safety: false },
};

// Google Maps objects
const gm = { map: null, markers: new Map(), meMarker: null, picking: false };

// ------------------------------------------------------------------ helpers
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
const fmtTime = (ms) => ms ? new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

// Each sign has two assignments: who places it (assignee) and who picks it up (pickupAssignee).
const JOB_FIELD = { drop: "assignee", pickup: "pickupAssignee" };
const JOB_LABEL = { drop: "Drop-off", pickup: "Pickup" };
const splitNames = (v) => String(v || "").split(/\s*(?:,|&|\/|\band\b)\s*/i).map((n) => n.trim()).filter(Boolean);
function assigneesOf(sign, job = "drop") { return splitNames(sign[JOB_FIELD[job]]).map(norm); }
function mineFor(sign, job) { return !!state.me && assigneesOf(sign, job).includes(norm(state.me.name)); }
function isMine(sign) { return mineFor(sign, "drop") || mineFor(sign, "pickup"); }
// Signs with nobody assigned for a job: drop-off = still to place; pickup = not yet retrieved
function stragglers(job) {
  return state.signs.filter((s) => !assigneesOf(s, job).length &&
    (job === "drop" ? (s.status || "pending") === "pending" : s.status !== "retrieved"));
}
function isAdmin() { return state.me?.role === "admin"; }

let toastTimer;
function toast(msg, ms = 2600) {
  const t = $("#toast"); t.textContent = msg; t.classList.remove("hidden");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add("hidden"), ms);
}

function distM(a, b) {
  const R = 6371000, toR = (d) => d * Math.PI / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function fmtDist(m) { return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`; }
const hasLoc = (s) => typeof s.lat === "number" && typeof s.lng === "number";


// ------------------------------------------------------------------ boot
document.querySelectorAll(".event-name").forEach((el) => (el.textContent = cfg.eventName || "Sign Tracker"));
document.title = [cfg.orgName, cfg.eventName || "Sign Tracker"].filter(Boolean).join(" – ");

// ------------------------------------------------------------------ light / dark view
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("st.theme", t); } catch {}
  document.querySelector('meta[name="theme-color"]').content = t === "dark" ? "#26282b" : "#c8102e";
}
applyTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
$$(".theme-btn").forEach((b) => b.onclick = () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));

boot().catch((e) => {
  console.error(e);
  $("#loadingMsg").innerHTML = `<b>Couldn't start.</b><br>${esc(e.message || e)}`;
  $(".spinner").classList.add("hidden");
});

async function boot() {
  state.store = await createStore(cfg);
  if (state.store.demo) $("#demoNote").classList.remove("hidden");
  state.me = await state.store.getMe();
  $("#loading").classList.add("hidden");
  if (!state.me) showJoin(); else startApp();
}

// Starts with digits or ends in CSP: meant as a volunteer code, even if mistyped
const looksLikeVolCode = (v) => /^\d/.test(v.trim()) || /csp$/i.test(v.trim());
function showJoin() {
  $("#join").classList.remove("hidden");
  const code = $("#joinCode"), nameWrap = $("#joinNameWrap");
  // Volunteer codes look like 0142CSP. Anything else is treated as the coordinator code, which needs a name.
  const update = () => {
    const v = code.value.trim();
    const coord = v.length >= 4 && !isVolunteerCode(v) && !looksLikeVolCode(v);
    nameWrap.classList.toggle("hidden", !coord);
    $("#joinName").required = coord;
  };
  code.oninput = () => { $("#joinErr").textContent = ""; update(); };
  $("#joinName").value = localStorage.getItem("st.lastName") || "";
  $("#joinForm").onsubmit = async (e) => {
    e.preventDefault();
    const raw = code.value.trim(); if (!raw) return;
    const btn = e.submitter || $("#joinForm button[type=submit]"); btn.disabled = true; $("#joinErr").textContent = "";
    try {
      if (!isVolunteerCode(raw) && looksLikeVolCode(raw))
        throw new Error("Volunteer codes are the last 4 digits of your phone + CSP, e.g. 0142CSP.");
      if (isVolunteerCode(raw)) {
        const c = normalizeCode(raw);
        const entry = await state.store.lookupCode(c);
        if (!entry) throw new Error(`${c} isn't on the volunteer list. Check the last 4 digits of your phone, or ask your coordinator to add you.`);
        state.me = await state.store.join(entry.name, c, "volunteer");
      } else {
        update();
        const name = $("#joinName").value.trim();
        if (!name) { $("#joinName").focus(); throw new Error("Coordinators: enter your name too."); }
        state.me = await state.store.join(name, raw, "admin");
        localStorage.setItem("st.lastName", name);
      }
      $("#join").classList.add("hidden");
      startApp();
      toast(`Welcome, ${state.me.name.split(" ")[0]}!`);
    } catch (err) {
      $("#joinErr").textContent = err.message === "That access code wasn't accepted." ? "That code wasn't recognised. Check it and try again." : (err.message || "Couldn't sign in.");
    } finally { btn.disabled = false; }
  };
}

let started = false;
function startApp() {
  if (started) return; started = true;
  $("#app").classList.remove("hidden");
  $("#meBtn").textContent = state.me.name;
  if (isAdmin()) { $("#adminBtn").classList.remove("hidden"); if (state.scope === "mine") state.scope = "all"; }
  wireUI();
  syncFilterUI();
  initMap();
  state.store.subscribeSigns((signs, meta) => {
    state.signs = signs;
    state.offline = !!meta?.fromCache && !navigator.onLine;
    render();
  }, (err) => {
    console.error(err);
    toast("Lost access to the sign list. Try reloading.", 5000);
  });
  if (isAdmin()) {
    document.body.classList.add("is-admin");
    state.store.subscribeMembers((m) => { state.members = m; renderAdminLists(); renderAssign(); });
    state.store.subscribeRoster((r) => { state.roster = r; renderAdminLists(); renderAssign(); });
    $("#assignBtn").classList.remove("hidden");
  }
  renderContacts(); renderSafety();
  state.store.subscribeInfo("contacts", (d) => { state.info.contacts = d; renderContacts(); });
  state.store.subscribeInfo("safety", (d) => { state.info.safety = d; renderSafety(); updateSafetyDot(); });
  try {
    navigator.permissions?.query({ name: "geolocation" }).then((p) => { if (p.state === "granted") startLocating(false); }).catch(() => {});
  } catch {}
  window.addEventListener("online", render);
  window.addEventListener("offline", render);
}

// ------------------------------------------------------------------ UI wiring
function wireUI() {
  $$(".tabs button").forEach((b) => b.onclick = () => setView(b.dataset.view));
  $$("#scopeSeg button").forEach((b) => b.onclick = () => { state.scope = b.dataset.scope; localStorage.setItem("st.scope", state.scope); syncFilterUI(); render(); fitToVisible(); });
  $("#statusFilter").onchange = (e) => { state.status = e.target.value; render(); };
  $("#sortSel").onchange = (e) => { state.sort = e.target.value; if (state.sort === "near") startLocating(false); render(); };
  $("#locateBtn").onclick = () => startLocating(true);
  $("#meBtn").onclick = async () => {
    if (!confirm(`Signed in as ${state.me.name}${isAdmin() ? " (coordinator)" : ""}.\n\nSign out? You'll need the access code to get back in.`)) return;
    await state.store.leave(); location.reload();
  };
  $("#adminBtn").onclick = openAdmin;
  $("#adminClose").onclick = closeAdmin;
  $("#admin").onclick = (e) => { if (e.target.id === "admin") closeAdmin(); };

  // Delegated actions on sign cards (list and map card)
  document.body.addEventListener("click", onCardClick);
}

function syncFilterUI() {
  $$("#scopeSeg button").forEach((b) => b.classList.toggle("active", b.dataset.scope === state.scope));
}

const isDesktop = () => window.matchMedia("(min-width: 900px)").matches;
function setView(v) {
  const signsView = v === "map" || v === "list";
  $(".layout").classList.toggle("hidden", !signsView);
  if (signsView) $(".layout").dataset.view = v;
  $("#safetyPage").classList.toggle("hidden", v !== "safety");
  $("#contactsPage").classList.toggle("hidden", v !== "contacts");
  $$(".tabs button").forEach((b) => b.classList.toggle("active",
    b.dataset.view === v || (v === "list" && b.dataset.view === "map" && isDesktop())));
  if (v === "safety") markSafetySeen();
  if (signsView && gm.map) setTimeout(() => gm.map.invalidateSize(), 50);
}

async function onCardClick(e) {
  const el = e.target.closest("[data-act]"); if (!el) return;
  const id = el.dataset.id, act = el.dataset.act;
  const sign = state.signs.find((s) => s.id === id);
  if (act === "close") { select(null); return; }
  if (!sign) return;
  const who = state.me.name;
  const upd = (patch, msg) => {
    state.store.updateSign(id, { ...patch, updatedAt: "NOW", updatedBy: who })
      .catch((err) => { console.error(err); toast("Couldn't save — " + (err.code === "permission-denied" ? "no permission." : "please try again."), 4000); });
    toast(msg);
  };
  switch (act) {
    case "place": upd({ status: "placed", placedBy: who, placedAt: "NOW" }, `#${sign.num} marked placed ✓`); maybeCelebrate("placed", id); break;
    case "retrieve": upd({ status: "retrieved", retrievedBy: who, retrievedAt: "NOW" }, `#${sign.num} marked retrieved ✓`); maybeCelebrate("retrieved", id); break;
    case "undo-place": if (confirm(`Undo "placed" for #${sign.num}?`)) upd({ status: "pending", placedBy: null, placedAt: null }, "Undone"); break;
    case "undo-retrieve": if (confirm(`Undo "retrieved" for #${sign.num}?`)) upd({ status: "placed", retrievedBy: null, retrievedAt: null }, "Undone"); break;
    case "place-again":
      if (confirm(`Put #${sign.num} back to "To place"${sign.assignee ? ` for ${sign.assignee}` : ""}? Its placed/retrieved times and pickup volunteer are cleared. You can change who places it in Assign mode.`))
        upd(RESET_TO_PLACE, `#${sign.num} is back to "To place"`);
      break;
    case "show": select(id, true); setView("map"); break;
    case "nav": openNav(sign); break;
    case "nav-change": openNav(sign, true); break;
    case "skip": state.skipped.add(id); render(); break;
    case "hide-next": state.nextHidden = true; render(); break;
    case "edit": if (canEdit(sign)) openSignSheet(sign); break;
  }
}

function maybeCelebrate(newStatus, changedId) {
  const job = newStatus === "placed" ? "drop" : "pickup";
  const mine = state.signs.filter((s) => mineFor(s, job));
  const changed = state.signs.find((s) => s.id === changedId);
  if (!mine.length || !changed || !mineFor(changed, job)) return;
  const left = mine.filter((s) => s.id !== changedId && (newStatus === "placed" ? s.status === "pending" : s.status !== "retrieved"));
  if (left.length === 0) setTimeout(() => celebrate(newStatus === "placed"
    ? `All ${mine.length} of your signs are placed.`
    : `All ${mine.length} of your signs are picked up.`), 700);
}

// ------------------------------------------------------------------ render
function visibleSigns() {
  let list = state.signs.slice();
  if (state.scope === "mine") list = list.filter(isMine);
  if (state.status !== "all") list = list.filter((s) => s.status === state.status);
  if (state.sort === "near" && state.userPos) {
    list.forEach((s) => (s._d = hasLoc(s) ? distM(state.userPos, s) : Infinity));
    list.sort((a, b) => a._d - b._d);
  } else {
    // Unfinished work first, then by number
    const rank = (s) => (s.status === "retrieved" ? 1 : 0);
    list.sort((a, b) => rank(a) - rank(b) || (a.num || 0) - (b.num || 0));
  }
  return list;
}

function render() {
  const online = navigator.onLine;
  const syncing = state.signs.some((s) => s._pending);
  const badge = $("#syncBadge");
  badge.classList.toggle("hidden", online && !syncing);
  badge.textContent = online ? "Syncing…" : "Offline – will sync";

  renderProgress();
  renderNext();
  renderAssign();
  const list = visibleSigns();
  $("#listCount").textContent = list.length;
  const box = $("#list");
  if (!list.length) {
    box.innerHTML = `<div class="empty">${state.signs.length === 0
      ? (isAdmin() ? "No signs yet. Tap <b>Manage</b> to add some." : "No signs have been added yet.")
      : state.scope === "mine" ? `No signs assigned to <b>${esc(state.me.name)}</b>${state.status !== "all" ? " with this status" : ""}.<br><br>Make sure your name matches what your coordinator used, or switch to <b>All signs</b>.`
      : "No signs match this filter."}</div>`;
  } else {
    box.innerHTML = list.map((s) => cardHTML(s)).join("");
  }
  renderMarkers();
  renderMapCard();
  if (!isAdmin()) {
    $("#memberNames").innerHTML = allVolunteerNames().map((n) => `<option value="${esc(n)}">`).join("");
  }
  if (cfg.fitToSignsOnOpen && !fittedOnce && gm.map && state.signs.length) { fittedOnce = true; fitToVisible(); }
  if (isAdmin() && !$("#admin").classList.contains("hidden")) renderAdminLists();
}

function renderProgress() {
  const myDrop = state.signs.filter((s) => mineFor(s, "drop"));
  const myPick = state.signs.filter((s) => mineFor(s, "pickup"));
  const mine = state.signs.filter(isMine);
  const bar = (label, n, total, color) => `
    <div class="bar-row"><span>${label}</span>
      <div class="bar"><span style="width:${total ? (100 * n / total) : 0}%;background:${color}"></span></div>
      <span class="n">${n}/${total}</span></div>`;
  let html = "";
  const placedN = (arr) => arr.filter((s) => s.status && s.status !== "pending").length;
  const retrN = (arr) => arr.filter((s) => s.status === "retrieved").length;
  if (mine.length) {
    html += `<h4>My signs</h4>`;
    if (myDrop.length) html += bar("Placed", placedN(myDrop), myDrop.length, COLORS.placed);
    if (myPick.length) html += bar("Retrieved", retrN(myPick), myPick.length, COLORS.retrieved);
    if (myPick.length && retrN(myPick) === myPick.length) html += `<div class="done-msg">All your pickups are done. Thank you!</div>`;
    else if (myDrop.length && placedN(myDrop) === myDrop.length && !myPick.length) html += `<div class="done-msg">All your signs are placed. Thank you!</div>`;
  }
  if (isAdmin() || !mine.length) {
    const all = state.signs;
    html += `<h4>Everyone</h4>${bar("Placed", placedN(all), all.length, COLORS.placed)}${bar("Retrieved", retrN(all), all.length, COLORS.retrieved)}`;
  }
  $("#progressBox").innerHTML = html || `<h4>Progress</h4><span class="muted small">No signs yet.</span>`;
}

function cardHTML(s, inMap = false) {
  const st = s.status || "pending";
  let statusLine = `<b class="${st}">${STATUS_LABEL[st]}</b>`;
  if (s.placedAt) statusLine += ` · placed ${esc(fmtTime(s.placedAt))}${s.placedBy ? " by " + esc(s.placedBy) : ""}`;
  if (s.retrievedAt) statusLine += ` · retrieved ${esc(fmtTime(s.retrievedAt))}${s.retrievedBy ? " by " + esc(s.retrievedBy) : ""}`;
  if (s._pending) statusLine += ` · <i>saving…</i>`;
  const dist = state.userPos && hasLoc(s) ? ` · ${fmtDist(distM(state.userPos, s))} away` : "";
  let main = "";
  if (st === "pending") main = `<button class="btn place" data-act="place" data-id="${s.id}">✓ Mark placed</button>`;
  else if (st === "placed") main = `<button class="btn retrieve" data-act="retrieve" data-id="${s.id}">✓ Mark retrieved</button>`;
  const undo = st === "placed" ? `<button class="btn link" data-act="undo-place" data-id="${s.id}">Undo placed</button>`
    : st === "retrieved" ? `${isAdmin() ? `<button class="btn light" data-act="place-again" data-id="${s.id}">↺ Place again</button>` : ""}<button class="btn link" data-act="undo-retrieve" data-id="${s.id}">Undo retrieved</button>` : "";
  return `
  <div class="sign ${state.selectedId === s.id && !inMap ? "sel" : ""}" id="${inMap ? "" : "card-" + s.id}">
    ${inMap ? `<button class="close-x" data-act="close" data-id="${s.id}" aria-label="Close">×</button>` : ""}
    <div class="sign-head">
      <div class="num ${st}">${esc(s.num ?? "")}</div>
      <div style="min-width:0;flex:1">
        <div class="addr" data-act="show" data-id="${s.id}">${esc(s.address)}</div>
        <div class="meta">Drop-off: ${s.assignee ? esc(s.assignee) : '<i class="unas">unassigned</i>'} · Pickup: ${s.pickupAssignee ? esc(s.pickupAssignee) : '<i class="unas">unassigned</i>'}${dist}</div>
        ${s.createdBy ? `<div class="meta small">Added by ${esc(s.createdBy)}</div>` : ""}
        ${hasLoc(s) ? "" : `<div class="warn">Not on map — address couldn't be located</div>`}
      </div>
    </div>
    ${s.notes ? `<div class="notes">${esc(s.notes)}</div>` : ""}
    ${s.hazards?.length ? `<div class="hazards" aria-label="Hazards"><span class="hz-label">⚠ Hazards</span>${s.hazards.map((h) => `<span class="hz">${esc(h)}</span>`).join("")}</div>` : ""}
    <div class="status">${statusLine}</div>
    <div class="actions">
      ${main}
      <button class="btn light" data-act="nav" data-id="${s.id}">Directions</button>
      ${undo}
      ${canEdit(s) ? `<button class="btn link" data-act="edit" data-id="${s.id}">Edit</button>` : ""}
    </div>
  </div>`;
}

function select(id, pan = false) {
  state.selectedId = id;
  renderMapCard();
  $$(".sign.sel").forEach((el) => el.classList.remove("sel"));
  if (id) {
    const card = document.getElementById("card-" + id);
    if (card) { card.classList.add("sel"); card.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
    const s = state.signs.find((x) => x.id === id);
    if (pan && gm.map && s && hasLoc(s)) gm.map.setView([s.lat, s.lng], Math.max(gm.map.getZoom(), 16));
  }
}

function renderMapCard() {
  const box = $("#mapCard");
  const s = state.signs.find((x) => x.id === state.selectedId);
  if (!s) { box.classList.add("hidden"); box.innerHTML = ""; return; }
  box.innerHTML = cardHTML(s, true);
  box.classList.remove("hidden");
}

// ------------------------------------------------------------------ map (Leaflet + OpenStreetMap — free, no key)
function initMap() {
  if (!window.L) {
    showMapMsg("The map couldn't load. Check your internet connection.<br>The <b>List</b> tab still works.");
    if (window.innerWidth < 900) setView("list");
    return;
  }
  const c = cfg.defaultCenter || { lat: 49.2827, lng: -123.1207 };
  gm.map = L.map("map", { zoomControl: true }).setView([c.lat, c.lng], cfg.defaultZoom || 12);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(gm.map);
  gm.map.on("click", (e) => {
    if (gm.picking) { finishPick(e.latlng); return; }
    select(null);
  });
  renderMarkers();
  if (cfg.fitToSignsOnOpen) fitToVisible();
}

function showMapMsg(html) { const m = $("#mapMsg"); m.innerHTML = `<div>${html}</div>`; m.classList.remove("hidden"); }

// Drop-off: signs still to place, or already retrieved (they can be placed again).
// Pickup: anything not yet retrieved.
function assignable(s, job = state.assign.job) {
  return job === "drop" ? (s.status || "pending") !== "placed" : s.status !== "retrieved";
}
const RESET_TO_PLACE = { status: "pending", placedBy: null, placedAt: null, retrievedBy: null, retrievedAt: null, pickupAssignee: "" };
function makeIcon(s) {
  const st = s.status || "pending";
  if (state.assign.on) {
    const names = splitNames(s[JOB_FIELD[state.assign.job]]);
    const ok = assignable(s), sel = state.assign.sel.has(s.id);
    const cls = ["pin", "apin", !names.length ? "unas" : "", sel ? "selected" : "", ok ? "" : "faded"].join(" ");
    const style = names.length ? `style="background:${volColor(names[0])}"` : "";
    return L.divIcon({ className: "", html: `<div class="${cls}" ${style}><span>${esc(s.num ?? "")}</span></div>${sel ? '<b class="pin-check">✓</b>' : ""}`,
      iconSize: [30, 40], iconAnchor: [15, 40] });
  }
  const mine = isMine(s);
  return L.divIcon({
    className: "",
    html: `<div class="pin ${st}${mine ? " mine" : ""}"><span>${esc(s.num ?? "")}</span></div>`,
    iconSize: [30, 40], iconAnchor: [15, 40],
  });
}

function renderMarkers() {
  if (!gm.map) return;
  const vis = new Set((state.assign.on ? state.signs : visibleSigns()).filter(hasLoc).map((s) => s.id));
  for (const [id, m] of gm.markers) if (!vis.has(id)) { m.remove(); gm.markers.delete(id); }
  for (const s of state.signs) {
    if (!vis.has(s.id)) continue;
    const a = state.assign;
    const key = `${s.status}|${s.num}|${s.lat}|${s.lng}|${isMine(s)}` +
      (a.on ? `|A|${a.job}|${a.sel.has(s.id)}|${s[JOB_FIELD[a.job]] || ""}` : "");
    let m = gm.markers.get(s.id);
    if (m && m._key === key) continue;
    if (m) m.remove();
    m = L.marker([s.lat, s.lng], {
      icon: makeIcon(s), title: `#${s.num} ${s.address}`,
      zIndexOffset: state.assign.on ? (assignable(s) ? 300 : 0) : s.status === "pending" ? 300 : s.status === "placed" ? 200 : 0,
    }).addTo(gm.map);
    m._key = key;
    m.on("click", (e) => { L.DomEvent.stopPropagation(e); state.assign.on ? toggleSel(s.id) : select(s.id); });
    gm.markers.set(s.id, m);
  }
}

let fittedOnce = false;
function fitToVisible() {
  if (!gm.map) return;
  const pts = visibleSigns().filter(hasLoc);
  if (!pts.length) return;
  if (pts.length === 1) gm.map.setView([pts[0].lat, pts[0].lng], 16);
  else gm.map.fitBounds(pts.map((s) => [s.lat, s.lng]), { padding: [50, 50] });
}

// ------------------------------------------------------------------ location
let watchId = null;
function startLocating(center) {
  if (!("geolocation" in navigator)) { toast("Location isn't available on this device."); return; }
  if (watchId !== null) { if (center && state.userPos && gm.map) gm.map.panTo([state.userPos.lat, state.userPos.lng]); return; }
  let first = true;
  watchId = navigator.geolocation.watchPosition((p) => {
    state.userPos = { lat: p.coords.latitude, lng: p.coords.longitude };
    const ll = [state.userPos.lat, state.userPos.lng];
    if (gm.map) {
      if (!gm.meMarker) {
        gm.meMarker = L.marker(ll, { icon: L.divIcon({ className: "", html: '<div class="me-pin"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }), title: "You", zIndexOffset: 1000, interactive: false }).addTo(gm.map);
      } else gm.meMarker.setLatLng(ll);
      if (first && center) gm.map.setView(ll, Math.max(gm.map.getZoom(), 15));
    }
    if (first || state.sort === "near") render(); else renderNext();
    first = false;
  }, (err) => {
    watchId = null;
    toast(err.code === 1 ? "Location permission was denied." : "Couldn't get your location.");
  }, { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 });
}

// ------------------------------------------------------------------ address lookup (OpenStreetMap Nominatim — free, no key)
const NOMINATIM = "https://nominatim.openstreetmap.org";
function withSuffix(addr) {
  const suf = (cfg.addressSuffix || "").trim();
  if (!suf || addr.includes(",")) return addr;
  return `${addr}, ${suf}`;
}
async function geocode(address) {
  try {
    const q = new URLSearchParams({ format: "jsonv2", limit: "1", q: withSuffix(address) });
    if (cfg.countryCodes) q.set("countrycodes", cfg.countryCodes);
    if (gm.map) { const b = gm.map.getBounds(); q.set("viewbox", `${b.getWest()},${b.getNorth()},${b.getEast()},${b.getSouth()}`); }
    const r = await fetch(`${NOMINATIM}/search?${q}`, { headers: { "Accept-Language": navigator.language || "en" } });
    const j = await r.json();
    if (!j?.length) return null;
    return { lat: parseFloat(j[0].lat), lng: parseFloat(j[0].lon), formatted: j[0].display_name };
  } catch (e) { console.warn("geocode failed", address, e); return null; }
}
async function reverseGeocode(ll) {
  try {
    const r = await fetch(`${NOMINATIM}/reverse?format=jsonv2&lat=${ll.lat}&lon=${ll.lng}&zoom=18&addressdetails=1`);
    const j = await r.json(); const a = j.address || {};
    const street = [a.house_number, a.road].filter(Boolean).join(" ");
    const town = a.city || a.town || a.village || a.suburb || "";
    return [street, town].filter(Boolean).join(", ") || j.display_name || null;
  } catch { return null; }
}

// ------------------------------------------------------------------ admin
function openAdmin() { $("#admin").classList.remove("hidden"); renderAdminLists(); }
function closeAdmin() { $("#admin").classList.add("hidden"); }

function nextNum() { return state.signs.reduce((m, s) => Math.max(m, s.num || 0), 0) + 1; }

// ------------------------------------------------------------------ new / edit sign sheet (everyone)
const DEFAULT_HAZARDS = [
  "Heavy or fast traffic", "No shoulder / narrow road", "Blind corner or hill", "Ice / slippery footing",
  "Deep snow or snowbank", "Snowplow route", "Ditch or steep drop", "Overhead power lines",
  "Poor lighting at night", "Uneven ground", "Construction nearby", "Dogs or wildlife",
];
const hazardOptions = () => (Array.isArray(cfg.hazardOptions) && cfg.hazardOptions.length ? cfg.hazardOptions : DEFAULT_HAZARDS);
function canEdit(s) { return isAdmin() || (s?.createdByUid && s.createdByUid === state.me?.uid); }

const sheet = { id: null, loc: null, autoAddr: false };

function openSignSheet(s = null) {
  sheet.id = s?.id || null;
  sheet.loc = s && hasLoc(s) ? { lat: s.lat, lng: s.lng } : null;
  sheet.autoAddr = false;
  $("#ssTitle").textContent = s ? `Edit sign #${s.num}` : "New sign location";
  $("#ssAddress").value = s?.address || "";
  $("#ssDesc").value = s?.notes || "";
  $("#ssAssignee").value = s ? (s.assignee || "") : state.me.name;
  $("#ssPickup").value = s?.pickupAssignee || "";
  $("#ssPickupWrap").classList.toggle("hidden", !isAdmin());
  const opts = hazardOptions(), have = s?.hazards || [];
  $("#ssHazards").innerHTML = opts.map((h) =>
    `<label class="haz"><input type="checkbox" value="${esc(h)}" ${have.includes(h) ? "checked" : ""}> <span>${esc(h)}</span></label>`).join("");
  $("#ssHazOther").value = have.filter((h) => !opts.includes(h)).join(", ");
  $("#ssPlaced").checked = false;
  $("#ssPlacedWrap").classList.toggle("hidden", !!s);
  $("#ssDelete").classList.toggle("hidden", !(s && canEdit(s)));
  $("#ssMsg").textContent = "";
  updateLocStatus();
  closeAdmin();
  $("#signSheet").classList.remove("hidden");
  $("#signSheet .drawer-inner").scrollTop = 0;
}
function closeSignSheet() { $("#signSheet").classList.add("hidden"); clearDraft(); }
function hideSheetTemporarily() { $("#signSheet").classList.add("hidden"); }
function showSheetAgain() { $("#signSheet").classList.remove("hidden"); }

function updateLocStatus() {
  const el = $("#ssLoc");
  if (sheet.loc) { el.innerHTML = `<b>📍 Pin set</b> · ${sheet.loc.lat.toFixed(5)}, ${sheet.loc.lng.toFixed(5)}`; el.classList.add("set"); $("#ssDrop").textContent = "Move pin"; }
  else { el.textContent = "No pin yet. Drop one on the map, use your location, or type an address and tap Find."; el.classList.remove("set"); $("#ssDrop").textContent = "Drop pin on map"; }
  showDraft();
}
function showDraft() {
  if (!gm.map) return;
  clearDraft();
  if (!sheet.loc) return;
  gm.draft = L.marker([sheet.loc.lat, sheet.loc.lng], {
    icon: L.divIcon({ className: "", html: '<div class="pin draft"><span>+</span></div>', iconSize: [30, 40], iconAnchor: [15, 40] }),
    zIndexOffset: 900, interactive: false,
  }).addTo(gm.map);
}
function clearDraft() { if (gm.draft) { gm.draft.remove(); gm.draft = null; } }

async function setSheetLoc(ll, { fillAddress = true } = {}) {
  sheet.loc = { lat: ll.lat, lng: ll.lng };
  updateLocStatus();
  if (fillAddress && (!$("#ssAddress").value.trim() || sheet.autoAddr)) {
    $("#ssAddress").placeholder = "Looking up address…";
    const addr = await reverseGeocode(sheet.loc);
    $("#ssAddress").placeholder = "Street address or nearest intersection";
    if (addr) { $("#ssAddress").value = addr; sheet.autoAddr = true; }
  }
}

// Pin-drop mode: hide the sheet, tap the map, come back
function startPick(onPick, onCancel) {
  if (!gm.map) { toast("The map isn't available."); return false; }
  gm.picking = true; gm.onPick = onPick; gm.onPickCancel = onCancel;
  setView("map"); select(null);
  $("#pickBanner").classList.remove("hidden");
  return true;
}
function finishPick(latlng) {
  gm.picking = false; $("#pickBanner").classList.add("hidden");
  const cb = gm.onPick; gm.onPick = gm.onPickCancel = null;
  if (cb) cb(latlng);
}
$("#pickCancel").onclick = () => {
  gm.picking = false; $("#pickBanner").classList.add("hidden");
  const cb = gm.onPickCancel; gm.onPick = gm.onPickCancel = null;
  if (cb) cb();
};

$$(".new-sign").forEach((b) => b.onclick = () => openSignSheet(null));
$("#adminNewBtn").onclick = () => openSignSheet(null);
$("#ssClose").onclick = closeSignSheet;
$("#signSheet").onclick = (e) => { if (e.target.id === "signSheet") closeSignSheet(); };
$("#ssAddress").oninput = () => { sheet.autoAddr = false; };

$("#ssDrop").onclick = () => {
  hideSheetTemporarily();
  const ok = startPick(async (ll) => { showSheetAgain(); await setSheetLoc(ll); }, () => showSheetAgain());
  if (!ok) showSheetAgain();
  else if (sheet.loc) gm.map.setView([sheet.loc.lat, sheet.loc.lng], Math.max(gm.map.getZoom(), 16));
};

$("#ssHere").onclick = () => {
  if (!("geolocation" in navigator)) { toast("Location isn't available on this device."); return; }
  const btn = $("#ssHere"); btn.disabled = true; btn.textContent = "Finding you…";
  navigator.geolocation.getCurrentPosition(async (p) => {
    btn.disabled = false; btn.textContent = "Use my location";
    await setSheetLoc({ lat: p.coords.latitude, lng: p.coords.longitude });
    if (gm.map) gm.map.setView([sheet.loc.lat, sheet.loc.lng], 17);
  }, (err) => {
    btn.disabled = false; btn.textContent = "Use my location";
    toast(err.code === 1 ? "Location permission was denied." : "Couldn't get your location.");
  }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 });
};

$("#ssFind").onclick = async () => {
  const a = $("#ssAddress").value.trim(); if (!a) return;
  $("#ssFind").disabled = true; $("#ssMsg").textContent = "Looking up address…";
  const g = await geocode(a);
  $("#ssFind").disabled = false;
  if (g) { await setSheetLoc(g, { fillAddress: false }); $("#ssMsg").textContent = "Found. Check the pin, and use Move pin if it's a little off."; if (gm.map) gm.map.setView([g.lat, g.lng], 17); }
  else $("#ssMsg").textContent = "Couldn't find that address. Try adding the street type or city, or drop a pin instead.";
};

function collectHazards() {
  const checked = $$("#ssHazards input:checked").map((i) => i.value);
  const other = $("#ssHazOther").value.split(",").map((x) => x.trim()).filter(Boolean);
  return [...new Set([...checked, ...other])];
}

$("#ssForm").onsubmit = async (e) => {
  e.preventDefault();
  const address = $("#ssAddress").value.trim();
  if (!address) return;
  const btn = $("#ssSave"); btn.disabled = true; $("#ssMsg").textContent = "Saving…";
  if (!sheet.loc) { const g = await geocode(address); if (g) sheet.loc = { lat: g.lat, lng: g.lng }; }
  const data = {
    address, notes: $("#ssDesc").value.trim(), hazards: collectHazards(),
    assignee: $("#ssAssignee").value.trim(),
    ...(isAdmin() ? { pickupAssignee: $("#ssPickup").value.trim() } : {}),
    lat: sheet.loc?.lat ?? null, lng: sheet.loc?.lng ?? null,
  };
  try {
    if (sheet.id) {
      state.store.updateSign(sheet.id, { ...data, updatedAt: "NOW", updatedBy: state.me.name }).catch(saveErr);
      toast("Sign updated");
    } else {
      const sign = { ...data, num: nextNum(), status: "pending", createdBy: state.me.name, createdByUid: state.me.uid };
      if ($("#ssPlaced").checked) Object.assign(sign, { status: "placed", placedBy: state.me.name, placedAt: "NOW" });
      state.store.addSigns([sign]).catch(saveErr);
      toast(sheet.loc ? `Sign #${sign.num} added` : `Sign #${sign.num} added, but it isn't on the map yet. Edit it to drop a pin.`, 4000);
    }
    const loc = sheet.loc;
    closeSignSheet();
    setView("map");
    if (loc && gm.map) gm.map.setView([loc.lat, loc.lng], Math.max(gm.map.getZoom(), 16));
  } catch (err) { saveErr(err); }
  btn.disabled = false;
};
function saveErr(err) {
  console.error(err);
  toast("Couldn't save — " + (err?.code === "permission-denied" ? "no permission." : (err?.message || "please try again.")), 5000);
}

$("#ssDelete").onclick = async () => {
  const s = state.signs.find((x) => x.id === sheet.id);
  if (!s || !confirm(`Delete sign #${s.num} at ${s.address}?`)) return;
  await state.store.deleteSigns([s.id]); if (state.selectedId === s.id) select(null);
  closeSignSheet(); toast("Sign deleted");
};

function parseBulk(text) {
  const rows = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim(); if (!line) continue;
    const parts = (line.includes("|") ? line.split("|") : line.includes("\t") ? line.split("\t") : [line]).map((x) => x.trim());
    if (/^address$/i.test(parts[0])) continue; // header row
    rows.push({ address: parts[0], assignee: parts[1] || "", notes: parts.slice(2).join(" ").trim() });
  }
  return rows.filter((r) => r.address);
}

$("#bulkBtn").onclick = async () => {
  const rows = parseBulk($("#bulkText").value);
  if (!rows.length) { $("#bulkMsg").textContent = "Nothing to add."; return; }
  const btn = $("#bulkBtn"); btn.disabled = true;
  let n = nextNum(); const out = []; const missed = [];
  for (let i = 0; i < rows.length; i++) {
    $("#bulkMsg").textContent = `Locating ${i + 1} of ${rows.length}…`;
    const g = await geocode(rows[i].address);
    if (!g) missed.push(rows[i].address);
    out.push({ ...rows[i], lat: g?.lat ?? null, lng: g?.lng ?? null, num: n++, status: "pending" });
    await new Promise((r) => setTimeout(r, 1100)); // free lookup service allows 1 request per second
  }
  try {
    await state.store.addSigns(out);
    $("#bulkText").value = "";
    $("#bulkMsg").textContent = `Added ${out.length} sign${out.length === 1 ? "" : "s"}.` + (missed.length ? ` ${missed.length} couldn't be found on the map — edit them to fix.` : "");
    fittedOnce = false;
  } catch (err) { $("#bulkMsg").textContent = "Couldn't save: " + (err.message || err); }
  btn.disabled = false;
};

function allVolunteerNames() {
  const names = new Map();
  const add = (n) => { n = String(n || "").trim(); if (n && !names.has(norm(n))) names.set(norm(n), n); };
  state.members.filter((m) => m.role !== "admin").forEach((m) => add(m.name));
  state.roster.forEach((r) => add(r.name));
  state.signs.forEach((s) => { splitNames(s.assignee).forEach(add); splitNames(s.pickupAssignee).forEach(add); });
  state.members.filter((m) => m.role === "admin").forEach((m) => add(m.name));
  return [...names.values()].sort((a, b) => a.localeCompare(b));
}

function renderAdminLists() {
  if (!isAdmin()) return;
  const names = allVolunteerNames();
  $("#memberNames").innerHTML = names.map((n) => `<option value="${esc(n)}">`).join("");
  const sd = stragglers("drop").length, sp = stragglers("pickup").length;
  $("#assignSummary").innerHTML = `
    <div class="straggler-sum"><span><b>${sd}</b> drop-off straggler${sd === 1 ? "" : "s"}</span><span><b>${sp}</b> pickup straggler${sp === 1 ? "" : "s"}</span></div>`;

  const counts = (name) => {
    const k = norm(name);
    const drop = state.signs.filter((s) => assigneesOf(s, "drop").includes(k));
    const pick = state.signs.filter((s) => assigneesOf(s, "pickup").includes(k));
    return { drop: drop.length, placed: drop.filter((s) => s.status && s.status !== "pending").length,
             pick: pick.length, retrieved: pick.filter((s) => s.status === "retrieved").length };
  };
  const roster = [...state.roster].sort((a, b) => a.name.localeCompare(b.name));
  const coords = state.members.filter((m) => m.role === "admin").map((m) => m.name);
  const noCode = names.filter((n) => !roster.some((r) => norm(r.name) === norm(n)) && !coords.some((c) => norm(c) === norm(n)));
  const link = location.origin + location.pathname;
  const smsText = (r) => `Hi ${r.name.split(" ")[0]}, your Winter Extreme Sign Tracker code is ${r.code}. Open ${link} and enter it to see your signs.`;
  const row = (r) => {
    const c = counts(r.name), joined = state.members.some((m) => m.code === r.code || norm(m.name) === norm(r.name));
    const digits = String(r.phone || "").replace(/[^\d+]/g, "");
    const fullPhone = digits.replace(/\D/g, "").length >= 10;
    const msg = smsText(r);
    return `<div class="vrow">
      <div class="vmain">
        <div class="vtop"><span class="vdot" style="background:${volColor(r.name)}"></span><b>${esc(r.name)}</b>
          <span class="code-chip">${esc(r.code)}</span>${joined ? '<span class="joined">signed in</span>' : ""}</div>
        ${r.phone ? `<div class="muted small">${esc(r.phone)}</div>` : ""}
        ${fullPhone ? "" : `<div class="warn">Phone number looks incomplete. Remove (×) and add them again with the full number.</div>`}
        <div class="muted small">${c.drop || c.pick
          ? [c.drop ? `Drop-off ${c.placed}/${c.drop} placed` : "", c.pick ? `Pickup ${c.retrieved}/${c.pick} retrieved` : ""].filter(Boolean).join(" · ")
          : "No signs assigned yet"}</div>
      </div>
      <div class="vacts">
        ${fullPhone ? `<a class="btn small light vol-text" href="sms:${digits}?&body=${encodeURIComponent(msg)}" data-msg="${esc(msg)}" title="Text them their code">Text code</a>
        <a class="btn small light" href="tel:${digits}" title="Call">Call</a>` : ""}
        <button class="btn small light vol-copy" data-msg="${esc(msg)}" type="button" title="Copy the code message to paste anywhere">Copy</button>
        <button class="btn small danger vol-remove" data-code="${esc(r.code)}" data-name="${esc(r.name)}" type="button" title="Remove">×</button>
      </div>
    </div>`;
  };
  $("#volTable").innerHTML = `
    ${roster.length ? roster.map(row).join("") : `<p class="muted small">No volunteers yet. Add them above.</p>`}
    ${noCode.length ? `<div class="nocode"><b>Named on signs but no access code yet:</b> ${noCode.map((n) =>
      `<button class="btn link vol-fill" data-name="${esc(n)}" type="button">${esc(n)}</button>`).join(", ")}<br><span class="muted small">Tap a name, add their phone number, then Add.</span></div>` : ""}
    ${coords.length ? `<p class="muted small" style="margin-top:10px">Coordinators signed in: ${coords.map(esc).join(", ")}</p>` : ""}`;
}

$("#volForm").onsubmit = async (e) => {
  e.preventDefault();
  const name = $("#volName").value.trim(), phone = $("#volPhone").value.trim();
  if (!name || !phone) return;
  if (phone.replace(/\D/g, "").length < 10) {
    $("#volMsg").innerHTML = `<span class="error">Enter the full phone number including area code, e.g. 604-555-0142.</span>`;
    $("#volPhone").focus(); return;
  }
  const btn = $("#volForm button"); btn.disabled = true; $("#volMsg").textContent = "";
  try {
    const code = await state.store.addVolunteer(name, phone);
    $("#volMsg").innerHTML = `<b>${esc(name)}</b> added. Their code is <span class="code-chip big">${esc(code)}</span>`;
    $("#volName").value = ""; $("#volPhone").value = "";
  } catch (err) { $("#volMsg").innerHTML = `<span class="error">${esc(err.message || err)}</span>`; }
  btn.disabled = false;
};
$("#volPhone").oninput = () => {
  const c = codeFromPhone($("#volPhone").value);
  $("#volMsg").innerHTML = c ? `Code will be <span class="code-chip">${esc(c)}</span>` : "";
};
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch {}
    ta.remove(); return ok;
  }
}
$("#volTable").onclick = async (e) => {
  const cp = e.target.closest(".vol-copy");
  if (cp) {
    if (await copyText(cp.dataset.msg)) toast("Message copied. Paste it into a text or email.", 3500);
    else prompt("Copy this message:", cp.dataset.msg);
    return;
  }
  const tx = e.target.closest(".vol-text");
  if (tx) {
    // Also copy, in case this device can't open a texting app from a link
    if (await copyText(tx.dataset.msg)) toast("Opening Messages. The text is also copied, in case it doesn't open.", 4500);
    return;
  }
  const rm = e.target.closest(".vol-remove");
  if (rm) {
    if (!confirm(`Remove ${rm.dataset.name} (${rm.dataset.code}) from the volunteer list? Their code will stop working for new sign-ins. Their sign assignments stay.`)) return;
    try { await state.store.removeVolunteer(rm.dataset.code); toast("Volunteer removed"); } catch (err) { saveErr(err); }
    return;
  }
  const f = e.target.closest(".vol-fill");
  if (f) { $("#volName").value = f.dataset.name; $("#volPhone").focus(); }
};

$("#exportBtn").onclick = () => {
  const cols = ["num", "address", "assignee", "pickupAssignee", "notes", "hazards", "createdBy", "status", "placedBy", "placedAt", "retrievedBy", "retrievedAt", "lat", "lng"];
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [cols.join(",")].concat(
    state.signs.slice().sort((a, b) => (a.num || 0) - (b.num || 0)).map((s) =>
      cols.map((c) => q(c.endsWith("At") ? fmtTime(s[c]) : c === "status" ? STATUS_LABEL[s.status] : c === "hazards" ? (s.hazards || []).join("; ") : s[c])).join(",")));
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = `signs-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};

$("#resetBtn").onclick = async () => {
  if (!state.signs.length || !confirm(`Set all ${state.signs.length} signs back to "To place"? This clears placed/retrieved history and pickup volunteers. Drop-off volunteers stay.`)) return;
  await state.store.batchUpdate(state.signs.map((s) => s.id), () => RESET_TO_PLACE);
  toast("All signs reset");
};

$("#wipeBtn").onclick = async () => {
  if (!state.signs.length) return;
  const typed = prompt(`This permanently deletes all ${state.signs.length} signs.\nType DELETE to confirm.`);
  if (typed !== "DELETE") return;
  await state.store.deleteSigns(state.signs.map((s) => s.id));
  select(null); toast("All signs deleted");
};

// ------------------------------------------------------------------ emergency contacts page
function telHref(p) { return "tel:" + String(p || "").replace(/[^\d+]/g, ""); }
function smsHref(p) { return "sms:" + String(p || "").replace(/[^\d+]/g, ""); }

function updatedLine(d) {
  return d?.updatedAt ? `<div class="updated">Last updated ${esc(fmtTime(d.updatedAt))}${d.updatedBy ? " by " + esc(d.updatedBy) : ""}</div>` : "";
}

function renderContacts() {
  const box = $("#contactsInner"); if (!box || state.editing.contacts) return;
  const items = state.info.contacts?.items || [];
  box.innerHTML = `
    <h2>Emergency contacts</h2>
    ${items.length ? items.map((c) => `
      <div class="card contact">
        <div class="who">
          <div class="name">${esc(c.name)}</div>
          ${c.role ? `<div class="c-roletext">${esc(c.role)}</div>` : ""}
          <div class="phone">${esc(c.phone)}</div>
        </div>
        <div class="acts">
          ${c.phone ? `<a class="btn call" href="${telHref(c.phone)}">Call</a><a class="btn light" href="${smsHref(c.phone)}">Text</a>` : ""}
        </div>
      </div>`).join("")
      : `<div class="card muted">${isAdmin() ? "No contacts yet. Tap <b>Edit contacts</b> to add your coordinator, patrol dispatch and others." : "Your coordinator hasn't added contacts yet."}</div>`}
    ${updatedLine(state.info.contacts)}
    ${isAdmin() ? `<div><button class="btn primary" id="editContactsBtn" type="button">Edit contacts</button></div>` : ""}
    <p class="offline-note">Once opened, this page stays available on your phone even without signal.</p>`;
  const eb = $("#editContactsBtn"); if (eb) eb.onclick = editContacts;
}

function contactRow(c = {}) {
  return `<div class="edit-row">
    <button class="rm" type="button" title="Remove" aria-label="Remove contact">×</button>
    <input class="c-name" placeholder="Name" value="${esc(c.name)}">
    <input class="c-phone" placeholder="Phone" inputmode="tel" value="${esc(c.phone)}">
    <input class="c-role full" placeholder="Role, e.g. Patrol dispatch / Coordinator" value="${esc(c.role)}">
  </div>`;
}

function editContacts() {
  state.editing.contacts = true;
  const items = state.info.contacts?.items || [];
  $("#contactsInner").innerHTML = `
    <h2>Edit emergency contacts</h2>
    <p class="sub">Everyone sees these on the Emergency page, with buttons to call or text. Put the most important first.</p>
    <div id="cRows" style="display:flex;flex-direction:column;gap:14px;margin-top:6px">${(items.length ? items : [{}]).map(contactRow).join("")}</div>
    <div><button class="btn light" id="cAdd" type="button">+ Add contact</button></div>
    <div class="row"><button class="btn primary" id="cSave" type="button">Save</button><button class="btn ghost" id="cCancel" type="button">Cancel</button></div>`;
  const rows = $("#cRows");
  rows.onclick = (e) => { if (e.target.classList.contains("rm")) e.target.closest(".edit-row").remove(); };
  $("#cAdd").onclick = () => { rows.insertAdjacentHTML("beforeend", contactRow()); rows.lastElementChild.querySelector("input").focus(); };
  $("#cCancel").onclick = () => { state.editing.contacts = false; renderContacts(); };
  $("#cSave").onclick = async () => {
    const list = $$(".edit-row", rows).map((r) => ({
      name: $(".c-name", r).value.trim(), phone: $(".c-phone", r).value.trim(), role: $(".c-role", r).value.trim(),
    })).filter((c) => c.name || c.phone);
    $("#cSave").disabled = true;
    try { await state.store.saveInfo("contacts", { items: list }); toast("Contacts saved"); state.editing.contacts = false; renderContacts(); }
    catch (err) { console.error(err); toast("Couldn't save — " + (err.message || err), 4000); $("#cSave").disabled = false; }
  };
}

// ------------------------------------------------------------------ safety notes page
const SAFETY_TEMPLATE = `# Before you head out
- Wear your high-visibility vest or patrol jacket.
- Work in pairs where possible.
- Tell someone your route and when you expect to be back.
- Charge your phone; bring your radio if you have one.
- Check the weather and road conditions.

# At each sign
- Park fully off the road with hazard lights on.
- Watch for traffic and snowplows. Walk facing oncoming traffic.
- Don't block sight lines at corners, driveways or crosswalks.
- Watch your footing on ice and snowbanks.
- Never place a sign on private property without permission.

# If something goes wrong
! In an emergency, call 911 first, then your coordinator (see the Emergency tab).
- If a sign is missing or damaged, let your coordinator know.`;

function richText(text) {
  const out = []; let list = null;
  const close = () => { if (list) { out.push(`<ul>${list.join("")}</ul>`); list = null; } };
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { close(); continue; }
    let m;
    if ((m = line.match(/^#+\s*(.*)$/))) { close(); out.push(`<h3>${esc(m[1])}</h3>`); }
    else if ((m = line.match(/^[-*•]\s+(.*)$/))) { (list = list || []).push(`<li>${esc(m[1])}</li>`); }
    else if ((m = line.match(/^!\s*(.*)$/))) { close(); out.push(`<div class="callout">${esc(m[1])}</div>`); }
    else { close(); out.push(`<p>${esc(line)}</p>`); }
  }
  close();
  return out.join("");
}

function renderSafety() {
  const box = $("#safetyInner"); if (!box || state.editing.safety) return;
  const d = state.info.safety;
  box.innerHTML = `
    <h2>Staying safe</h2>
    ${updatedLine(d)}
    <div class="card rich">${d?.text ? richText(d.text)
      : `<p class="muted">${isAdmin() ? "No safety notes yet. Tap <b>Edit safety notes</b> to write them, or start from a template." : "Your coordinator hasn't added safety notes yet."}</p>`}</div>
    ${isAdmin() ? `<div><button class="btn primary" id="editSafetyBtn" type="button">Edit safety notes</button></div>` : ""}`;
  const eb = $("#editSafetyBtn"); if (eb) eb.onclick = editSafety;
}

function editSafety() {
  state.editing.safety = true;
  $("#safetyInner").innerHTML = `
    <h2>Edit safety notes</h2>
    <p class="sub">Simple formatting: start a line with <code>#</code> for a heading, <code>-</code> for a bullet, or <code>!</code> for a red warning box.</p>
    <textarea id="sText" placeholder="# Before you head out&#10;- Wear your high-visibility vest">${esc(state.info.safety?.text || "")}</textarea>
    <div class="row wrap">
      <button class="btn primary" id="sSave" type="button">Save</button>
      <button class="btn ghost" id="sCancel" type="button">Cancel</button>
      <button class="btn light" id="sTemplate" type="button">Insert starter template</button>
    </div>`;
  $("#sTemplate").onclick = () => {
    const ta = $("#sText");
    if (ta.value.trim() && !confirm("Replace what's written with the starter template?")) return;
    ta.value = SAFETY_TEMPLATE;
  };
  $("#sCancel").onclick = () => { state.editing.safety = false; renderSafety(); };
  $("#sSave").onclick = async () => {
    $("#sSave").disabled = true;
    try { await state.store.saveInfo("safety", { text: $("#sText").value.trim() }); toast("Safety notes saved"); state.editing.safety = false; markSafetySeen(); renderSafety(); }
    catch (err) { console.error(err); toast("Couldn't save — " + (err.message || err), 4000); $("#sSave").disabled = false; }
  };
}

// Red dot on the Safety tab when notes change after you last read them
function updateSafetyDot() {
  const t = state.info.safety?.updatedAt || 0;
  const seen = Number(localStorage.getItem("st.safetySeen") || 0);
  const onPage = !$("#safetyPage").classList.contains("hidden");
  if (onPage) { markSafetySeen(); return; }
  $("#safetyDot").classList.toggle("hidden", !(state.info.safety?.text && t > seen));
}
function markSafetySeen() {
  const t = state.info.safety?.updatedAt; if (t) localStorage.setItem("st.safetySeen", String(t));
  $("#safetyDot").classList.add("hidden");
}

// ------------------------------------------------------------------ next sign + directions
// The next sign for this volunteer: nearest "to place" sign, or once all are placed, nearest "to pick up".
function nextSign() {
  let mode = "place", pool = state.signs.filter((s) => mineFor(s, "drop") && (s.status || "pending") === "pending");
  if (!pool.length) { mode = "pickup"; pool = state.signs.filter((s) => mineFor(s, "pickup") && s.status === "placed"); }
  if (!pool.length) return null;
  let cands = pool.filter((s) => !state.skipped.has(s.id));
  if (!cands.length) { state.skipped.clear(); cands = pool; }
  const d = (s) => (state.userPos && hasLoc(s) ? distM(state.userPos, s) : Infinity);
  cands.sort((a, b) => d(a) - d(b) || (a.num || 0) - (b.num || 0));
  return { sign: cands[0], mode, left: pool.length };
}

function renderNext() {
  const n = state.nextHidden ? null : nextSign();
  let html = "";
  if (n) {
    const s = n.sign;
    const dist = state.userPos && hasLoc(s) ? `${fmtDist(distM(state.userPos, s))} away` : "";
    const pref = NAV_APPS.find((a) => a.id === getNavPref());
    html = `
      <div class="next-card ${n.mode}">
        <div class="next-top">
          <span class="next-label">${n.mode === "place" ? "Next sign to place" : "Next sign to pick up"}</span>
          <span class="next-left">${n.left} left</span>
          <button class="next-x" data-act="hide-next" data-id="${s.id}" aria-label="Hide">×</button>
        </div>
        <div class="next-addr" data-act="show" data-id="${s.id}"><span class="num ${s.status}">${esc(s.num ?? "")}</span><span>${esc(s.address)}</span></div>
        <div class="next-meta">${[dist, s.hazards?.length ? `<span class="next-hz">⚠ ${s.hazards.length} hazard${s.hazards.length > 1 ? "s" : ""}</span>` : ""].filter(Boolean).join(" · ")}</div>
        <div class="next-actions">
          <button class="btn primary next-go" data-act="nav" data-id="${s.id}">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M21.7 11.3 12.7 2.3a1 1 0 0 0-1.4 0l-9 9a1 1 0 0 0 0 1.4l9 9a1 1 0 0 0 1.4 0l9-9a1 1 0 0 0 0-1.4zM14 14.5V12h-4v3H8v-4a1 1 0 0 1 1-1h5V7.5l3.5 3.5-3.5 3.5z"/></svg>
            Navigate</button>
          <button class="btn light" data-act="show" data-id="${s.id}">Details</button>
          ${n.left > 1 ? `<button class="btn link" data-act="skip" data-id="${s.id}">Skip</button>` : ""}
        </div>
        ${pref ? `<div class="next-change">Opens in ${esc(pref.name)} · <button class="btn link" data-act="nav-change" data-id="${s.id}">Change</button></div>` : ""}
      </div>`;
  }
  $("#nextMap").innerHTML = html;
  $("#nextList").innerHTML = html;
  $("#app").classList.toggle("has-next", !!html);
}

// Maps apps. Coordinates are used when the sign has a pin (most accurate); otherwise the address.
const UA = navigator.userAgent || "";
const IS_IOS = /iPad|iPhone|iPod/.test(UA) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const IS_ANDROID = /Android/i.test(UA);
const ll = (s) => `${(+s.lat).toFixed(6)},${(+s.lng).toFixed(6)}`;
const NAV_APPS = [
  { id: "default", name: "Phone's default map app", short: "Default", show: () => IS_ANDROID,
    url: (s) => hasLoc(s) ? `geo:${ll(s)}?q=${ll(s)}(${encodeURIComponent(s.address)})` : `geo:0,0?q=${encodeURIComponent(s.address)}` },
  { id: "apple", name: "Apple Maps", short: "Apple Maps", show: () => !IS_ANDROID,
    url: (s) => hasLoc(s) ? `https://maps.apple.com/?daddr=${ll(s)}&dirflg=d&q=${encodeURIComponent(s.address)}` : `https://maps.apple.com/?daddr=${encodeURIComponent(s.address)}&dirflg=d` },
  { id: "google", name: "Google Maps", short: "Google Maps", show: () => true,
    url: (s) => `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(hasLoc(s) ? `${ll(s)}` : s.address)}` },
  { id: "waze", name: "Waze", short: "Waze", show: () => true,
    url: (s) => hasLoc(s) ? `https://waze.com/ul?ll=${ll(s)}&navigate=yes` : `https://waze.com/ul?q=${encodeURIComponent(s.address)}&navigate=yes` },
];
const getNavPref = () => { try { return localStorage.getItem("st.navApp") || ""; } catch { return ""; } };
const setNavPref = (id) => { try { id ? localStorage.setItem("st.navApp", id) : localStorage.removeItem("st.navApp"); } catch {} };

function launchNav(app, s) {
  const url = app.url(s);
  if (url.startsWith("http")) window.open(url, "_blank", "noopener");
  else window.location.href = url;
}

let navSign = null;
function openNav(s, forceChooser = false) {
  const pref = NAV_APPS.find((a) => a.id === getNavPref() && a.show());
  if (pref && !forceChooser) { launchNav(pref, s); return; }
  navSign = s;
  $("#navAddr").innerHTML = `<span class="num ${s.status}">${esc(s.num ?? "")}</span> ${esc(s.address)}`;
  $("#navOpts").innerHTML = NAV_APPS.filter((a) => a.show()).map((a) =>
    `<button class="btn nav-opt ${a.id === getNavPref() ? "current" : ""}" data-app="${a.id}" type="button">${esc(a.name)}</button>`).join("");
  $("#navRemember").checked = !!getNavPref();
  $("#navSheet").classList.remove("hidden");
}
$("#navOpts").onclick = (e) => {
  const b = e.target.closest("[data-app]"); if (!b || !navSign) return;
  const app = NAV_APPS.find((a) => a.id === b.dataset.app);
  setNavPref($("#navRemember").checked ? app.id : "");
  $("#navSheet").classList.add("hidden");
  renderNext();
  launchNav(app, navSign);
};
$("#navCancel").onclick = () => $("#navSheet").classList.add("hidden");
$("#navSheet").onclick = (e) => { if (e.target.id === "navSheet") $("#navSheet").classList.add("hidden"); };
$("#navCopy").onclick = async () => {
  if (!navSign) return;
  try { await navigator.clipboard.writeText(navSign.address); toast("Address copied"); }
  catch { prompt("Copy this address:", navSign.address); }
};

// ------------------------------------------------------------------ celebration
const CONFETTI_COLORS = ["#c8102e", "#ffffff", "#e5383b", "#f59f00", "#37b24d", "#4c8df6", "#ffffff"];
let confettiRAF = null;

function celebrate(sub) {
  $("#celebrateSub").textContent = sub;
  $("#toast").classList.add("hidden");
  $("#celebrate").classList.remove("hidden");
  try { navigator.vibrate?.([90, 50, 90]); } catch {}
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) runConfetti();
  $("#celebrateClose").focus();
}
function closeCelebrate() {
  $("#celebrate").classList.add("hidden");
  cancelAnimationFrame(confettiRAF); confettiRAF = null;
}
$("#celebrateClose").onclick = closeCelebrate;

function runConfetti() {
  const cv = $("#confetti"), dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = cv.width = innerWidth * dpr, H = cv.height = innerHeight * dpr;
  const ctx = cv.getContext("2d");
  const rnd = (a, b) => a + Math.random() * (b - a);
  const parts = [];
  // Two bursts from the lower corners plus a shower from the top
  const burst = (x, dir, n) => { for (let i = 0; i < n; i++) parts.push({
    x, y: H * 0.95, vx: dir * rnd(4, 15) * dpr, vy: -rnd(16, 30) * dpr,
    w: rnd(6, 11) * dpr, h: rnd(10, 18) * dpr, r: rnd(0, 6.3), vr: rnd(-0.3, 0.3),
    c: CONFETTI_COLORS[i % CONFETTI_COLORS.length], shape: Math.random() < 0.25 ? "dot" : "rect", wob: rnd(0, 6.3) }); };
  burst(0, 1, 110); burst(W, -1, 110);
  for (let i = 0; i < 90; i++) parts.push({ x: rnd(0, W), y: rnd(-H, 0), vx: rnd(-1, 1) * dpr, vy: rnd(2, 5) * dpr,
    w: rnd(6, 11) * dpr, h: rnd(10, 18) * dpr, r: rnd(0, 6.3), vr: rnd(-0.2, 0.2),
    c: CONFETTI_COLORS[i % CONFETTI_COLORS.length], shape: "rect", wob: rnd(0, 6.3) });
  const start = performance.now();
  cancelAnimationFrame(confettiRAF);
  const tick = (t) => {
    const age = (t - start) / 1000;
    ctx.clearRect(0, 0, W, H);
    let alive = 0;
    for (const p of parts) {
      p.vy += 0.45 * dpr; p.vx *= 0.985; p.vy = Math.min(p.vy, 7 * dpr);
      p.wob += 0.12; p.x += p.vx + Math.sin(p.wob) * 1.2 * dpr; p.y += p.vy; p.r += p.vr;
      if (p.y > H + 40) continue;
      alive++;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.globalAlpha = age > 5 ? Math.max(0, 1 - (age - 5)) : 1;
      ctx.fillStyle = p.c;
      if (p.shape === "dot") { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, 6.3); ctx.fill(); }
      else ctx.fillRect(-p.w / 2, -p.h / 2 * Math.abs(Math.cos(p.wob)), p.w, p.h * Math.abs(Math.cos(p.wob)) + 1);
      ctx.restore();
    }
    if (alive && age < 6) confettiRAF = requestAnimationFrame(tick);
    else { ctx.clearRect(0, 0, W, H); confettiRAF = null; }
  };
  confettiRAF = requestAnimationFrame(tick);
}

// ------------------------------------------------------------------ coordinator: assign mode
// Distinct colours handed out in name order, so neighbours in the list never look alike
const VOL_COLORS = ["#1c64d1", "#e8590c", "#0ca678", "#7048e8", "#d6336c", "#1098ad", "#74b816", "#f59f00", "#862e9c", "#495057", "#0b7285", "#a61e4d"];
function volColor(name) {
  const i = allVolunteerNames().findIndex((n) => norm(n) === norm(name));
  if (i >= 0) return VOL_COLORS[i % VOL_COLORS.length];
  let h = 0; for (const c of norm(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return VOL_COLORS[h % VOL_COLORS.length];
}

function enterAssign(job) {
  state.assign.on = true; state.assign.job = job || state.assign.job; state.assign.sel.clear();
  closeAdmin(); select(null);
  document.body.classList.add("assigning");
  $("#assignBar").classList.remove("hidden");
  $("#assignPanel").classList.remove("hidden");
  setView("map");
  render();
}
function exitAssign() {
  state.assign.on = false; state.assign.sel.clear();
  document.body.classList.remove("assigning");
  $("#assignBar").classList.add("hidden");
  $("#assignPanel").classList.add("hidden");
  render();
}
function toggleSel(id) {
  const s = state.signs.find((x) => x.id === id);
  if (!s) return;
  if (!assignable(s)) { toast(state.assign.job === "drop" ? `#${s.num} is in place now. Assign its pickup instead, or mark it retrieved first.` : `#${s.num} is already picked up`, 4000); return; }
  const sel = state.assign.sel; sel.has(id) ? sel.delete(id) : sel.add(id);
  renderMarkers(); renderAssign();
}
function setJob(job) { state.assign.job = job; state.assign.sel.clear(); render(); }

function renderAssign() {
  if (!isAdmin()) return;
  const a = state.assign;
  $("#assignBtn").classList.toggle("hidden", a.on);
  if (!a.on) return;
  const job = a.job, n = a.sel.size, strag = stragglers(job);
  $$(".job-seg button").forEach((b) => b.classList.toggle("active", b.dataset.job === job));
  $("#assignBar .ab-info").innerHTML = n
    ? `<b>${n}</b> sign${n === 1 ? "" : "s"} selected for <b>${JOB_LABEL[job].toLowerCase()}</b>`
    : `Tap pins to select them for <b>${JOB_LABEL[job].toLowerCase()}</b>. Dashed pins are unassigned.${job === "drop" ? " Retrieved signs can be picked to place again." : ""}`;
  $$(".sel-strag").forEach((b) => { b.textContent = `Select stragglers (${strag.length})`; b.disabled = !strag.length; });
  $$(".sel-clear").forEach((b) => b.classList.toggle("hidden", !n));
  $$(".do-assign").forEach((b) => { b.textContent = n ? `Assign ${n} to…` : "Assign to…"; b.disabled = !n; });

  // Side panel: Last Call Stragglers + volunteers
  const rowFor = (s) => `
    <label class="srow ${a.sel.has(s.id) ? "on" : ""}">
      <input type="checkbox" data-sel="${s.id}" ${a.sel.has(s.id) ? "checked" : ""}>
      <span class="num ${s.status || "pending"}">${esc(s.num ?? "")}</span>
      <span class="srow-addr">${esc(s.address)}${s.hazards?.length ? ` <span class="next-hz">⚠ ${s.hazards.length}</span>` : ""}</span>
      ${hasLoc(s) ? "" : '<span class="warn">no pin</span>'}
    </label>`;
  const vols = allVolunteerNames().map((name) => {
    const theirs = state.signs.filter((s) => assigneesOf(s, job).includes(norm(name)) && assignable(s));
    return { name, theirs };
  }).filter((v) => v.theirs.length);
  $("#assignPanel").innerHTML = `
    <div class="ap-head">
      <div class="seg job-seg">
        <button data-job="drop" class="${job === "drop" ? "active" : ""}" type="button">Drop-off</button>
        <button data-job="pickup" class="${job === "pickup" ? "active" : ""}" type="button">Pickup</button>
      </div>
      <button class="btn small light assign-done" type="button">Done</button>
    </div>
    <p class="muted small" style="margin:8px 2px 10px">Tap pins on the map or tick signs below, then <b>Assign</b>.</p>
    <div class="card strag-card">
      <div class="strag-head">
        <h3>Last Call Stragglers</h3><span class="count">${strag.length}</span>
        ${strag.length ? `<button class="btn link sel-strag-all" type="button">Select all</button>` : ""}
      </div>
      <p class="muted small" style="margin:2px 0 8px">${job === "drop" ? "Signs still to be placed with no drop-off volunteer." : "Signs not yet picked up with no pickup volunteer."}</p>
      ${strag.length ? `<div class="srows">${strag.sort((x, y) => (x.num || 0) - (y.num || 0)).map(rowFor).join("")}</div>`
        : `<div class="all-covered">Everyone's covered. No ${JOB_LABEL[job].toLowerCase()} stragglers.</div>`}
    </div>
    <div class="card">
      <h3 style="margin:0 0 8px">Assigned for ${JOB_LABEL[job].toLowerCase()}</h3>
      ${vols.length ? vols.map((v) => `
        <details class="vgroup">
          <summary><span class="vdot" style="background:${volColor(v.name)}"></span><span class="vname">${esc(v.name)}</span><span class="count">${v.theirs.length}</span>
            <button class="btn link sel-vol" data-name="${esc(v.name)}" type="button">Select</button></summary>
          <div class="srows">${v.theirs.sort((x, y) => (x.num || 0) - (y.num || 0)).map(rowFor).join("")}</div>
        </details>`).join("") : `<p class="muted small">Nobody yet.</p>`}
    </div>
    <div class="ap-sticky">
      <span class="ab-count">${n ? `<b>${n}</b> selected` : "None selected"}</span>
      <button class="btn link sel-clear ${n ? "" : "hidden"}" type="button">Clear</button>
      <button class="btn primary do-assign" type="button" ${n ? "" : "disabled"}>${n ? `Assign ${n} to…` : "Assign to…"}</button>
    </div>`;
}

// Event wiring (delegated so re-rendered panels keep working)
document.addEventListener("click", (e) => {
  const t = e.target;
  if (t.closest(".open-assign")) { enterAssign(t.closest(".open-assign").dataset.job); return; }
  if (t.closest("#assignBtn")) { enterAssign(state.signs.some((s) => (s.status || "pending") === "pending") ? "drop" : "pickup"); return; }
  if (!state.assign.on) return;
  const jb = t.closest(".job-seg [data-job]"); if (jb) { setJob(jb.dataset.job); return; }
  if (t.closest(".assign-done")) { exitAssign(); return; }
  if (t.closest(".sel-clear")) { state.assign.sel.clear(); renderMarkers(); renderAssign(); return; }
  if (t.closest(".sel-strag") || t.closest(".sel-strag-all")) {
    stragglers(state.assign.job).forEach((s) => state.assign.sel.add(s.id)); renderMarkers(); renderAssign(); return;
  }
  const sv = t.closest(".sel-vol");
  if (sv) {
    e.preventDefault();
    state.signs.filter((s) => assigneesOf(s, state.assign.job).includes(norm(sv.dataset.name)) && assignable(s)).forEach((s) => state.assign.sel.add(s.id));
    renderMarkers(); renderAssign(); return;
  }
  if (t.closest(".do-assign")) { openAssignPicker(); return; }
});
document.addEventListener("change", (e) => {
  const cb = e.target.closest("[data-sel]"); if (!cb || !state.assign.on) return;
  cb.checked ? state.assign.sel.add(cb.dataset.sel) : state.assign.sel.delete(cb.dataset.sel);
  renderMarkers(); renderAssign();
});

function openAssignPicker() {
  const a = state.assign, n = a.sel.size; if (!n) return;
  const job = a.job;
  $("#apJob").textContent = `${JOB_LABEL[job]} assignment`;
  $("#apTitle").textContent = `Assign ${n} sign${n === 1 ? "" : "s"} to…`;
  const names = allVolunteerNames();
  $("#apList").innerHTML = names.length ? names.map((name) => {
    const cnt = state.signs.filter((s) => assigneesOf(s, job).includes(norm(name)) && assignable(s, job)).length;
    const onRoster = state.roster.some((r) => norm(r.name) === norm(name));
    const isCoord = state.members.some((m) => m.role === "admin" && norm(m.name) === norm(name));
    return `<button class="btn nav-opt ap-name" data-name="${esc(name)}" type="button">
      <span class="vdot" style="background:${volColor(name)}"></span><span class="vname">${esc(name)}</span>
      <span class="muted small">${onRoster || isCoord ? "" : "no code · "}${cnt} ${JOB_LABEL[job].toLowerCase()}</span></button>`;
  }).join("") : `<p class="muted small">No volunteers yet. Type a name below.</p>`;
  $("#apNew").value = "";
  $("#assignPick").classList.remove("hidden");
}
function closeAssignPicker() { $("#assignPick").classList.add("hidden"); }
$("#apCancel").onclick = closeAssignPicker;
$("#assignPick").onclick = (e) => {
  if (e.target.id === "assignPick") { closeAssignPicker(); return; }
  const b = e.target.closest(".ap-name"); if (b) doAssign(b.dataset.name);
};
$("#apAdd").onclick = () => { const v = $("#apNew").value.trim(); if (v) doAssign(v, true); };
$("#apNew").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); $("#apAdd").click(); } };
$("#apUnassign").onclick = () => doAssign("");

function doAssign(name, isNew = false) {
  const a = state.assign, ids = [...a.sel], field = JOB_FIELD[a.job];
  if (!ids.length) return;
  if (name && isNew && !state.roster.some((r) => norm(r.name) === norm(name)))
    setTimeout(() => toast(`${name} has no access code yet. Add their phone in Manage → Volunteers.`, 5000), 3600);
  // Giving a retrieved sign a drop-off volunteer puts it back to "To place"
  const reused = a.job === "drop" && name ? ids.filter((id) => state.signs.find((s) => s.id === id)?.status === "retrieved") : [];
  state.store.batchUpdate(ids, (id) => ({ [field]: name, updatedAt: "NOW", updatedBy: state.me.name,
    ...(reused.includes(id) ? RESET_TO_PLACE : {}) })).catch(saveErr);
  closeAssignPicker();
  a.sel.clear();
  toast((name ? `${ids.length} sign${ids.length === 1 ? "" : "s"} assigned to ${name} for ${JOB_LABEL[a.job].toLowerCase()}`
              : `${ids.length} sign${ids.length === 1 ? "" : "s"} moved to Last Call Stragglers`)
        + (reused.length ? `. ${reused.length} retrieved sign${reused.length === 1 ? " is" : "s are"} back to "To place".` : ""), 4500);
  render();
}
