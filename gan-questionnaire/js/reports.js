// בניית דוחות Excel. הבונים טהורים (מחזירים גיליונות כמערכי שורות), ורק הכותב נוגע ב-DOM.
// כל דוח נבנה מהנתונים העדכניים ברגע ההורדה, ולכן הוא תמיד מעודכן.
import { latestPerChild, gardenStats, flaggedChildren, flagCounts, BIN_DEFS } from "./analytics.js";
import { meanOf } from "./scoring.js";

const nz = (v) => (v == null ? "" : v);
const yn = (v) => (v === true ? "כן" : v === false ? "לא" : nz(v));
export const stamp = () => new Date().toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
const avgOf = (s, id) => (s.domains && s.domains[id] ? nz(s.domains[id].avg) : "");
const flagText = (s) => (s.flags || []).map((f) => f.text).join(" | ");

function info(title, lines) {
  return {
    name: "מידע",
    rows: [[title], ["הופק", stamp()], ...lines, [],
      ["הערה", "הדוח מזהה ילדים לפי מספר פנימי בלבד. אין בו שמות, תעודות זהות או תאריכי לידה. הוא לא אבחון ולא קביעת זכאות."],
      ["הערה", "ממוצע לתחום = ממוצע פריטי 1–5 שנענו. 0 (לא רלוונטי) וחסר לא נספרים. פריטי כן/לא לא נכנסים לממוצע."]],
  };
}

// פריטים מכל גרסאות הטופס שבהם מילא הילד/הגן, לפי סדר הופעה
function collectItems(forms) {
  const seen = new Map();
  for (const f of forms) {
    const dn = Object.fromEntries(f.domains.map((d) => [d.id, d.name]));
    for (const i of f.items) {
      if (i.active === false || seen.has(i.id)) continue;
      seen.set(i.id, { id: i.id, domain: dn[i.domain] || "", text: i.text, type: i.type });
    }
  }
  return [...seen.values()];
}

// ---------- דוח ילד ----------
// history: סיכומים בסדר עולה. fills (לצוות הגן בלבד): [{response, form}] לפי אותו סדר, כולל תשובות פרטניות.
export function childReport({ garden, code, domains, history, fills }) {
  const cols = history.map((s) => `${s.date} (גיל ${s.age})`);
  const sheets = [info(`דוח ילד · ${code}`, [["גן", garden], ["מספר ילד", code], ["מספר מילויים", history.length]])];

  sheets.push({
    name: "ממוצעים לפי תחום",
    rows: [
      ["תחום", ...cols, "שינוי (אחרון פחות ראשון)"],
      ...domains.map((d) => {
        const vals = history.map((s) => (s.domains && s.domains[d.id] ? s.domains[d.id].avg : null));
        const first = vals.find((v) => v != null), last = [...vals].reverse().find((v) => v != null);
        const delta = vals.filter((v) => v != null).length > 1 ? Math.round((last - first) * 100) / 100 : "";
        return [d.name, ...vals.map(nz), delta];
      }),
      ["פריטים שנענו (סה״כ)", ...history.map((s) => Object.values(s.domains || {}).reduce((a, d) => a + d.n, 0))],
    ],
  });
  sheets.push({
    name: "בטיחות ובריאות",
    rows: [["תאריך", "פריט שסומן"], ...history.flatMap((s) => (s.flags || []).map((f) => [s.date, f.text]))],
  });

  if (fills && fills.length) {
    const items = collectItems(fills.map((f) => f.form));
    sheets.push({
      name: "תשובות",
      rows: [
        ["קוד", "תחום", "היגד", "סוג", ...fills.map((f) => f.response.date)],
        ...items.map((i) => [i.id, i.domain, i.text, { scale: "1–5", yesno: "כן/לא", text: "טקסט" }[i.type],
          ...fills.map((f) => yn((f.response.answers || {})[i.id]))]),
      ],
    });
  }
  return sheets;
}

// ---------- דוח גן ----------
// summaries: של הגן. fills (צוות הגן בלבד): [{response, form}] של מילויים שהושלמו.
export function gardenReport({ garden, domains, summaries, fills }) {
  const stats = gardenStats(summaries, domains);
  const latest = latestPerChild(summaries).sort((a, b) => a.childCode.localeCompare(b.childCode, "he", { numeric: true }));
  const sheets = [info(`דוח גן · ${garden.name}`, [
    ["גן", garden.name], ["סוג", garden.type || ""], ["ילדים עם מילוי", stats.children], ["מילויים שהושלמו", summaries.length],
    ["התחום החלש", stats.weakest ? stats.weakest.name : ""],
  ])];

  sheets.push({
    name: "סיכום גן",
    rows: [
      ["תחום", "ממוצע גן", "ילדים שנענו", ...BIN_DEFS.map((b) => "ילדים: " + b.label)],
      ...stats.rows.map((r) => [r.name, nz(r.avg), r.n, ...BIN_DEFS.map((b) => r.bins[b.key])]),
    ],
  });
  sheets.push({
    name: "ילדים",
    rows: [
      ["מספר ילד", "גיל", "תאריך מילוי אחרון", "מספר מילויים", ...domains.map((d) => d.name), "פריטי בטיחות שסומנו"],
      ...latest.map((s) => [s.childCode, s.age, s.date, summaries.filter((x) => x.childCode === s.childCode).length,
        ...domains.map((d) => avgOf(s, d.id)), flagText(s)]),
      ["ממוצע גן", "", "", "", ...stats.rows.map((r) => nz(r.avg)), ""],
    ],
  });
  sheets.push({
    name: "כל המילויים",
    rows: [
      ["מספר ילד", "גיל", "תאריך", "גרסת טופס", ...domains.map((d) => d.name), "פריטי בטיחות שסומנו"],
      ...[...summaries].sort((a, b) => a.childCode.localeCompare(b.childCode, "he", { numeric: true }) || a.date.localeCompare(b.date))
        .map((s) => [s.childCode, s.age, s.date, s.formVersion, ...domains.map((d) => avgOf(s, d.id)), flagText(s)]),
    ],
  });
  sheets.push({
    name: "ילדים מסומנים",
    rows: [["מספר ילד", "תאריך", "פריטים שסומנו"], ...flaggedChildren(summaries).map((s) => [s.childCode, s.date, flagText(s)])],
  });

  if (fills && fills.length) {
    const items = collectItems(fills.map((f) => f.form));
    sheets.push({
      name: "תשובות מלאות",
      rows: [
        ["מספר ילד", "גיל", "תאריך", "ממלא", "גרסת טופס", ...items.map((i) => `${i.domain} · ${i.text}`)],
        ...fills.map(({ response: r }) => [r.childCode, r.age, r.date, r.fillerRole, r.formVersion,
          ...items.map((i) => yn((r.answers || {})[i.id]))]),
      ],
    });
  }
  return sheets;
}

