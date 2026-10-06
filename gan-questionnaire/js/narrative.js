// בניית דוח תפקודי מילולי מתוך תשובות השאלון. פונקציות טהורות, בלי DOM ובלי Firebase.
// הדוח הוא טיוטה לעריכה: הכללים דטרמיניסטיים, והצוות מתקן ומוסיף לפני ההדפסה.
// הניסוחים מתארים התבוננות בגן ולא אבחנה, וההמלצות הן הצעות לבחינת הצוות.
import { computeSummary, isActive } from "./scoring.js";
import { seedForm } from "./seed.js";

// המלצות ברירת מחדל לתחומי תבנית הפיילוט, לטפסים שנוצרו לפני שנוספו המלצות (tips חסר = ברירת מחדל, tips ריק = בכוונה בלי)
export const DEFAULT_TIPS = Object.fromEntries(seedForm().domains.filter((d) => d.tips).map((d) => [d.id, d.tips]));

export const GENDERS = { n: "לא צוין", m: "בן", f: "בת" };

const LEVEL = {
  5: "כמעט תמיד",
  4: "ברוב המצבים",
  3: "בחלק מהמצבים",
  2: "לעיתים רחוקות או רק בתיווך צמוד",
  1: "כמעט לא, או רק בסיוע מלא",
};

