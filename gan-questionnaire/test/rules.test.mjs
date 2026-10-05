// בדיקת כללי האבטחה מול Firebase Emulator.
// הרצה: firebase emulators:exec --only firestore --project demo-gan "node test/rules.test.mjs"
// (דורש @firebase/rules-unit-testing ו-firebase בסביבת ההרצה)
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, writeBatch } from "firebase/firestore";
import { readFileSync } from "node:fs";

const env = await initializeTestEnvironment({
  projectId: "demo-gan",
  firestore: { rules: readFileSync(process.env.RULES || new URL("../firestore.rules", import.meta.url), "utf8"), host: "127.0.0.1", port: 8085 },
});
let pass = 0;
const ok = async (name, p) => { await assertSucceeds(p); pass++; console.log("✓ מותר:", name); };
const no = async (name, p) => { await assertFails(p); pass++; console.log("✓ חסום:", name); };

async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const d = c.firestore();
    const u = (email, role, gardens = []) => setDoc(doc(d, "users", email), { email, role, gardens, name: email });
    await u("admin@t.il", "admin"); await u("t1@t.il", "teacher", ["g1"]); await u("t2@t.il", "teacher", ["g2"]); await u("aide@t.il", "assistant", ["g1"]);
    await setDoc(doc(d, "config", "bootstrap"), { at: 1 });
    await setDoc(doc(d, "config", "current"), { formId: "f1", version: 1 });
    await setDoc(doc(d, "forms", "f1"), { version: 1, domains: [], items: [] });
    await setDoc(doc(d, "gardens", "g1"), { name: "א", type: "שפתי" }); await setDoc(doc(d, "gardens", "g2"), { name: "ב", type: "תקשורת" });
    await setDoc(doc(d, "responses", "r1"), { gardenId: "g1", childCode: "1", status: "final", answers: { C01: 3 } });
    await setDoc(doc(d, "responses", "r2"), { gardenId: "g2", childCode: "9", status: "final", answers: { C01: 5 } });
    await setDoc(doc(d, "summaries", "r1"), { gardenId: "g1", childCode: "1", domains: {}, flags: [] });
    await setDoc(doc(d, "summaries", "r2"), { gardenId: "g2", childCode: "9", domains: {}, flags: [] });
  });
}
const as = (email) => env.authenticatedContext("uid-" + email, { email }).firestore();
await seed();

// ---------- גננת ----------
const t1 = as("t1@t.il");
await ok("גננת קוראת מילוי של הגן שלה", getDoc(doc(t1, "responses", "r1")));
await no("גננת קוראת מילוי של גן אחר", getDoc(doc(t1, "responses", "r2")));
await ok("גננת מאזינה לשאילתה של הגן שלה", getDocs(query(collection(t1, "responses"), where("gardenId", "==", "g1"))));
await no("גננת שואלת על גן אחר", getDocs(query(collection(t1, "responses"), where("gardenId", "==", "g2"))));
await no("גננת קוראת את כל האוסף בלי סינון", getDocs(collection(t1, "responses")));
await ok("גננת מוסיפה מילוי בגן שלה", setDoc(doc(t1, "responses", "n1"), { gardenId: "g1", childCode: "5", status: "draft", answers: {} }));
await no("גננת מוסיפה מילוי בגן אחר", setDoc(doc(t1, "responses", "n2"), { gardenId: "g2", childCode: "5", status: "draft", answers: {} }));
await ok("גננת מעדכנת מילוי בגן שלה", updateDoc(doc(t1, "responses", "r1"), { answers: { C01: 4 } }));
await no("גננת מעבירה מילוי לגן אחר", updateDoc(doc(t1, "responses", "r1"), { gardenId: "g2" }));
await ok("גננת מוחקת מילוי בגן שלה", deleteDoc(doc(t1, "responses", "n1")));
await ok("גננת כותבת סיכום בגן שלה", setDoc(doc(t1, "summaries", "r1"), { gardenId: "g1", childCode: "1", domains: {}, flags: [] }));
await no("גננת כותבת סיכום בגן אחר", setDoc(doc(t1, "summaries", "x"), { gardenId: "g2", childCode: "1", domains: {}, flags: [] }));
await ok("גננת קוראת סיכומי הגן שלה", getDocs(query(collection(t1, "summaries"), where("gardenId", "==", "g1"))));
await no("גננת קוראת סיכומי כל הגנים", getDocs(collection(t1, "summaries")));
await no("גננת עורכת גנים", setDoc(doc(t1, "gardens", "g1"), { name: "x" }));
await no("גננת מפרסמת טופס", setDoc(doc(t1, "forms", "f2"), { version: 2 }));
await no("גננת משנה config/current", setDoc(doc(t1, "config", "current"), { formId: "f2", version: 2 }));
await no("גננת מעלה את עצמה למנהלת", setDoc(doc(t1, "users", "t1@t.il"), { email: "t1@t.il", role: "admin", gardens: [] }));
await no("גננת מוסיפה משתמשת", setDoc(doc(t1, "users", "z@t.il"), { email: "z@t.il", role: "teacher", gardens: ["g1"] }));
await ok("גננת קוראת את הפרופיל של עצמה", getDoc(doc(t1, "users", "t1@t.il")));
await no("גננת קוראת פרופיל של אחרת", getDoc(doc(t1, "users", "t2@t.il")));
await no("גננת מפרטת את כל המשתמשות", getDocs(collection(t1, "users")));
await ok("גננת קוראת טופס נוכחי וגנים", Promise.all([getDoc(doc(t1, "config", "current")), getDoc(doc(t1, "forms", "f1")), getDocs(collection(t1, "gardens"))]));
await ok("האימייל ב-token באותיות גדולות עדיין מזוהה", getDoc(doc(env.authenticatedContext("u", { email: "T1@T.IL" }).firestore(), "responses", "r1")));