// ---------- דוח מערך (מנהלת) ----------
export function systemReport({ gardens, domains, summaries, fills }) {
  const gName = (id) => (gardens.find((g) => g.id === id) || { name: "גן שנמחק" }).name;
  const latest = latestPerChild(summaries);
  const flagged = flaggedChildren(summaries);
  const sheets = [info("דוח מערך · כלל הגנים", [
    ["גנים", gardens.length], ["ילדים עם מילוי", latest.length], ["מילויים שהושלמו", summaries.length], ["ילדים מסומנים בבטיחות", flagged.length],
  ])];

  const per = gardens.map((g) => ({ g, st: gardenStats(summaries.filter((s) => s.gardenId === g.id), domains) }));
  const all = gardenStats(summaries, domains);
  sheets.push({
    name: "מטריצת גנים",
    rows: [
      ["גן", "סוג", "ילדים", ...domains.map((d) => d.name), "התחום החלש"],
      ...per.map(({ g, st }) => [g.name, g.type || "", st.children, ...st.rows.map((r) => nz(r.avg)), st.weakest ? st.weakest.name : ""]),
      ["כלל המערך", "", all.children, ...all.rows.map((r) => nz(r.avg)), all.weakest ? all.weakest.name : ""],
    ],
  });
  sheets.push({
    name: "כל המילויים",
    rows: [
      ["גן", "מספר ילד", "גיל", "תאריך", "גרסת טופס", ...domains.map((d) => d.name), "פריטי בטיחות שסומנו"],
      ...[...summaries].sort((a, b) => gName(a.gardenId).localeCompare(gName(b.gardenId), "he") || a.childCode.localeCompare(b.childCode, "he", { numeric: true }) || a.date.localeCompare(b.date))
        .map((s) => [gName(s.gardenId), s.childCode, s.age, s.date, s.formVersion, ...domains.map((d) => avgOf(s, d.id)), flagText(s)]),
    ],
  });
  sheets.push({
    name: "ילדים מסומנים",
    rows: [["גן", "מספר ילד", "תאריך", "פריטים שסומנו"], ...flagged.map((s) => [gName(s.gardenId), s.childCode, s.date, flagText(s)])],
  });
  const counts = flagCounts(flagged);
  sheets.push({
    name: "פריטי בטיחות",
    rows: [["פריט", "מספר ילדים"], ...counts.map(([t, n]) => [t, n])],
  });
  if (fills && fills.length) {
    const items = collectItems(fills.map((f) => f.form));
    const sorted = [...fills].sort((a, b) => gName(a.response.gardenId).localeCompare(gName(b.response.gardenId), "he")
      || a.response.childCode.localeCompare(b.response.childCode, "he", { numeric: true }) || a.response.date.localeCompare(b.response.date));
    sheets.push({
      name: "תשובות מלאות",
      rows: [
        ["גן", "מספר ילד", "גיל", "תאריך", "ממלא", "גרסת טופס", ...items.map((i) => `${i.domain} · ${i.text}`)],
        ...sorted.map(({ response: r }) => [gName(r.gardenId), r.childCode, r.age, r.date, r.fillerRole, r.formVersion,
          ...items.map((i) => yn((r.answers || {})[i.id]))]),
      ],
    });
  }
  return sheets;
}

// ---------- כתיבת קובץ xlsx ----------
let xlsxPromise;
function loadXlsx() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  xlsxPromise ||= new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    el.onload = () => resolve(window.XLSX);
    el.onerror = () => { xlsxPromise = null; reject(new Error("לא ניתן לטעון את ספריית ה-Excel. בדקו חיבור לאינטרנט.")); };
    document.head.append(el);
  });
  return xlsxPromise;
}

const safeName = (n) => n.replace(/[:\\/?*[\]]/g, " ").slice(0, 31);

export async function downloadXlsx(filename, sheets) {
  const XLSX = await loadXlsx();
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  for (const sh of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sh.rows);
    const widths = [];
    sh.rows.forEach((r) => r.forEach((c, i) => { widths[i] = Math.min(46, Math.max(widths[i] || 8, String(c ?? "").length + 2)); }));
    ws["!cols"] = widths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, safeName(sh.name));
  }
  XLSX.writeFile(wb, filename);
}

export const fileSafe = (s) => String(s).replace(/[\\/:*?"<>|]/g, "-");
export { meanOf };