// ---------- לשון נקבה ----------
// ההיגדים בטופס כתובים בלשון זכר. עבור היגדי תבנית הפיילוט יש כאן ניסוח מדויק בנקבה.
// היגד שנוסף או נערך על ידי המנהלת לא יופיע כאן, ולכן מוחלפים בו רק כינויים נפוצים. את היתר הצוות מתקן בעריכה.
const FEM = {
  "פונה למבוגר כדי לבקש משהו, בדרך הזמינה לו": "פונה למבוגר כדי לבקש משהו, בדרך הזמינה לה",
  "פונה בעצמו ברוב הצורך": "פונה בעצמה ברוב הצורך",
  "מביע סירוב או \"לא\" בדרך שהצוות מבין": "מביעה סירוב או \"לא\" בדרך שהצוות מבין",
  "מגיב כשקוראים בשמו": "מגיבה כשקוראים בשמה",
  "כמעט לא מגיב": "כמעט לא מגיבה",
  "מגיב כמעט תמיד": "מגיבה כמעט תמיד",
  "מבין הוראה של צעד אחד בשגרה מוכרת": "מבינה הוראה של צעד אחד בשגרה מוכרת",
  "לא מבצע גם אחרי הדגמה": "לא מבצעת גם אחרי הדגמה",
  "מבצע לבד אחרי אמירה אחת": "מבצעת לבד אחרי אמירה אחת",
  "מבין הוראה של שני צעדים": "מבינה הוראה של שני צעדים",
  "לא מבצע רצף": "לא מבצעת רצף",
  "מבצע את שני הצעדים לבד": "מבצעת את שני הצעדים לבד",
  "משתמש במילה, סימן או סמל מעבר לבקשה בסיסית": "משתמשת במילה, סימן או סמל מעבר לבקשה בסיסית",
  "משתמש ביומיום ברוב ההבעות": "משתמשת ביומיום ברוב ההבעות",
  "מחבר שתי יחידות משמעות": "מחברת שתי יחידות משמעות",
  "יוזם תקשורת עם ילד אחר": "יוזמת תקשורת עם ילד אחר",
  "יוזם כמה פעמים ביום": "יוזמת כמה פעמים ביום",
  "ממתין לתורו בשיחה או במשחק קצר": "ממתינה לתורה בשיחה או במשחק קצר",
  "לא ממתין": "לא ממתינה",
  "ממתין ברוב התורות הקצרים": "ממתינה ברוב התורות הקצרים",
  "משתמש בתקשורת תומכת חלופית בגן": "משתמשת בתקשורת תומכת חלופית בגן",
  "משחק בחפץ לפי השימוש שלו": "משחקת בחפץ לפי השימוש שלו",
  "בוחן בלי שימוש": "בוחנת בלי שימוש",
  "משחק דמיון קצר": "משחקת משחק דמיון קצר",
  "דמיון קצר ביוזמתו": "דמיון קצר ביוזמתה",
  "נשאר במשחק כמה דקות": "נשארת במשחק כמה דקות",
  "עוזב מיד": "עוזבת מיד",
  "נשאר במשחק אהוב כמה דקות": "נשארת במשחק אהוב כמה דקות",
  "משחק לצד ילד אחר באותו מרחב": "משחקת לצד ילד אחר באותו מרחב",
  "נמנע או מנותק": "נמנעת או מנותקת",
  "משחק במקביל ברוב החופש": "משחקת במקביל ברוב החופש",
  "מגיב כשילד פונה אליו": "מגיבה כשילד פונה אליה",
  "לא מגיב": "לא מגיבה",
  "מגיב ברוב הפניות": "מגיבה ברוב הפניות",
  "יוזם קרבה או משחק עם ילד": "יוזמת קרבה או משחק עם ילד",
  "יוזם כמה פעמים בשבוע": "יוזמת כמה פעמים בשבוע",
  "ממתין לתור במשחק מובנה": "ממתינה לתור במשחק מובנה",
  "לא משתתף בתור": "לא משתתפת בתור",
  "ממתין וממשיך את התור": "ממתינה וממשיכה את התור",
  "משתתף במפגש": "משתתפת במפגש",
  "לא נשאר במפגש": "לא נשארת במפגש",
  "יושב ומגיב לרוב המפגש": "יושבת ומגיבה לרוב המפגש",
  "נפרד בבוקר ונכנס לשגרה": "נפרדת בבוקר ונכנסת לשגרה",
  "נכנס לשגרה בזמן סביר": "נכנסת לשגרה בזמן סביר",
  "עובר בין פעילויות כשיש התרעה": "עוברת בין פעילויות כשיש התרעה",
  "עובר ברוב המעברים": "עוברת ברוב המעברים",
  "ממתין זמן קצר כשנדרש": "ממתינה זמן קצר כשנדרש",
  "ממתין דקה-שתיים ברוב הפעמים": "ממתינה דקה-שתיים ברוב הפעמים",
  "מתאושש מתסכול": "מתאוששת מתסכול",
  "נשאר בקושי זמן ארוך": "נשארת בקושי זמן ארוך",
  "חוזר לפעילות תוך דקות": "חוזרת לפעילות תוך דקות",
  "מקבל גבול בלי הסלמה ממושכת": "מקבלת גבול בלי הסלמה ממושכת",
  "מקבל את רוב הגבולות": "מקבלת את רוב הגבולות",
  "בחודש האחרון הייתה פגיעה בעצמו": "בחודש האחרון הייתה פגיעה בעצמה",
  "אוכל בישיבה לאורך הארוחה": "אוכלת בישיבה לאורך הארוחה",
  "לא נשאר / נאכל בהאכלה מלאה": "לא נשארת / נאכלת בהאכלה מלאה",
  "יושב ואוכל ברוב הארוחה": "יושבת ואוכלת ברוב הארוחה",
  "מוריד או לובש בגד פשוט": "מורידה או לובשת בגד פשוט",
  "שוטף ידיים ברצף מוכר": "שוטפת ידיים ברצף מוכר",
  "לא משתתף": "לא משתתפת",
  "משלים את הרצף לבד": "משלימה את הרצף לבד",
  "מודיע על שירותים או נשאר נקי בזמן הגן": "מודיעה על שירותים או נשארת נקייה בזמן הגן",
  "מזהה את המקום ואת החפצים שלו": "מזהה את המקום ואת החפצים שלה",
  "נע בגן במסלול מוכר בלי ליווי צמוד": "נעה בגן במסלול מוכר בלי ליווי צמוד",
  "נע לבד במסלול מוכר": "נעה לבד במסלול מוכר",
  "יציב בתנועה היומיומית בגן": "יציבה בתנועה היומיומית בגן",
  "זקוק לתמיכה כמעט תמיד": "זקוקה לתמיכה כמעט תמיד",
  "יציב במעברים ובישיבה": "יציבה במעברים ובישיבה",
  "משתתף בפעילות תנועה או חצר": "משתתפת בפעילות תנועה או חצר",
  "נמנע כמעט תמיד": "נמנעת כמעט תמיד",
  "משתתף ברוב הפעילויות": "משתתפת ברוב הפעילויות",
  "משתמש בידיים למשימה עדינה": "משתמשת בידיים למשימה עדינה",
  "משלים משימה עדינה לבד": "משלימה משימה עדינה לבד",
  "משתתף במפגש גם כשיש רעש": "משתתפת במפגש גם כשיש רעש",
  "יוצא או קורס כמעט תמיד": "יוצאת או קורסת כמעט תמיד",
  "נשאר ומשתתף ברוב המפגשים": "נשארת ומשתתפת ברוב המפגשים",
  "משתתף בפעילות עם חומר": "משתתפת בפעילות עם חומר",
  "נמנע מכל חומר": "נמנעת מכל חומר",
  "משתתף ברוב החומרים": "משתתפת ברוב החומרים",
  "מוצא את מקומו כשיש סימון": "מוצאת את מקומה כשיש סימון",
  "לא משתמש בסימון": "לא משתמשת בסימון",
  "מגיע למקום לפי הסימון": "מגיעה למקום לפי הסימון",
  "מתמיד כמה דקות במשימה האהובה": "מתמידה כמה דקות במשימה האהובה",
  "נשאר 2–3 דקות ויותר": "נשארת 2–3 דקות ויותר",
  "מתמיד במשימה פחות אהובה עם תיווך": "מתמידה במשימה פחות אהובה עם תיווך",
  "לא נשאר גם עם תיווך": "לא נשארת גם עם תיווך",
  "משלים עם תיווך קל": "משלימה עם תיווך קל",
  "מתאים צבע, צורה או תמונה": "מתאימה צבע, צורה או תמונה",
  "מתאים לבד ברוב הניסיונות": "מתאימה לבד ברוב הניסיונות",
  "מוסר או סופר עד 3 בהקשר משחקי": "מוסרת או סופרת עד 3 בהקשר משחקי",
  "לא מוסר לפי בקשה": "לא מוסרת לפי בקשה",
  "מוסר או סופר עד 3": "מוסרת או סופרת עד 3",
  "מזהה את הסימון האישי או את שמו": "מזהה את הסימון האישי או את שמה",
  "מגיב לסיפור קצר": "מגיבה לסיפור קצר",
  "מסתכל, מצביע או בוחר": "מסתכלת, מצביעה או בוחרת",
  "משתמש במיומנות שנלמדה גם במקום אחר בגן": "משתמשת במיומנות שנלמדה גם במקום אחר בגן",
  "מכליל לפינה נוספת": "מכלילה לפינה נוספת",
  "זקוק להשגחה צמודה בחצר מעבר לשאר הילדים": "זקוקה להשגחה צמודה בחצר מעבר לשאר הילדים",
  "נשאר בגבולות בזמן פעילות רגילה": "נשארת בגבולות בזמן פעילות רגילה",
  "יוצא מגבולות לרוב": "יוצאת מגבולות לרוב",
  "נשאר בגבולות לבד": "נשארת בגבולות לבד",
};

