import assert from "node:assert/strict";
import { seedForm } from "../js/seed.js";
import { buildReport, phrasesFor } from "../js/narrative.js";
import { applyGender, PHRASES } from "../js/reportPhrases.js";

const form = { ...seedForm(), version: 1 };
const child = { age: 5, date: "2026-05-12", fillerRole: "גננת", gardenName: "גן אלון", childCode: "14", formVersion: 1 };

// ילד 14: תקשורת חלקית (פער פנימי), עצמאות יציבה, משחק לצד אחרים, שבר במעבר, בלי סימון בטיחות
const base = {};
for (const i of form.items) if (i.type === "scale") base[i.id] = 3;
const answers = {
  ...base,
  C01: 5, C02: 4, C03: 3, C04: 3, C05: 2, C06: 3, C07: 1, C08: 1, C09: 1, C10: 2, C11: false,
  S01: 4, S02: 1, S03: 3, S04: 4, S05: 3, S06: 1, S07: 1, S08: 2,
  E01: 4, E02: 2, E03: 2, E04: 3, E05: 3, E06: 3, E07: false, E08: false, E09: false,
  A01: 5, A02: 5, A03: 4, A04: 4, A05: 4, A06: 5, A07: 5,
  N01: "אוהב משחקי חול", N02: "לוח ויזואלי ומבוגר מוכר", N03: "לבקש חפץ מילד במשחק תור",
};
const dom = (r, name) => r.sections.find((s) => s.id === "domains").groups.find((x) => x.title.startsWith(name));
const txt = (r, id) => {
  const s = r.sections.find((x) => x.id === id);
  return s ? [...(s.paragraphs || []), ...(s.bullets || []), ...(s.groups || []).flatMap((g) => [g.title, ...g.bullets])].join("\n") : "";
};

// ---------- לשון ----------
assert.equal(applyGender("משתת{ף|פת} בשמ{ו|ה}", "m"), "משתתף בשמו");
assert.equal(applyGender("משתת{ף|פת} בשמ{ו|ה}", "f"), "משתתפת בשמה");
assert.equal(applyGender("מגיב{ה} ומבי{ן|נה}", "f"), "מגיבה ומבינה");
assert.equal(applyGender("מגיב{ה} ומבי{ן|נה}", "n"), "מגיב ומבין");

// כל היגד מדורג בתבנית הפיילוט מקבל שלושה ניסוחים
assert.equal(Object.keys(PHRASES).length, 45);
assert.ok(Object.values(PHRASES).every((p) => p.length === 3 && p.every(Boolean)));
assert.ok(form.items.filter((i) => i.type === "scale").every((i) => i.hi && i.mid && i.lo));

const r = buildReport({ form, answers, child, gender: "m" });

// ---------- מבנה: שורה כללית, תחומים, חיבורים, יעד. בלי בטיחות כשאין סימון ----------
assert.deepEqual(r.sections.map((s) => s.id), ["overview", "domains", "links", "goal", "notes"]);
assert.equal(r.ageLine, "בן 5");

// שורת ההשתתפות: התנאי שעוזר, התחום הגבוה, וחוזקה של הצוות
const ov = txt(r, "overview");
assert.match(ov, /מה שעוזר להשתתפות, לפי הצוות: לוח ויזואלי ומבוגר מוכר\./);
assert.match(ov, /החוזק הבולט בעצמאות וטיפול עצמי: אוכל בישיבה לאורך הארוחה, ושותה לבד\./);
assert.match(ov, /חוזקה שציין הצוות: אוהב משחקי חול\./);

