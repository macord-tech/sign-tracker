// Data layer. Two interchangeable back ends:
//   FirebaseStore — shared, real-time, used when config.js has Firebase settings
//   DemoStore     — this browser only (localStorage), for trying the app out
//
// Sign document shape:
//   { id, num, address, lat, lng, assignee, notes,
//     status: "pending" | "placed" | "retrieved",
//     placedBy, placedAt, retrievedBy, retrievedAt, updatedAt, updatedBy, createdAt }

const FB_VERSION = "10.14.1";
const FB = (m) => `https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-${m}.js`;

// Volunteer codes: last 4 digits of the phone number + suffix, e.g. 604-555-0142 -> "0142CSP"
export const CODE_SUFFIX = (window.APP_CONFIG?.codeSuffix || "CSP").toUpperCase();
export function normalizeCode(raw) { return String(raw || "").replace(/\s+/g, "").toUpperCase(); }
export function isVolunteerCode(raw) { return new RegExp(`^\\d{4}${CODE_SUFFIX}$`).test(normalizeCode(raw)); }
export function codeFromPhone(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  return d.length >= 4 ? d.slice(-4) + CODE_SUFFIX : null;
}

export async function createStore(cfg) {
  const fb = cfg.firebase || {};
  if (fb.apiKey && fb.projectId) {
    const s = new FirebaseStore(fb);
    await s.init();
    return s;
  }
  return new DemoStore();
}

// ---------------------------------------------------------------- Firebase
class FirebaseStore {
  constructor(fbConfig) { this.fbConfig = fbConfig; this.demo = false; this.me = null; }

  async init() {
    const [{ initializeApp }, auth, fs] = await Promise.all([
      import(FB("app")), import(FB("auth")), import(FB("firestore")),
    ]);
    this.A = auth; this.F = fs;
    const app = initializeApp(this.fbConfig);
    this.auth = auth.getAuth(app);
    try {
      // Keeps working with spotty cell signal: reads from cache, queues writes.
      this.db = fs.initializeFirestore(app, {
        localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
      });
    } catch (e) {
      this.db = fs.getFirestore(app);
    }
    await new Promise((resolve) => {
      const off = auth.onAuthStateChanged(this.auth, (u) => { if (u) { off(); resolve(); } });
      auth.signInAnonymously(this.auth).catch((e) => { console.error(e); resolve(); });
    });
    this.uid = this.auth.currentUser?.uid;
    if (!this.uid) throw new Error("Could not sign in. Check that Anonymous sign-in is enabled in Firebase Authentication.");
  }

  async getMe() {
    const { doc, getDoc } = this.F;
    try {
      const snap = await getDoc(doc(this.db, "members", this.uid));
      this.me = snap.exists() ? { uid: this.uid, ...snap.data() } : null;
    } catch (e) { this.me = null; }
    return this.me;
  }

  // Volunteer code -> roster name (only that one entry can be read, and only with the exact code)
  async lookupCode(code) {
    const { doc, getDoc } = this.F;
    try {
      const snap = await getDoc(doc(this.db, "roster", normalizeCode(code)));
      return snap.exists() ? snap.data() : null;
    } catch (e) { return null; }
  }

  // Security rules check the code: a volunteer code must be on the roster under this exact name;
  // the coordinator code must match private/settings.adminCode.
  async join(name, code, role) {
    const { doc, setDoc, serverTimestamp } = this.F;
    try {
      await setDoc(doc(this.db, "members", this.uid), { name, role, code, joinedAt: serverTimestamp() });
    } catch (e) {
      if (e.code === "permission-denied") throw new Error("That access code wasn't accepted.");
      throw e;
    }
    this.me = { uid: this.uid, name, role };
    return this.me;
  }

  // Roster (coordinators only): roster/{code} = { name }, rosterPrivate/{code} = { name, phone }
  subscribeRoster(cb) {
    const { collection, onSnapshot } = this.F;
    let pub = new Map(), priv = new Map();
    const emit = () => cb([...pub.keys()].map((code) => ({ code, name: pub.get(code).name, phone: priv.get(code)?.phone || "" })));
    const u1 = onSnapshot(collection(this.db, "roster"), (snap) => { pub = new Map(snap.docs.map((d) => [d.id, d.data()])); emit(); }, () => cb([]));
    const u2 = onSnapshot(collection(this.db, "rosterPrivate"), (snap) => { priv = new Map(snap.docs.map((d) => [d.id, d.data()])); emit(); }, () => {});
    return () => { u1(); u2(); };
  }
  async addVolunteer(name, phone) {
    const { doc, getDoc, writeBatch, serverTimestamp } = this.F;
    const code = codeFromPhone(phone);
    if (!code) throw new Error("Enter a phone number with at least 4 digits.");
    const existing = await getDoc(doc(this.db, "roster", code));
    if (existing.exists() && norm(existing.data().name) !== norm(name))
      throw new Error(`${existing.data().name} already has code ${code} (same last 4 digits). Use a different phone number for one of them.`);
    const batch = writeBatch(this.db);
    batch.set(doc(this.db, "roster", code), { name, addedAt: serverTimestamp() });
    batch.set(doc(this.db, "rosterPrivate", code), { name, phone });
    await batch.commit();
    return code;
  }
  async removeVolunteer(code) {
    const { doc, writeBatch } = this.F;
    const batch = writeBatch(this.db);
    batch.delete(doc(this.db, "roster", code)); batch.delete(doc(this.db, "rosterPrivate", code));
    await batch.commit();
  }

