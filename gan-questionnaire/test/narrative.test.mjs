import assert from "node:assert/strict";
import { seedForm } from "../js/seed.js";
import { buildReport, feminize, DEFAULT_TIPS } from "../js/narrative.js";

const form = { ...seedForm(), version: 1 };
const child = { age: 4, date: "2026-05-12", fillerRole: "גננת", gardenName: "גן א", childCode: "14", formVersion: 1 };

// פרופיל לדוגמה: הבנה גבוהה מהבעה, ויסות וחברה נמוכים, הכללה נמוכה, בטיחות מסומנת
const answers = {};
for (const i of form.items) if (i.type === "scale") answers[i.id] = 3;
Object.assign(answers, {
  C03: 5, C04: 5, C05: 4, C01: 2, C06: 2, C07: 1, C08: 2,
  E01: 1, E02: 2, E03: 2, E04: 1, E05: 2, E06: 2, S01: 2, S04: 2, S06: 1,
  L07: 1, A01: 5, A02: 4, A03: 4, A04: 4, A05: 4, A06: 4, A07: 4, B05: 1, C02: 0,
  E07: true, B02: true, C11: true, B01: false,
  N01: "אוהב משחקי חול", N02: "תמונות וסדר יום", N03: "ליזום משחק",
});
const r = buildReport({ form, answers, child, gender: "m" });
const byId = (id) => r.sections.find((s) => s.id === id);
const all = (sec) => (sec.groups ? sec.groups.flatMap((g) => [g.title, ...g.bullets]) : sec.bullets || sec.paragraphs || []);
const text = (id) => all(byId(id)).join("\n");

// מבנה וסעיפים
assert.deepEqual(r.sections.map((s) => s.id), ["overview", "strengths", "needs", "emerging", "change", "safety", "insights", "staff", "notes"]);
assert.equal(r.meta[1][1], "14");

// תמונת מצב: מזכירה פער ותחום חלש, וציון 0 לא נספר
assert.match(text("overview"), /החוזקות הבולטות נמצאות בתחומי/);
assert.match(text("overview"), /ויסות רגשי והתנהגות/);
assert.match(text("overview"), /לא נבחר ציון ב-1 מתוך/);

// חוזקות: רק 4–5, בלשון זכר, עם רמת תדירות
assert.match(text("strengths"), /הילד מגיב כשקוראים בשמו \(כמעט תמיד\)/);
assert.ok(!text("strengths").includes("מבין הוראה של שני צעדים") || /ברוב המצבים/.test(text("strengths")));
assert.ok(!/אוכל בישיבה.*כמעט לא/.test(text("strengths")));

// תחומים לעבודה: 1–2 בלבד, בפורמט קריטריון עם העוגן
assert.match(text("needs"), /הילד מחבר שתי יחידות משמעות כמעט לא, או רק בסיוע מלא\. כרגע: יחידה בודדת או פחות\./);
assert.match(text("needs"), /הילד משתמש במילה, סימן או סמל מעבר לבקשה בסיסית רק לעיתים רחוקות או בתיווך צמוד\./);
assert.ok(!text("needs").includes("מגיב כשקוראים בשמו"));

// מתפתחות: ציון 3
assert.ok(all(byId("emerging")).length > 0 && all(byId("emerging")).every((b) => /בחלק מהמצבים/.test(b) || /ועוד/.test(b)));

// בלי מילוי קודם
assert.match(byId("change").intro, /המילוי הראשון/);

// בטיחות: דגל בלבד, כולל מידע על C11 בנפרד
assert.match(text("safety"), /סומן: בחודש האחרון הייתה פגיעה בעצמו\./);
assert.match(text("safety"), /סומן: ידועה אלרגיה\./);
assert.match(text("safety"), /צוין: משתמש בתקשורת תומכת חלופית בגן\./);
assert.ok(!text("safety").includes("מרקמים"), "B01 ענה לא, לא מסומן");