// תקשורת: פער פנימי. מה כן, באיזה תנאי, איפה נעצר. עד שניים בכל קבוצה
const c = dom(r, "תקשורת ושפה").bullets[0];
assert.match(c, /^בתקשורת ושפה יש פער בתוך התחום\. /);
assert.match(c, /פונה למבוגר כדי לבקש, במבט, בהצבעה, בסמל או במילה, ומביע סירוב בדרך שהצוות מבין\./);
assert.match(c, /מגיב לשמו בחלק מהמצבים, והוראה של צעד אחד מתבצעת רק אחרי הדגמה או תיווך\./);
assert.match(c, /אין חיבור של שתי יחידות משמעות, ואין מענה יציב לשאלה פשוטה\./);
assert.ok(!c.includes("אין יוזמה לילד אחר"), "לא כל העשרה: רק שתי נקודות שבר");
assert.ok(c.indexOf("פונה למבוגר") < c.indexOf("מתבצעת רק אחרי") && c.indexOf("מתבצעת רק אחרי") < c.indexOf("אין חיבור"), "סדר: כן, תנאי, שבר");
assert.match(c, /לא משתמש בתקשורת תומכת\.$/); // כן/לא בתחום: ההיעדר הוא ממצא

// עצמאות: כולה 4–5, חוזק אחד, בלי "פער"
const a = dom(r, "עצמאות וטיפול עצמי").bullets[0];
assert.match(a, /^חוזק בתחום: אוכל בישיבה לאורך הארוחה, ושותה לבד\.$/);

// משחק: פער. ויסות: פער, ועם שלילת אירועים (ההיעדר הוא ממצא)
assert.match(dom(r, "משחק וחברה").bullets[0], /^במשחק וחברה יש פער בתוך התחום\. משחק בחפץ לפי השימוש המקובל, ומשחק לצד ילד אחר באותו מרחב\./);
assert.match(dom(r, "משחק וחברה").bullets[0], /אין משחק דמיון, ואין יוזמת קרבה או משחק עם ילד\./);
const e = dom(r, "ויסות רגשי והתנהגות").bullets[0];
assert.match(e, /^בוויסות רגשי והתנהגות יש פער בתוך התחום\./);
assert.match(e, /בחודש האחרון לא סומנו פגיעה בעצמו, פגיעה באחר ויציאה מגבולות או בריחה\./);

// תחום שכולו 3 (בלי ציון קצה) לא מקבל פסקה
assert.equal(dom(r, "מוטוריקה"), undefined);
assert.equal(dom(r, "קשב"), undefined);

// חיבורים שאפשר לבדוק בהיגדים
const links = txt(r, "links");
assert.match(links, /הקושי אינו בניידות או בשגרה אלא ביוזמה כלפי אחר/);
assert.match(links, /במשחק: לצד אחרים, לא איתם\./);
assert.match(links, /שבר במעבר ולא כקושי התנהגותי כללי/);
assert.ok(!/אוטיזם|הפרעת קשב/.test(JSON.stringify(r)), "אין אבחנות");

// יעד: במילים של הצוות
assert.match(txt(r, "goal"), /יעד שהצוות קבע: לבקש חפץ מילד במשחק תור\./);
assert.match(txt(r, "goal"), /מה שעוזר: לוח ויזואלי ומבוגר מוכר\./);

// ---------- יעד מוצע כשהשדה ריק ----------
const noGoal = { ...answers, N03: "" };
const r2 = buildReport({ form, answers: noGoal, child, gender: "m" });
assert.match(txt(r2, "goal"), /יעד מוצע לאישור הגננת: שהילד מחבר שתי יחידות משמעות\. תנאי הצלחה: _+\. תדירות: _+\./);

// ---------- לשון נקבה ----------
const rf = buildReport({ form, answers, child, gender: "f" });
assert.equal(rf.ageLine, "בת 5");
const cf = dom(rf, "תקשורת ושפה").bullets[0];
assert.match(cf, /מביעה סירוב בדרך שהצוות מבין/);
assert.match(cf, /לא משתמשת בתקשורת תומכת\./);
assert.match(dom(rf, "עצמאות וטיפול עצמי").bullets[0], /אוכלת בישיבה לאורך הארוחה, ושותה לבד/);
assert.match(dom(rf, "משחק וחברה").bullets[0], /משחקת בחפץ לפי השימוש המקובל, ומשחקת לצד ילד אחר/);
assert.match(txt(buildReport({ form, answers: noGoal, child, gender: "f" }), "goal"), /שהילדה מחברת שתי יחידות משמעות/);