// ---------- סייעת ----------
const aide = as("aide@t.il");
await ok("סייעת קוראת מילוי בגן שלה", getDoc(doc(aide, "responses", "r1")));
await ok("סייעת פותחת טיוטה בגן שלה", setDoc(doc(aide, "responses", "a1"), { gardenId: "g1", childCode: "7", status: "draft", answers: {} }));
await ok("סייעת מעדכנת טיוטה", updateDoc(doc(aide, "responses", "a1"), { answers: { A01: 3 } }));
await no("סייעת מוחקת מילוי", deleteDoc(doc(aide, "responses", "a1")));
await no("סייעת כותבת סיכום (לא מסיימת מילוי)", setDoc(doc(aide, "summaries", "a1"), { gardenId: "g1", childCode: "7", domains: {}, flags: [] }));

// ---------- מנהלת ----------
const adm = as("admin@t.il");
await ok("מנהלת קוראת מילוי בכל גן (g1)", getDoc(doc(adm, "responses", "r1")));
await ok("מנהלת קוראת מילוי בכל גן (g2)", getDoc(doc(adm, "responses", "r2")));
await ok("מנהלת מפרטת את כל המילויים", getDocs(collection(adm, "responses")));
await ok("מנהלת קוראת את כל הסיכומים", getDocs(collection(adm, "summaries")));
await no("מנהלת לא מעדכנת מילוי", updateDoc(doc(adm, "responses", "r1"), { answers: {} }));
await no("מנהלת לא יוצרת מילוי", setDoc(doc(adm, "responses", "q"), { gardenId: "g1", childCode: "1", status: "draft", answers: {} }));
await no("מנהלת לא מוחקת מילוי", deleteDoc(doc(adm, "responses", "r1")));
await no("מנהלת לא כותבת סיכום", setDoc(doc(adm, "summaries", "q"), { gardenId: "g1", childCode: "1", domains: {}, flags: [] }));
await ok("מנהלת עורכת גנים", setDoc(doc(adm, "gardens", "g3"), { name: "ג", type: "אחר" }));
await ok("מנהלת מוסיפה משתמשת ומפרטת משתמשות", Promise.all([setDoc(doc(adm, "users", "n@t.il"), { email: "n@t.il", role: "teacher", gardens: ["g1"] }), getDocs(collection(adm, "users"))]));
const b = writeBatch(adm);
b.set(doc(adm, "forms", "f2"), { version: 2, domains: [], items: [] }); b.set(doc(adm, "config", "current"), { formId: "f2", version: 2 });
await ok("מנהלת מפרסמת גרסת טופס חדשה", b.commit());
await no("מנהלת לא משנה גרסה שפורסמה", updateDoc(doc(adm, "forms", "f1"), { version: 9 }));
await no("מנהלת לא מוחקת גרסה שפורסמה", deleteDoc(doc(adm, "forms", "f1")));

// ---------- זרים ----------
const stranger = as("nobody@t.il");
await no("משתמש בלי פרופיל קורא מילוי", getDoc(doc(stranger, "responses", "r1")));
await no("משתמש בלי פרופיל קורא סיכום", getDoc(doc(stranger, "summaries", "r1")));
await no("משתמש בלי פרופיל קורא גנים", getDocs(collection(stranger, "gardens")));
await no("משתמש בלי פרופיל כותב", setDoc(doc(stranger, "responses", "s"), { gardenId: "g1", childCode: "1", status: "draft", answers: {} }));
const anon = env.unauthenticatedContext().firestore();
await no("אנונימי קורא מילוי", getDoc(doc(anon, "responses", "r1")));
await no("אנונימי קורא משתמשות", getDoc(doc(anon, "users", "admin@t.il")));
await ok("אנונימי יכול לראות רק אם ההקמה הסתיימה", getDoc(doc(anon, "config", "bootstrap")));
await no("אנונימי לא קורא config/current", getDoc(doc(anon, "config", "current")));

// ---------- הקמה ראשונה ----------
await env.clearFirestore();
const first = as("first@t.il");
const bb = writeBatch(first);
bb.set(doc(first, "config", "bootstrap"), { at: 1, by: "first@t.il" });
bb.set(doc(first, "users", "first@t.il"), { email: "first@t.il", role: "admin", gardens: [] });
bb.set(doc(first, "forms", "f1"), { version: 1, domains: [], items: [] });
bb.set(doc(first, "config", "current"), { formId: "f1", version: 1 });
await ok("הקמה ראשונה: המשתמשת הראשונה הופכת למנהלת", bb.commit());
const second = as("second@t.il");
await no("אחרי ההקמה: אחרת לא יכולה להפוך למנהלת", setDoc(doc(second, "users", "second@t.il"), { email: "second@t.il", role: "admin", gardens: [] }));
await no("אחרי ההקמה: אי אפשר ליצור bootstrap מחדש", setDoc(doc(second, "config", "bootstrap"), { at: 2 }));
await env.clearFirestore();
await no("לפני ההקמה: אי אפשר ליצור פרופיל לאימייל של אחרת", setDoc(doc(as("evil@t.il"), "users", "other@t.il"), { email: "other@t.il", role: "admin", gardens: [] }));
await no("לפני ההקמה: אי אפשר ליצור פרופיל גננת בהקמה", setDoc(doc(as("evil@t.il"), "users", "evil@t.il"), { email: "evil@t.il", role: "teacher", gardens: ["g1"] }));

console.log(`\n${pass} בדיקות כללי אבטחה עברו`);
await env.cleanup();