// כינויי גוף נפוצים, לטקסטים שאינם בתבנית הפיילוט
const PRONOUNS = { "לו": "לה", "שלו": "שלה", "בעצמו": "בעצמה", "ביוזמתו": "ביוזמתה", "בשמו": "בשמה", "לתורו": "לתורה", "מקומו": "מקומה" };

export function feminize(text) {
  const s = String(text || "");
  if (FEM[s]) return FEM[s];
  return s.split(/(\s+)/).map((w) => PRONOUNS[w] || w).join("");
}

const phrase = (text, g) => (g === "f" ? feminize(text) : String(text || ""));
const SUBJECT = { m: "הילד", f: "הילדה", n: "הילד/ה" };
// היגדים שמתחילים בשם עצם או בביטוי ולא בפועל. אין להקדים להם נושא.
const noSubject = (text) => /^(עוצמת|יש |ידועה|בחודש|דיווח|ניקיון|התגובה|הגבול|המעבר|הפרידה)/.test(text);
const stmt = (item, g) => (noSubject(item.text) ? phrase(item.text, g) : `${SUBJECT[g]} ${phrase(item.text, g)}`);

const round1 = (n) => Math.round(n * 10) / 10;
const fmt1 = (n) => round1(n).toFixed(1);
const joinHe = (arr) => (arr.length <= 1 ? arr.join("") : `${arr.slice(0, -1).join(", ")} ו${arr[arr.length - 1]}`);
const avgOf = (values) => {
  const v = values.filter((x) => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const fmtDate = (iso) => (iso ? iso.split("-").reverse().join(".") : "");

// ---------- כללי דפוסים בין תחומים ----------
// כל כלל מקבל הקשר { avg(domainId), v(itemId), gap, flagged } ומחזיר מחרוזת או null.
// הכללים מבוססים על מזהי התחומים וההיגדים של תבנית הפיילוט, ולכן לא יופעלו כשהמזהים אינם קיימים.
const PATTERNS = [
  (c) => {
    const rec = avgOf(["C03", "C04", "C05"].map(c.vn)), exp = avgOf(["C01", "C06", "C07", "C08"].map(c.vn));
    if (rec == null || exp == null) return null;
    if (rec - exp >= 1) return "ההבנה (היענות לשם והבנת הוראות) גבוהה מיכולת ההבעה. מומלץ להישען על ההבנה, לחזק דרכי הבעה זמינות (מילה, סימן, סמל או לוח תקשורת) וליצור הזדמנויות להבעה בשגרה.";
    if (exp - rec >= 1) return "יכולת ההבעה גבוהה מהבנת ההוראות. מומלץ לוודא שההוראות קצרות וחד-משמעיות, ושהן מלוות בתיווך חזותי.";
    return null;
  },
  (c) => (c.avg("E") != null && c.avg("S") != null && c.avg("E") <= 2.5 && c.avg("S") <= 3
    ? "קושי בוויסות הרגשי וההתנהגותי עשוי להשפיע על ההשתתפות החברתית והמשחקית. מומלץ להתחיל בהתאמות ויסות (הכנה למעברים, פינת הרגעה, הנחיות קצרות) לפני הצבת יעדים חברתיים."
    : null),
  (c) => (c.avg("L") != null && c.avg("L") <= 2.5 && (c.v("L01") <= 2 || c.v("L02") <= 2)
    ? "הקשב וההתמדה מוגבלים. מומלץ לעבוד במשימות קצרות עם סיום ברור ותיווך צמוד, ולהאריך את משך המשימה בהדרגה."
    : null),
  (c) => (c.avg("M") != null && c.avg("M") <= 2.5 && ((c.avg("A") != null && c.avg("A") <= 3) || c.v("M04") <= 2)
    ? "ייתכן שקשיים מוטוריים או חושיים משפיעים על העצמאות ועל ההשתתפות במפגש. מומלץ לשקול התאמות סביבה ותנוחה, ובשיקול דעת הצוות לבחון ייעוץ מקצועי רלוונטי (למשל ריפוי בעיסוק)."
    : null),
  (c) => (c.flagged > 0 && c.v("B05") <= 2
    ? "יש שילוב של פריט בטיחות מסומן ושל יציאה מגבולות. מומלץ לקבוע נוהל השגחה ברור בחצר ובמעברים, ולעדכן את כל הצוות."
    : null),
  (c) => (c.v("L07") != null && c.v("L07") <= 2
    ? "מיומנויות שנלמדות במקום אחד עדיין אינן עוברות למקומות אחרים. מומלץ לתרגל את אותה מיומנות במספר פינות ועם כמה אנשי צוות."
    : null),
  (c) => (c.scored.length >= 3 && c.scored.every((d) => d.avg >= 4)
    ? "הפרופיל גבוה באופן אחיד. מומלץ להתמקד בהכללה, ביוזמה ובמיומנויות מורכבות יותר."
    : null),
  (c) => (c.scored.length >= 3 && c.scored.every((d) => d.avg <= 2.5)
    ? "הפרופיל נמוך באופן רחב. מומלץ לבחור מספר מצומצם של יעדים (2–3) עם תמיכה גבוהה, ולא לפזר את העבודה על כל התחומים בבת אחת."
    : null),
  (c) => (c.gap > 0.25
    ? "בחלק ניכר מההיגדים לא נבחר ציון (לא רלוונטי או לא נצפה). מומלץ להשלים התבוננות לפני קבלת החלטות על סמך הדוח."
    : null),
];

// ---------- הדוח ----------
// קלט: { form, answers, child: {age, date, fillerRole, gardenName, childCode, formVersion}, gender, prev: {answers, date} | null }
export function buildReport({ form, answers, child, gender = "n", prev = null }) {
  const g = GENDERS[gender] ? gender : "n";
  const subj = SUBJECT[g];
  const summary = computeSummary(form, answers);
  const prevSummary = prev ? computeSummary(form, prev.answers || {}) : null;
  const domains = form.domains.filter((d) => !d.closing && summary.domains[d.id]);
  const items = form.items.filter((i) => isActive(i) && i.type === "scale");
  const val = (id) => {
    const v = answers[id];
    return Number.isInteger(v) && v >= 1 && v <= 5 ? v : null;
  };
  const dInfo = domains.map((d) => ({ id: d.id, name: d.name, color: d.color, avg: summary.domains[d.id].avg, n: summary.domains[d.id].n, total: summary.domains[d.id].total, tips: d.tips !== undefined ? d.tips : DEFAULT_TIPS[d.id] || "" }));
  const scored = dInfo.filter((d) => d.avg != null);
  const byDomain = (id) => items.filter((i) => i.domain === id);

  // ----- תמונת מצב כללית -----
  const strongD = scored.filter((d) => d.avg >= 4), lowD = scored.filter((d) => d.avg < 3);
  const sorted = [...scored].sort((a, b) => b.avg - a.avg);
  const hi = sorted[0], lo = sorted[sorted.length - 1];
  const overview = [
    `הדוח מתאר את התפקוד של ${subj} (גיל ${child.age}) כפי שנצפה בגן בארבעת השבועות שקדמו למילוי השאלון, בתאריך ${fmtDate(child.date)}.`,
  ];
  if (scored.length) {
    overview.push(strongD.length
      ? `החוזקות הבולטות נמצאות בתחומי ${joinHe(strongD.map((d) => `${d.name} (${fmt1(d.avg)})`))}.`
      : "אין תחום שבו הממוצע הוא 4 ומעלה. החוזקות מפורטות להלן לפי היגדים.");
    overview.push(lowD.length
      ? `התחומים שבהם נדרשת תמיכה מוגברת הם ${joinHe(lowD.map((d) => `${d.name} (${fmt1(d.avg)})`))}.`
      : "בכל התחומים הממוצע הוא 3 ומעלה.");
    if (hi && lo && hi.id !== lo.id) {
      overview.push(hi.avg - lo.avg >= 1.5
        ? `קיים פער של ${fmt1(hi.avg - lo.avg)} נקודות בין התחום החזק ביותר (${hi.name}) לבין החלש ביותר (${lo.name}), ולכן מומלץ להתאים את העבודה לכל תחום בנפרד.`
        : "הפרופיל אחיד יחסית בין התחומים.");
    }
  } else {
    overview.push("לא נענו מספיק היגדים מדורגים כדי לחשב פרופיל.");
  }
  const answered = items.filter((i) => val(i.id) != null).length;
  const gap = items.length ? 1 - answered / items.length : 0;
  if (items.length && answered < items.length) {
    overview.push(`לא נבחר ציון ב-${items.length - answered} מתוך ${items.length} ההיגדים המדורגים (לא רלוונטי או לא נצפה). הם אינם נכללים בממוצעים.`);
  }

  // ----- חוזקות -----
  const strengthGroups = [];
  for (const d of dInfo) {
    const list = byDomain(d.id).filter((i) => val(i.id) >= 4).sort((a, b) => val(b.id) - val(a.id));
    if (!list.length) continue;
    strengthGroups.push({
      title: `${d.name} (ממוצע ${d.avg != null ? fmt1(d.avg) : "—"})`,
      bullets: list.map((i) => (i.strengthText ? i.strengthText : `${stmt(i, g)} (${LEVEL[val(i.id)]}).`)),
    });
  }
  const strengthIntro = strengthGroups.length
    ? "אלה יכולות שמופיעות אצל הילד ברוב המצבים. מומלץ לשמר אותן בשגרה, ולהשתמש בהן כנקודת מוצא ליעדים בתחומים מאתגרים (למשל, לשלב פעילות אהובה במשימה קשה יותר)."
    : "לא נמצאו היגדים בציון 4–5. כדאי לחפש חוזקות בעזרת התבוננות נוספת ושיחה עם הצוות.";

  // ----- תחומים לעבודה -----
  const needGroups = [];
  for (const d of dInfo) {
    const list = byDomain(d.id).filter((i) => val(i.id) <= 2).sort((a, b) => val(a.id) - val(b.id));
    if (!list.length) continue;
    const shown = list.slice(0, 5);
    const bullets = shown.map((i) => {
      if (i.needText) return i.needText;
      const v = val(i.id);
      return v === 1
        ? `${stmt(i, g)} כמעט לא, או רק בסיוע מלא.${i.low ? ` כרגע: ${phrase(i.low, g)}.` : ""}`
        : `${stmt(i, g)} רק לעיתים רחוקות או בתיווך צמוד.`;
    });
    if (list.length > shown.length) bullets.push(`ועוד ${list.length - shown.length} היגדים בציון נמוך בתחום זה (מפורטים בטופס).`);
    needGroups.push({ title: `${d.name} (ממוצע ${d.avg != null ? fmt1(d.avg) : "—"})`, bullets });
  }
  const needIntro = needGroups.length
    ? "אלה היגדים שמופיעים רק לעיתים רחוקות או בסיוע מלא. הם מועמדים לעבודה בשליש הקרוב, לפי סדר העדיפויות שהצוות יקבע."
    : "לא נמצאו היגדים בציון 1–2.";

  // ----- מיומנויות מתפתחות -----
  const emerging = [];
  for (const d of dInfo) for (const i of byDomain(d.id)) if (val(i.id) === 3) emerging.push(`${d.name}: ${stmt(i, g)} (${LEVEL[3]}).`);
  const emergingBullets = emerging.slice(0, 8);
  if (emerging.length > 8) emergingBullets.push(`ועוד ${emerging.length - 8} היגדים בציון 3.`);

  // ----- שינוי לעומת מילוי קודם -----
  const change = { intro: "", bullets: [] };
  if (prev && prevSummary) {
    change.intro = `ההשוואה היא למילוי מתאריך ${fmtDate(prev.date)}.`;
    for (const d of dInfo) {
      const p = prevSummary.domains[d.id];
      if (!p || p.avg == null || d.avg == null) continue;
      const diff = d.avg - p.avg;
      if (diff >= 0.5) change.bullets.push(`שיפור בתחום ${d.name}: מממוצע ${fmt1(p.avg)} לממוצע ${fmt1(d.avg)}.`);
      else if (diff <= -0.5) change.bullets.push(`ירידה בתחום ${d.name}: מממוצע ${fmt1(p.avg)} לממוצע ${fmt1(d.avg)}. מומלץ לבדוק גורמים אפשריים (שינוי בשגרה, בריאות, מצב הצוות או הסביבה).`);
    }
    const moved = [];
    for (const i of items) {
      const a = val(i.id), b = prev.answers && Number.isInteger(prev.answers[i.id]) && prev.answers[i.id] >= 1 ? prev.answers[i.id] : null;
      if (a != null && b != null && Math.abs(a - b) >= 2) moved.push(`${stmt(i, g)}: ${a > b ? "עלייה" : "ירידה"} מציון ${b} לציון ${a}.`);
    }
    change.bullets.push(...moved.slice(0, 6));
    if (!change.bullets.length) change.bullets.push("לא נצפה שינוי משמעותי (חצי נקודה ומעלה בממוצע תחום, או שתי נקודות בהיגד) לעומת המילוי הקודם.");
  } else {
    change.intro = "זהו המילוי הראשון של הילד במערכת. ההשוואה לעצמו תופיע לאחר מילוי חוזר.";
  }

  // ----- בטיחות ובריאות -----
  const yesItems = form.items.filter((i) => isActive(i) && i.type === "yesno" && answers[i.id] === true);
  const flaggedItems = yesItems.filter((i) => i.flag);
  const otherYes = yesItems.filter((i) => !i.flag);
  const safety = flaggedItems.map((i) => `סומן: ${phrase(i.text, g)}.`);
  const safetyInfo = otherYes.map((i) => `צוין: ${phrase(i.text, g)}.`);
  const safetyIntro = flaggedItems.length
    ? "מומלץ לוודא שכל הצוות מכיר את הנחיות הבטיחות והבריאות, ושהמידע מעודכן בתיק (כולל פרטי אלרגיה, תרופות והשגחה)."
    : "לא סומן אף פריט בטיחות ובריאות בשאלון.";

  // ----- המלצות -----
  // vn: ערך או null. v: ערך או 99 כשחסר, כדי שהשוואות "<= 2" לא יופעלו על היגד שלא נענה (ב-JS null <= 2 הוא true)
  const ctx = {
    avg: (id) => (summary.domains[id] ? summary.domains[id].avg : null),
    vn: (id) => val(id),
    v: (id) => { const x = val(id); return x == null ? 99 : x; },
    scored, gap, flagged: flaggedItems.length,
  };
  const patterns = PATTERNS.map((fn) => fn(ctx)).filter(Boolean);

  const tipGroups = [];
  for (const d of [...scored].sort((a, b) => a.avg - b.avg).filter((x) => x.avg < 3.5).slice(0, 3)) {
    const tips = String(d.tips || "").split(/\r?\n/).map((t) => t.trim()).filter(Boolean).slice(0, 4);
    const itemTips = byDomain(d.id).filter((i) => i.tip && val(i.id) <= 2).map((i) => i.tip.trim()).filter(Boolean).slice(0, 3);
    const bullets = [...new Set([...itemTips, ...tips])];
    if (bullets.length) tipGroups.push({ title: `המלצות עבודה בתחום ${d.name}`, bullets });
  }

  // יעדים מוצעים: היגדים בציון 2 בתחומים החלשים, ואם אין אז בציון 1
  const goalPool = [];
  for (const d of [...scored].sort((a, b) => a.avg - b.avg)) {
    for (const i of byDomain(d.id)) {
      const v = val(i.id);
      if (v === 2) goalPool.push({ i, v, d });
    }
  }
  if (goalPool.length < 3) {
    for (const d of [...scored].sort((a, b) => a.avg - b.avg)) for (const i of byDomain(d.id)) if (val(i.id) === 1) goalPool.push({ i, v: 1, d });
  }
  const goals = goalPool.slice(0, 3).map(({ i, v, d }) => `בתחום ${d.name}: לקדם את ההיגד "${phrase(i.text, g)}", מציון ${v} לציון ${v + 1}.`);

  // ----- דברי הצוות -----
  const staff = form.items.filter((i) => isActive(i) && i.type === "text" && String(answers[i.id] || "").trim())
    .map((i) => `${i.text}: ${String(answers[i.id]).trim()}`);

  return {
    meta: [
      ["גן", child.gardenName || ""],
      ["מספר ילד", child.childCode],
      ["גיל", `${child.age}`],
      ["תאריך מילוי", fmtDate(child.date)],
      ["ממלא/ת", child.fillerRole || ""],
      ["גרסת שאלון", `${child.formVersion || ""}`],
    ],
    radar: {
      labels: dInfo.map((d) => d.name),
      values: dInfo.map((d) => d.avg),
      prevValues: prevSummary ? dInfo.map((d) => (prevSummary.domains[d.id] ? prevSummary.domains[d.id].avg : null)) : null,
    },
    domains: dInfo.map((d) => ({ name: d.name, color: d.color, avg: d.avg, n: d.n, total: d.total })),
    sections: [
      { id: "overview", title: "תמונת מצב כללית", kind: "paragraphs", paragraphs: overview },
      { id: "strengths", title: "חוזקות לשימור ולפיתוח", kind: "groups", intro: strengthIntro, groups: strengthGroups },
      { id: "needs", title: "תחומים לעבודה", kind: "groups", intro: needIntro, groups: needGroups },
      { id: "emerging", title: "מיומנויות מתפתחות", kind: "bullets", intro: emergingBullets.length ? "אלה מיומנויות שמופיעות בחלק מהמצבים ובתיווך. הן ההזדמנות הקרובה לקידום, כי הילד כבר מפגין אותן חלקית." : "לא נמצאו היגדים בציון 3.", bullets: emergingBullets },
      { id: "change", title: "שינוי לעומת המילוי הקודם", kind: "bullets", intro: change.intro, bullets: change.bullets },
      { id: "safety", title: "בטיחות ובריאות", kind: "bullets", intro: safetyIntro, bullets: [...safety, ...safetyInfo] },
      { id: "insights", title: "תובנות והמלצות להמשך הטיפול", kind: "groups", intro: "ההצעות שלהלן נגזרות מהנתונים בלבד ומיועדות לבחינת הצוות המקצועי.", groups: [
        ...(patterns.length ? [{ title: "תובנות מהפרופיל", bullets: patterns }] : []),
        ...tipGroups,
        ...(goals.length ? [{ title: "יעדים מוצעים לשליש הקרוב (להחלטת הצוות)", bullets: goals }] : []),
      ] },
      { id: "staff", title: "דברי הצוות", kind: "bullets", intro: "", bullets: staff },
      { id: "notes", title: "הערות והשלמות של הצוות", kind: "bullets", intro: "", bullets: [] },
    ],
    footer: "הדוח מבוסס על התבוננות צוות הגן ועל שאלון תפקודי פנימי. הוא אינו אבחון, אינו קובע זכאות ואינו מחליף ועדת זכאות ואפיון או שאלון ראמ״ה. ההמלצות הן הצעות לבחינת הצוות.",
  };
}