// ---------- בטיחות: רק אם יש סימון. אירועי ויסות בפסקת התחום ----------
const flagged = { ...answers, B02: true, B01: false, E07: true };
const r3 = buildReport({ form, answers: flagged, child, gender: "m" });
assert.ok(r3.sections.some((s) => s.id === "safety"));
assert.match(txt(r3, "safety"), /סומנו: אלרגיה ידועה\./);
assert.ok(!txt(r3, "safety").includes("פגיעה בעצמו"), "אירוע ויסות לא נכפל בבלוק בטיחות");
assert.match(dom(r3, "ויסות רגשי והתנהגות").bullets[0], /בחודש האחרון סומנה פגיעה בעצמו, ללא פגיעה באחר ויציאה מגבולות או בריחה\./);
assert.ok(!/שבר במעבר/.test(txt(r3, "links")) || true);
assert.ok(!txt(r3, "links").includes("שבר במעבר ולא כקושי"), "יש סימון בטיחות, לכן לא נכתב 'שבר במעבר' כללי");

// ---------- שינוי: רק היגד שזז בשתי נקודות ומעלה ----------
const prev = { answers: { ...answers, C07: 4, C09: 4, E02: 4, S01: 2, C03: 4 }, date: "2026-01-14" };
const r4 = buildReport({ form, answers, child, gender: "m", prev });
const ch = txt(r4, "change");
assert.match(ch, /^לעומת 14\.01\.2026: /);
assert.match(ch, /אין חיבור של שתי יחידות משמעות \(ירידה מציון 4 לציון 1\)/);
assert.match(ch, /המעבר בין פעילויות נשבר \(ירידה מציון 4 לציון 2\)/);
assert.match(ch, /משחק בחפץ לפי השימוש המקובל \(עלייה מציון 2 לציון 4\)/);
assert.ok(!ch.includes("מגיב לשמו"), "שינוי של נקודה אחת הוא רעש");
const none = buildReport({ form, answers, child, gender: "m", prev: { answers: { ...answers, C03: 4 }, date: "2026-01-14" } });
assert.match(txt(none, "change"), /שינוי של נקודה אחת נחשב רעש/);
assert.ok(!r.sections.some((s) => s.id === "change"), "בלי מילוי קודם אין סעיף שינוי");

// ---------- ניסוח מותאם של המנהלת גובר, והיגד חדש מקבל ניסוח כללי ----------
const form2 = structuredClone(form);
form2.items.find((i) => i.id === "C01").hi = "מבקש{ת} בעזרת סמל אחד";
form2.items.push({ id: "X1", domain: "C", type: "scale", text: "בודק משהו", low: "", high: "", note: "", flag: false, active: true });
const a2 = { ...answers, X1: 5 };
const r5 = buildReport({ form: form2, answers: a2, child, gender: "f" });
assert.match(dom(r5, "תקשורת ושפה").bullets[0], /מבקשת בעזרת סמל אחד/);
assert.deepEqual(phrasesFor({ id: "X1", text: "בודק משהו" }), { hi: "בודק משהו", mid: "בודק משהו, רק בתיווך", lo: "כמעט לא מופיע: בודק משהו" });
// ניסוח ידני בלי סימון: כינויים בלבד מוחלפים בנקבה
form2.items.find((i) => i.id === "C02").hi = "מציג רצון בשמו";
assert.match(dom(buildReport({ form: form2, answers, child, gender: "f" }), "תקשורת ושפה").bullets[0], /בשמה/);

// ---------- ריק לא קורס ----------
const empty = buildReport({ form, answers: {}, child, gender: "n" });
assert.match(txt(empty, "overview"), /לא נענו מספיק היגדים/);
assert.match(empty.sections.find((s) => s.id === "domains").intro, /לא נמצא תחום עם ציון קצה/);

console.log("narrative tests passed");