  async leave() { await this.A.signOut(this.auth); }

  subscribeSigns(cb, onErr) {
    const { collection, onSnapshot } = this.F;
    return onSnapshot(collection(this.db, "signs"), { includeMetadataChanges: true }, (snap) => {
      const signs = snap.docs.map((d) => ({ id: d.id, ...toPlain(d.data({ serverTimestamps: "estimate" })), _pending: d.metadata.hasPendingWrites }));
      cb(signs, { fromCache: snap.metadata.fromCache });
    }, onErr);
  }

  subscribeMembers(cb) {
    const { collection, onSnapshot } = this.F;
    return onSnapshot(collection(this.db, "members"), (snap) => {
      cb(snap.docs.map((d) => { const x = toPlain(d.data()); delete x.code; return { uid: d.id, ...x }; }));
    }, () => cb([]));
  }

  async addSigns(list) {
    const { collection, doc, writeBatch, serverTimestamp } = this.F;
    for (let i = 0; i < list.length; i += 400) {
      const batch = writeBatch(this.db);
      for (const s of list.slice(i, i + 400)) {
        const d = clean(s);
        for (const k of ["placedAt", "retrievedAt", "updatedAt"]) if (d[k] === "NOW") d[k] = serverTimestamp();
        batch.set(doc(collection(this.db, "signs")), { ...d, createdAt: serverTimestamp() });
      }
      await batch.commit();
    }
  }

  async updateSign(id, patch) {
    const { doc, updateDoc, serverTimestamp } = this.F;
    const p = { ...patch };
    for (const k of ["placedAt", "retrievedAt", "updatedAt"]) if (p[k] === "NOW") p[k] = serverTimestamp();
    // Don't await the server — with offline cache the UI updates immediately and syncs later.
    return updateDoc(doc(this.db, "signs", id), p);
  }

  async deleteSigns(ids) {
    const { doc, writeBatch } = this.F;
    for (let i = 0; i < ids.length; i += 400) {
      const batch = writeBatch(this.db);
      ids.slice(i, i + 400).forEach((id) => batch.delete(doc(this.db, "signs", id)));
      await batch.commit();
    }
  }

  async batchUpdate(ids, patchFn) {
    const { doc, writeBatch } = this.F;
    for (let i = 0; i < ids.length; i += 400) {
      const batch = writeBatch(this.db);
      ids.slice(i, i + 400).forEach((id) => {
        const p = { ...patchFn(id) };
        for (const k of ["placedAt", "retrievedAt", "updatedAt"]) if (p[k] === "NOW") p[k] = this.F.serverTimestamp();
        batch.update(doc(this.db, "signs", id), p);
      });
      await batch.commit();
    }
  }

  // Shared pages written by coordinators: info/contacts and info/safety
  subscribeInfo(id, cb) {
    const { doc, onSnapshot } = this.F;
    return onSnapshot(doc(this.db, "info", id), (snap) => {
      cb(snap.exists() ? toPlain(snap.data({ serverTimestamps: "estimate" })) : null);
    }, (e) => { console.warn("info", id, e); cb(null); });
  }

  async saveInfo(id, data) {
    const { doc, setDoc, serverTimestamp } = this.F;
    return setDoc(doc(this.db, "info", id), { ...data, updatedBy: this.me?.name || "", updatedAt: serverTimestamp() });
  }
}

function norm(s) { return String(s || "").trim().toLowerCase().replace(/\s+/g, " "); }

function toPlain(o) {
  const out = {};
  for (const [k, v] of Object.entries(o)) out[k] = v && typeof v.toMillis === "function" ? v.toMillis() : v;
  return out;
}
function clean(o) {
  const out = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v;
  return out;
}

// ---------------------------------------------------------------- Demo
const LS_SIGNS = "signtracker.demo.signs";
const LS_ME = "signtracker.demo.me";
const LS_MEMBERS = "signtracker.demo.members";
const LS_ROSTER = "signtracker.demo.roster";

