// תחליף זעיר ל-Firebase בזיכרון (מתמיד ב-localStorage), לבדיקת ממשק בלבד. אינו בודק כללי אבטחה.
export const appJs = `
export const initializeApp = (cfg, name='[DEFAULT]') => ({ name });
export const deleteApp = async () => {};
`;
export const authJs = `
const KEY='fakeauth';
const st = () => JSON.parse(localStorage.getItem(KEY) || '{"accounts":{},"current":null}');
const put = (s) => localStorage.setItem(KEY, JSON.stringify(s));
const listeners = [];
const notify = () => { const c = st().current; listeners.forEach((cb) => cb(c ? { email: c } : null)); };
const isMain = (a) => a.app.name === '[DEFAULT]';
export const getAuth = (app) => ({ app });
export const onAuthStateChanged = (auth, cb) => { listeners.push(cb); setTimeout(notify, 0); };
export const signInWithEmailAndPassword = async (auth, email, pw) => {
  const s = st(); email = email.toLowerCase();
  if (s.accounts[email] !== pw) throw { code: 'auth/invalid-credential' };
  s.current = email; put(s); notify();
};
export const createUserWithEmailAndPassword = async (auth, email, pw) => {
  const s = st(); email = email.toLowerCase();
  if (s.accounts[email]) throw { code: 'auth/email-already-in-use' };
  s.accounts[email] = pw; if (isMain(auth)) s.current = email; put(s); if (isMain(auth)) notify();
};
export const sendPasswordResetEmail = async (auth, email) => { window.__resets = (window.__resets||[]).concat(email); };
export const signOut = async (auth) => { if (!isMain(auth)) return; const s = st(); s.current = null; put(s); notify(); };
`;
export const fsJs = `
const KEY='fakedb';
const load = () => JSON.parse(localStorage.getItem(KEY) || '{}');
const save = (d) => localStorage.setItem(KEY, JSON.stringify(d));
let n = 0;
const rid = () => 'id' + Date.now().toString(36) + (n++);
export const getFirestore = () => ({});
export const collection = (db, name) => ({ coll: name });
export const doc = (a, coll, id) => a.coll ? { coll: a.coll, id: rid() } : { coll, id: id ?? rid() };
const snap = (coll, id, data) => ({ id, exists: () => data !== undefined, data: () => data });
export const getDoc = async (r) => snap(r.coll, r.id, (load()[r.coll] || {})[r.id]);
export const where = (field, op, val) => ({ field, op, val });
export const query = (c, ...cs) => ({ coll: c.coll, cs });
export const getDocs = async (q) => {
  const all = load()[q.coll] || {};
  let ids = Object.keys(all);
  for (const c of q.cs || []) ids = ids.filter((i) => all[i][c.field] === c.val);
  return { docs: ids.map((i) => snap(q.coll, i, all[i])) };
};
const apply = (op) => {
  const d = load(); d[op.r.coll] ||= {};
  if (op.t === 'set') d[op.r.coll][op.r.id] = JSON.parse(JSON.stringify(op.data));
  if (op.t === 'update') {
    if (!d[op.r.coll][op.r.id]) throw new Error('no doc ' + op.r.coll + '/' + op.r.id);
    Object.assign(d[op.r.coll][op.r.id], JSON.parse(JSON.stringify(op.data)));
  }
  if (op.t === 'delete') delete d[op.r.coll][op.r.id];
  save(d);
};
export const setDoc = async (r, data) => apply({ t: 'set', r, data });
export const updateDoc = async (r, data) => apply({ t: 'update', r, data });
export const deleteDoc = async (r) => apply({ t: 'delete', r });
export const writeBatch = () => { const ops = [];
  const b = { set: (r, data) => { ops.push({ t: 'set', r, data }); return b; }, update: (r, data) => { ops.push({ t: 'update', r, data }); return b; },
    delete: (r) => { ops.push({ t: 'delete', r }); return b; }, commit: async () => ops.forEach(apply) }; return b; };
`;
export const configJs = `export const firebaseConfig = { apiKey: "test", authDomain: "t", projectId: "t", appId: "t" };`;