// תובנות: הבנה מעל הבעה, ויסות מול חברה, הכללה, בטיחות עם יציאה מגבולות
const ins = text("insights");
assert.match(ins, /ההבנה .* גבוהה מיכולת ההבעה/);
assert.match(ins, /ויסות הרגשי וההתנהגותי עשוי להשפיע/);
assert.match(ins, /אינן עוברות למקומות אחרים/);
assert.match(ins, /פריט בטיחות מסומן ושל יציאה מגבולות/);
// המלצות כלליות לתחומים החלשים מגיעות מברירת המחדל
assert.match(ins, /סדר יום חזותי והתרעה מוקדמת/);
assert.match(ins, /יעדים מוצעים לשליש הקרוב/);

// דברי הצוות
assert.match(text("staff"), /חוזקה אחת שנראית בגן: אוהב משחקי חול/);

// כשהמנהלת מנסחת בעצמה, הניסוח שלה גובר
const form2 = structuredClone(form);
form2.items.find((i) => i.id === "C03").strengthText = "מגיב לשמו בהפניית מבט";
form2.items.find((i) => i.id === "C07").needText = "להגדיל מבע לשתי יחידות";
form2.items.find((i) => i.id === "E04").tip = "תבנית הרגעה קבועה";
form2.domains.find((d) => d.id === "E").tips = "טיפ מותאם בוויסות";
const r2 = buildReport({ form: form2, answers, child, gender: "m" });
const t2 = (id) => all(r2.sections.find((s) => s.id === id)).join("\n");
assert.match(t2("strengths"), /מגיב לשמו בהפניית מבט/);
assert.match(t2("needs"), /להגדיל מבע לשתי יחידות/);
assert.match(t2("insights"), /תבנית הרגעה קבועה/);
assert.match(t2("insights"), /טיפ מותאם בוויסות/);
assert.ok(!t2("insights").includes("סדר יום חזותי והתרעה מוקדמת"), "tips מותאם לא מוחלף בברירת מחדל");

// לשון נקבה: היגדי הפיילוט, ללא פגיעה ב"הצוות מבין"
const rf = buildReport({ form, answers, child, gender: "f" });
const tf = (id) => all(rf.sections.find((s) => s.id === id)).join("\n");
assert.match(tf("strengths"), /הילדה מגיבה כשקוראים בשמה \(כמעט תמיד\)/);
assert.match(tf("needs"), /הילדה מחברת שתי יחידות משמעות כמעט לא, או רק בסיוע מלא\. כרגע: יחידה בודדת או פחות\./);
assert.equal(feminize("מביע סירוב או \"לא\" בדרך שהצוות מבין"), "מביעה סירוב או \"לא\" בדרך שהצוות מבין");
assert.equal(feminize("כינוי שלו וגם לו"), "כינוי שלה וגם לה"); // היגד מותאם: רק כינויים
assert.match(tf("overview"), /הילדה/);

// השוואה למילוי קודם
const prevAnswers = { ...answers, E01: 4, E04: 4, C01: 5 };
const rp = buildReport({ form, answers, child, gender: "m", prev: { answers: prevAnswers, date: "2026-01-14" } });
const chg = all(rp.sections.find((s) => s.id === "change")).join("\n");
assert.match(rp.sections.find((s) => s.id === "change").intro, /14\.01\.2026/);
assert.match(chg, /ירידה בתחום ויסות רגשי והתנהגות/);
assert.match(chg, /ירידה מציון 4 לציון 1/);

// פרופיל ריק לא קורס
const empty = buildReport({ form, answers: {}, child, gender: "n" });
assert.match(empty.sections[0].paragraphs.join(" "), /לא נענו מספיק היגדים/);

// ברירות מחדל קיימות לתחומי הפיילוט
assert.ok(Object.keys(DEFAULT_TIPS).length >= 7);
console.log("narrative tests passed");