class DemoStore {
  constructor() { this.demo = true; this.listeners = new Set(); this.memberListeners = new Set();
    window.addEventListener("storage", (e) => {
      if (e.key === LS_SIGNS) this._emit();
      if (e.key === LS_MEMBERS) this._emitMembers();
    });
  }
  _read(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }
  _write(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
  _emit() { const s = this._read(LS_SIGNS, []); this.listeners.forEach((cb) => cb(s, { fromCache: false })); }
  _emitMembers() { const m = this._read(LS_MEMBERS, []); this.memberListeners.forEach((cb) => cb(m)); }

  async getMe() { this.me = this._read(LS_ME, null); return this.me; }
  // Demo: coordinator code is CSPadmin; volunteer codes come from the demo roster
  _roster() {
    let r = this._read(LS_ROSTER, null);
    if (!r) { r = [{ code: "0142CSP", name: "Pat Lee", phone: "604-555-0142" }]; this._write(LS_ROSTER, r); }
    return r;
  }
  async lookupCode(code) { const e = this._roster().find((x) => x.code === normalizeCode(code)); return e ? { name: e.name } : null; }
  subscribeRoster(cb) {
    this.rosterListeners = this.rosterListeners || new Set(); this.rosterListeners.add(cb);
    window.addEventListener("storage", (e) => { if (e.key === LS_ROSTER) cb(this._roster()); });
    setTimeout(() => cb(this._roster())); return () => this.rosterListeners.delete(cb);
  }
  _emitRoster() { (this.rosterListeners || []).forEach((cb) => cb(this._roster())); }
  async addVolunteer(name, phone) {
    const code = codeFromPhone(phone);
    if (!code) throw new Error("Enter a phone number with at least 4 digits.");
    const r = this._roster(); const ex = r.find((x) => x.code === code);
    if (ex && norm(ex.name) !== norm(name)) throw new Error(`${ex.name} already has code ${code} (same last 4 digits). Use a different phone number for one of them.`);
    this._write(LS_ROSTER, [...r.filter((x) => x.code !== code), { code, name, phone }]); this._emitRoster();
    return code;
  }
  async removeVolunteer(code) { this._write(LS_ROSTER, this._roster().filter((x) => x.code !== code)); this._emitRoster(); }

  async join(name, code, role) {
    if (role === "admin" && String(code).trim().toLowerCase() !== "cspadmin") throw new Error("That access code wasn't accepted.");
    if (role === "volunteer") { const e = await this.lookupCode(code); if (!e || norm(e.name) !== norm(name)) throw new Error("That access code wasn't accepted."); }
    const uid = "demo-" + Math.random().toString(36).slice(2, 9);
    this.me = { uid, name, role };
    this._write(LS_ME, this.me);
    const members = this._read(LS_MEMBERS, []); members.push({ uid, name, role, joinedAt: Date.now() });
    this._write(LS_MEMBERS, members); this._emitMembers();
    return this.me;
  }
  async leave() { localStorage.removeItem(LS_ME); }
  subscribeSigns(cb) { this.listeners.add(cb); setTimeout(() => cb(this._read(LS_SIGNS, []), { fromCache: false })); return () => this.listeners.delete(cb); }
  subscribeMembers(cb) { this.memberListeners.add(cb); setTimeout(() => cb(this._read(LS_MEMBERS, []))); return () => this.memberListeners.delete(cb); }
  async addSigns(list) {
    const s = this._read(LS_SIGNS, []);
    list.forEach((x) => {
      const d = { ...x }; for (const k in d) if (d[k] === "NOW") d[k] = Date.now();
      s.push({ id: Math.random().toString(36).slice(2, 12), ...d, createdAt: Date.now() });
    });
    this._write(LS_SIGNS, s); this._emit();
  }
  async updateSign(id, patch) {
    const s = this._read(LS_SIGNS, []); const i = s.findIndex((x) => x.id === id); if (i < 0) return;
    const p = { ...patch }; for (const k in p) if (p[k] === "NOW") p[k] = Date.now();
    s[i] = { ...s[i], ...p }; this._write(LS_SIGNS, s); this._emit();
  }
  async deleteSigns(ids) { this._write(LS_SIGNS, this._read(LS_SIGNS, []).filter((x) => !ids.includes(x.id))); this._emit(); }
  async batchUpdate(ids, patchFn) { for (const id of ids) await this.updateSign(id, patchFn(id)); }
  subscribeInfo(id, cb) {
    const key = "signtracker.demo.info." + id;
    const emit = () => cb(this._read(key, null));
    this.infoListeners = this.infoListeners || [];
    this.infoListeners.push({ key, emit });
    window.addEventListener("storage", (e) => { if (e.key === key) emit(); });
    setTimeout(emit);
    return () => {};
  }
  async saveInfo(id, data) {
    const key = "signtracker.demo.info." + id;
    this._write(key, { ...data, updatedBy: this.me?.name || "", updatedAt: Date.now() });
    (this.infoListeners || []).filter((l) => l.key === key).forEach((l) => l.emit());
  }
}
