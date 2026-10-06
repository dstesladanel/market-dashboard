// בניית דוח תפקודי מילולי מתוך תשובות השאלון. פונקציות טהורות, בלי DOM ובלי Firebase.
//
// הדוח לא נכתב מהממוצע. הממוצע רק קובע אילו תחומים בולטים. המשפט נבנה מההיגדים עצמם:
//   4–5 = מופיע ברוב המצבים · 3 = מופיע חלקית, רק בתיווך · 1–2 = כמעט לא מופיע · 0 או חסר = לא נכנס.
//   פער פנימי = בתחום אחד יש גם 4–5 וגם 1–2. הוא חשוב יותר מהממוצע.
// לכל היגד שלושה ניסוחים (hi / mid / lo), ועד שני חוזקים ושתי נקודות שבר בכל תחום. סדר המשפט: מה כן, באיזה תנאי, איפה נעצר.
// חיבורים בין תחומים: רק כאלה שאפשר לבדוק בהיגדים. אין אבחנה: ציון נמוך בשפה אינו "אוטיזם" וציון קשב נמוך אינו "הפרעת קשב".
// הטקסט הוא טיוטה לעריכה. השדות החופשיים של הצוות (חוזקה, מה עוזר, יעד) נשארים במילים של הצוות.
import { computeSummary, isActive } from "./scoring.js";
import { PHRASES, YESNO_PHRASES, applyGender } from "./reportPhrases.js";

export const GENDERS = { n: "לא צוין", m: "בן", f: "בת" };
const SUBJECT = { m: "הילד", f: "הילדה", n: "הילד/ה" };
const AGE_WORD = { m: "בן", f: "בת", n: "גיל" };

// כינויי גוף נפוצים בניסוח שנערך ידנית ואין בו סימון לשון. עדיין חסרה בו התאמת הפעלים, והצוות מתקן בעריכה.
const PRONOUNS = { "בעצמו": "בעצמה", "ביוזמתו": "ביוזמתה", "בשמו": "בשמה", "לתורו": "לתורה", "מקומו": "מקומה", "עצמו": "עצמה" }; // רק צורות שברור שהן של הילד. "שלו" ו"לו" עשויות להתייחס לחפץ ולכן לא מוחלפות
export function feminize(text) {
  return String(text || "").split(/(\s+)/).map((w) => PRONOUNS[w] || w).join("");
}
const gen = (text, g) => {
  const t = applyGender(text, g);
  return g === "f" ? feminize(t) : t;
};

// ניסוחים של היגד מדורג: ערך מותאם בטופס, אחרת ברירת מחדל מתבצית הפיילוט, אחרת ניסוח כללי מנוסח ההיגד
export function phrasesFor(item) {
  const d = PHRASES[item.id] || [];
  const t = item.text;
  return {
    hi: item.hi || item.strengthText || d[0] || t,
    mid: item.mid || d[1] || `${t}, רק בתיווך`,
    lo: item.lo || item.needText || d[2] || `כמעט לא מופיע: ${t}`,
  };
}
export function yesnoPhrases(item) {
  const d = YESNO_PHRASES[item.id] || {};
  return { pos: item.pos ?? d.pos ?? item.text, neg: item.neg ?? d.neg ?? "" };
}

const round1 = (n) => Math.round(n * 10) / 10;
const fmt1 = (n) => round1(n).toFixed(1);
const fmtDate = (iso) => (iso ? iso.split("-").reverse().join(".") : "");
const sentence = (t) => { const s = String(t).trim(); return /[.!?:]$/.test(s) ? s : s + "."; };
// שני סעיפים: פסיק ואז "ו". בלי הפסיק "ו" נראה כהמשך של הסעיף הקודם
const andJoin = (list) => (list.length >= 2 ? `${list[0]}, ו${list[1]}` : list[0] || "");
const joinMany = (list) => (list.length <= 1 ? list.join("") : `${list.slice(0, -1).join(", ")} ו${list[list.length - 1]}`);
// "ב" לפני שם תחום. שם שמתחיל ב-ו מקבל ו נוספת (בוויסות)
const inDomain = (name) => (name.startsWith("ו") ? `בו${name}` : `ב${name}`);
const startsNoun = (phrase) => /^(עוצמת|הוראה|חיבור|הלבשה|התגובה|גבול|המעבר|הפרידה|ההתמדה|ההתאוששות|התאמה|מסירה|אין|משימה|שימוש|קרבה|המתנה|השהייה|שטיפת|הסירוב|תקשורת|בנוכחות|מעבר)/.test(phrase);

