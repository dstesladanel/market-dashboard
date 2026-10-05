// שכבת הנתונים. כל הגישה ל-Firestore עוברת כאן.
import {
  db, doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, writeBatch,
} from "./fb.js";
import { seedForm } from "./seed.js";

const withId = (snap) => ({ id: snap.id, ...snap.data() });
const norm = (email) => email.trim().toLowerCase();

// ---------- הקמה ופרופילים ----------
export async function bootstrapDone() {
  return (await getDoc(doc(db, "config", "bootstrap"))).exists();
}

export async function bootstrap(email, name) {
  email = norm(email);
  const formRef = doc(collection(db, "forms"));
  const batch = writeBatch(db);
  batch.set(doc(db, "config", "bootstrap"), { at: Date.now(), by: email });
  batch.set(doc(db, "users", email), { email, name, role: "admin", gardens: [] });
  batch.set(formRef, { ...seedForm(), version: 1, publishedAt: Date.now(), publishedBy: email });
  batch.set(doc(db, "config", "current"), { formId: formRef.id, version: 1 });
  await batch.commit();
}

export async function getProfile(email) {
  const s = await getDoc(doc(db, "users", norm(email)));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}
export async function listUsers() {
  return (await getDocs(collection(db, "users"))).docs.map(withId);
}
export function saveUser(u) {
  const email = norm(u.email);
  return setDoc(doc(db, "users", email), {
    email, name: u.name || "", role: u.role, gardens: u.gardens || [],
  });
}
export function deleteUser(email) {
  return deleteDoc(doc(db, "users", norm(email)));
}

// ---------- גנים ----------
export async function listGardens() {
  const gs = (await getDocs(collection(db, "gardens"))).docs.map(withId);
  return gs.sort((a, b) => a.name.localeCompare(b.name, "he"));
}
export function saveGarden(g) {
  const ref = g.id ? doc(db, "gardens", g.id) : doc(collection(db, "gardens"));
  return setDoc(ref, { name: g.name, type: g.type || "אחר" });
}
export function deleteGarden(id) {
  return deleteDoc(doc(db, "gardens", id));
}

// ---------- גרסאות טופס ----------
const formCache = new Map();

export async function getForm(id) {
  if (!formCache.has(id)) {
    const s = await getDoc(doc(db, "forms", id));
    if (!s.exists()) throw new Error("גרסת הטופס לא נמצאה");
    formCache.set(id, withId(s));
  }
  return formCache.get(id);
}
export async function getCurrentForm() {
  const cur = await getDoc(doc(db, "config", "current"));
  if (!cur.exists()) throw new Error("לא הוגדר טופס. יש להפעיל את ההקמה הראשונה.");
  return getForm(cur.data().formId);
}

// פרסום יוצר מסמך חדש ואינו משנה גרסאות קודמות, כדי שמילויים ישנים יישארו קריאים
export async function publishForm(form, email) {
  const version = (form.version || 0) + 1;
  const ref = doc(collection(db, "forms"));
  const data = {
    settings: form.settings, domains: form.domains, items: form.items,
    version, publishedAt: Date.now(), publishedBy: email,
  };
  const batch = writeBatch(db);
  batch.set(ref, data);
  batch.set(doc(db, "config", "current"), { formId: ref.id, version });
  await batch.commit();
  const saved = { id: ref.id, ...data };
  formCache.set(ref.id, saved);
  return saved;
}

// ---------- מילויים (תיק הילד: צוות הגן בלבד) ----------
export async function listResponses(gardenId) {
  const snap = await getDocs(query(collection(db, "responses"), where("gardenId", "==", gardenId)));
  return snap.docs.map(withId).sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.createdAt - a.createdAt);
}
export async function listAllResponses() {
  return (await getDocs(collection(db, "responses"))).docs.map(withId);
}
export async function getResponse(id) {
  const s = await getDoc(doc(db, "responses", id));
  return s.exists() ? withId(s) : null;
}
export async function createResponse(data) {
  const ref = doc(collection(db, "responses"));
  const now = Date.now();
  await setDoc(ref, { ...data, answers: {}, status: "draft", createdAt: now, updatedAt: now });
  return ref.id;
}
export function updateResponse(id, patch) {
  return updateDoc(doc(db, "responses", id), { ...patch, updatedAt: Date.now() });
}
export async function deleteResponse(resp) {
  const batch = writeBatch(db);
  batch.delete(doc(db, "responses", resp.id));
  // טיוטה אין לה סיכום, ומחיקת מסמך שאינו קיים נחסמת בכללי האבטחה
  if (resp.status === "final") batch.delete(doc(db, "summaries", resp.id));
  await batch.commit();
}

// סיום מילוי: סימון הסטטוס וכתיבת סיכום נפרד שהמנהלת רשאית לקרוא
export async function finalizeResponse(resp, answers, summary) {
  const batch = writeBatch(db);
  batch.update(doc(db, "responses", resp.id), { answers, status: "final", updatedAt: Date.now() });
  batch.set(doc(db, "summaries", resp.id), {
    gardenId: resp.gardenId, childCode: resp.childCode, age: resp.age, date: resp.date,
    formVersion: resp.formVersion, domains: summary.domains, flags: summary.flags,
    createdAt: Date.now(),
  });
  await batch.commit();
}

// ---------- סיכומים (המנהלת) ----------
export async function listSummaries() {
  return (await getDocs(collection(db, "summaries"))).docs.map(withId);
}
export async function listGardenSummaries(gardenId) {
  const snap = await getDocs(query(collection(db, "summaries"), where("gardenId", "==", gardenId)));
  return snap.docs.map(withId);
}