// ---------- הדוח ----------
// קלט: { form, answers, child: {age, date, fillerRole, gardenName, childCode, formVersion}, gender, prev: {answers, date} | null }
export function buildReport({ form, answers, child, gender = "n", prev = null }) {
  const g = GENDERS[gender] ? gender : "n";
  const P = (s) => gen(s, g);
  const summary = computeSummary(form, answers);
  const domains = form.domains.filter((d) => !d.closing && summary.domains[d.id]);
  const itemsOf = (id) => form.items.filter((i) => isActive(i) && i.type === "scale" && i.domain === id);
  const val = (id) => { const v = answers[id]; return Number.isInteger(v) && v >= 1 && v <= 5 ? v : null; };
  const v99 = (id) => { const v = val(id); return v == null ? 99 : v; }; // חסר = 99, כדי שהשוואה "<= 2" לא תופעל
  const dInfo = domains.map((d) => ({ id: d.id, name: d.name, color: d.color, avg: summary.domains[d.id].avg, n: summary.domains[d.id].n, total: summary.domains[d.id].total }));
  const order = new Map(form.items.map((i, k) => [i.id, k]));
  const byOrder = (a, b) => order.get(a.id) - order.get(b.id);

  // פילוח לפי רמה בתוך תחום
  const split = (id) => {
    const rated = itemsOf(id).map((i) => ({ i, v: val(i.id) })).filter((x) => x.v != null);
    return {
      hi: rated.filter((x) => x.v >= 4).sort((a, b) => b.v - a.v || byOrder(a.i, b.i)),
      mid: rated.filter((x) => x.v === 3).sort((a, b) => byOrder(a.i, b.i)),
      lo: rated.filter((x) => x.v <= 2).sort((a, b) => a.v - b.v || byOrder(a.i, b.i)),
      count: rated.length,
    };
  };

  // כן/לא: סימון בטיחות שאין לו ניסוח "לא" נכנס לבלוק בטיחות. פריט עם ניסוח "לא" (אירועי ויסות) נכתב בתחומו, גם כשההיעדר הוא ממצא.
  const yesnos = form.items.filter((i) => isActive(i) && i.type === "yesno" && typeof answers[i.id] === "boolean");
  const yn = yesnos.map((i) => ({ i, ans: answers[i.id], ...yesnoPhrases(i) }));
  const inline = (id) => yn.filter((x) => x.i.domain === id && (x.neg || !x.i.flag));
  const safetyYes = yn.filter((x) => x.ans && x.i.flag && !x.neg);

  // ----- פסקה לכל תחום -----
  const domainGroups = [];
  for (const d of dInfo) {
    const { hi, mid, lo, count } = split(d.id);
    const extra = inline(d.id);
    const hasEdge = hi.length || lo.length;
    if (!hasEdge && !extra.length) continue;
    const parts = [];
    const hiT = hi.slice(0, 2).map((x) => P(phrasesFor(x.i).hi));
    const midT = mid.slice(0, 2).map((x) => P(phrasesFor(x.i).mid));
    const loT = lo.slice(0, 2).map((x) => P(phrasesFor(x.i).lo));
    if (hasEdge && hi.length === count) {
      parts.push(`חוזק בתחום: ${andJoin(hiT)}.`); // תחום שכולו 4–5 נכתב כחוזק אחד
    } else if (hasEdge && lo.length === count) {
      parts.push(`מוקד לחיזוק ${inDomain(d.name)}: ${andJoin(loT)}.`); // תחום שכולו 1–2: בלי להמציא יכולת
    } else if (hasEdge) {
      if (hi.length && lo.length) parts.push(`${inDomain(d.name)} יש פער בתוך התחום.`);
      if (hiT.length) parts.push(sentence(andJoin(hiT)));
      if (midT.length) parts.push(sentence(andJoin(midT)));
      if (loT.length) parts.push(sentence(andJoin(loT)));
    }
    // כן/לא בתחום
    const yes = extra.filter((x) => x.ans && x.i.flag && x.neg).map((x) => P(x.pos));
    const no = extra.filter((x) => !x.ans && x.i.flag && x.neg).map((x) => P(x.neg));
    if (yes.length) parts.push(`בחודש האחרון סומנ${yes.length > 1 ? "ו" : "ה"} ${joinMany(yes)}${no.length ? `, ללא ${joinMany(no)}` : ""}.`);
    else if (no.length) parts.push(`בחודש האחרון לא סומנו ${joinMany(no)}.`);
    for (const x of extra.filter((x) => !x.i.flag)) {
      const t = x.ans ? x.pos : x.neg;
      if (t) parts.push(sentence(P(t)));
    }
    if (!parts.length) continue;
    domainGroups.push({
      title: `${d.name} (ממוצע ${d.avg != null ? fmt1(d.avg) : "—"})`,
      prose: true,
      bullets: [parts.join(" ")],
    });
  }

  // ----- שורה כללית על ההשתתפות -----
  const staffText = (n) => {
    const it = form.items.filter((i) => isActive(i) && i.type === "text")[n];
    return it ? String(answers[it.id] || "").trim() : "";
  };
  const textBy = (needle) => {
    const it = form.items.find((i) => isActive(i) && i.type === "text" && i.text.includes(needle));
    return it ? String(answers[it.id] || "").trim() : "";
  };
  const strengthNote = textBy("חוזקה") || staffText(0);
  const helpsNote = textBy("עוזר") || staffText(1);
  const goalNote = textBy("יעד") || staffText(2);

  const scored = dInfo.filter((d) => d.avg != null);
  const top = [...scored].sort((a, b) => b.avg - a.avg)[0];
  const overviewParts = [];
  if (helpsNote) overviewParts.push(`מה שעוזר להשתתפות, לפי הצוות: ${helpsNote}.`);
  if (top && split(top.id).hi.length) {
    overviewParts.push(`החוזק הבולט ${inDomain(top.name)}: ${andJoin(split(top.id).hi.slice(0, 2).map((x) => P(phrasesFor(x.i).hi)))}.`);
  } else if (scored.length) {
    overviewParts.push(scored.every((d) => d.avg <= 2.5) ? "לא נצפה תחום עם יכולת יציבה ברוב המצבים, והתמונה נמוכה לרוחב התחומים." : "אין תחום עם חוזק בולט ברוב המצבים.");
  } else {
    overviewParts.push("לא נענו מספיק היגדים מדורגים כדי לבנות תמונה.");
  }
  if (strengthNote) overviewParts.push(`חוזקה שציין הצוות: ${strengthNote}.`);
  const allItems = form.items.filter((i) => isActive(i) && i.type === "scale");
  const answered = allItems.filter((i) => val(i.id) != null).length;
  if (allItems.length && answered < allItems.length * 0.75) overviewParts.push(`לא נבחר ציון ב-${allItems.length - answered} מתוך ${allItems.length} היגדים, ולכן התמונה חלקית.`);

  // ----- חיבורים בין תחומים: רק מה שאפשר לבדוק בהיגדים -----
  const avgOf = (ids) => { const v = ids.map(val).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const domAvg = (id) => (summary.domains[id] ? summary.domains[id].avg : null);
  const noSafetyFlag = !yn.some((x) => x.ans && x.i.flag);
  const links = [];
  if (domAvg("A") != null && domAvg("A") >= 3.5 && (v99("C09") <= 2 || v99("S06") <= 2)) {
    links.push("העצמאות בטיפול העצמי ובתנועה יציבה, ולכן הקושי אינו בניידות או בשגרה אלא ביוזמה כלפי אחר.");
  }
  if (v99("S04") !== 99 && val("S04") >= 4 && v99("S06") <= 2 && (v99("S07") <= 2 || v99("C10") <= 2)) {
    links.push("במשחק: לצד אחרים, לא איתם.");
  }
  if (v99("E01") !== 99 && val("E01") >= 4 && v99("E02") <= 2 && v99("E03") <= 2 && noSafetyFlag) {
    links.push("הפרידה בבוקר תקינה, ואילו המעבר וההמתנה נשברים, בלי סימון בטיחות. זה נראה כשבר במעבר ולא כקושי התנהגותי כללי.");
  }
  if (v99("L05") !== 99 && val("L05") >= 4 && v99("L07") <= 2) {
    links.push(P("יוד{ע|עת} במקום שנלמד, ולא מעביר{ה} לפינה אחרת."));
  }
  const rec = avgOf(["C03", "C04", "C05"]), exp = avgOf(["C01", "C06", "C07", "C08"]);
  if (rec != null && exp != null && rec >= 4 && exp <= 2.5) links.push("ההבנה גבוהה מההבעה. כדאי להישען על ההבנה, ולהזמין הבעה בדרך זמינה (מילה, סימן, סמל או לוח).");

  // ----- בטיחות ובריאות: רק אם יש סימון -----
  const safetyParas = safetyYes.length ? [`סומנו: ${joinMany(safetyYes.map((x) => P(x.pos)))}. מומלץ לוודא שהמידע מעודכן בתיק ושכל אנשי הצוות מכירים אותו.`] : [];

  // ----- יעד לשליש: במילים של הצוות. אם ריק, הצעה אחת לאישור הגננת -----
  const goalParas = [];
  if (goalNote) goalParas.push(`יעד שהצוות קבע: ${goalNote}.`);
  else {
    // הפריט הנמוך ביותר שיש לו פריט שכן גבוה באותו תחום
    let pick = null;
    for (const d of dInfo) {
      const s = split(d.id);
      if (!s.hi.length || !s.lo.length) continue;
      const cand = s.lo[0];
      if (!pick || cand.v < pick.v) pick = cand;
    }
    if (pick) {
      const hiT = P(phrasesFor(pick.i).hi);
      const target = startsNoun(hiT) ? `ש${hiT}` : `ש${SUBJECT[g]} ${hiT}`;
      goalParas.push(`יעד מוצע לאישור הגננת: ${target}. תנאי הצלחה: ____________. תדירות: ____________.`);
    } else {
      goalParas.push("לא הוגדר יעד, ואין בנתונים פריט שמתאים להצעה אוטומטית.");
    }
  }
  if (helpsNote) goalParas.push(`מה שעוזר: ${helpsNote}.`);

  // ----- שינוי: רק היגד שזז בשתי נקודות ומעלה. נקודה אחת היא רעש -----
  let change = null;
  if (prev) {
    const moved = [];
    for (const i of allItems) {
      const a = val(i.id), b = prev.answers && Number.isInteger(prev.answers[i.id]) && prev.answers[i.id] >= 1 && prev.answers[i.id] <= 5 ? prev.answers[i.id] : null;
      if (a == null || b == null || Math.abs(a - b) < 2) continue;
      const ph = phrasesFor(i);
      const now = P(a >= 4 ? ph.hi : a === 3 ? ph.mid : ph.lo);
      moved.push(`${now} (${a > b ? "עלייה" : "ירידה"} מציון ${b} לציון ${a})`);
    }
    change = moved.length
      ? `לעומת ${fmtDate(prev.date)}: ${moved.slice(0, 6).join("; ")}.`
      : `לעומת ${fmtDate(prev.date)} לא נצפה היגד ששינה ציון בשתי נקודות או יותר. שינוי של נקודה אחת נחשב רעש ולא התקדמות.`;
  }

  const sections = [
    { id: "overview", title: "השתתפות כללית", kind: "paragraphs", paragraphs: [overviewParts.join(" ")] },
    { id: "domains", title: "לפי תחומים", kind: "groups", intro: domainGroups.length ? "" : "לא נמצא תחום עם ציון קצה (4–5 או 1–2). התמונה בעיקר חלקית ותלוית תיווך.", groups: domainGroups },
  ];
  if (links.length) sections.push({ id: "links", title: "חיבורים בין תחומים", kind: "bullets", intro: "", bullets: links });
  if (safetyParas.length) sections.push({ id: "safety", title: "בטיחות ובריאות", kind: "paragraphs", paragraphs: safetyParas });
  sections.push({ id: "goal", title: "יעד לשליש", kind: "paragraphs", paragraphs: goalParas });
  if (change) sections.push({ id: "change", title: "שינוי לעומת המילוי הקודם", kind: "paragraphs", paragraphs: [change] });
  sections.push({ id: "notes", title: "הערות והשלמות של הצוות", kind: "bullets", intro: "", bullets: [] });

  return {
    ageLine: `${AGE_WORD[g]} ${child.age}`,
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
      prevValues: prev ? (() => { const ps = computeSummary(form, prev.answers || {}); return dInfo.map((d) => (ps.domains[d.id] ? ps.domains[d.id].avg : null)); })() : null,
    },
    domains: dInfo.map((d) => ({ name: d.name, color: d.color, avg: d.avg, n: d.n, total: d.total })),
    sections,
    footer: "הדוח מבוסס על התבוננות צוות הגן ועל שאלון תפקודי פנימי, והוא טיוטה לעריכה. הוא אינו אבחון, אינו קובע זכאות ואינו מחליף ועדת זכאות ואפיון או שאלון ראמ״ה.",
  };
}
