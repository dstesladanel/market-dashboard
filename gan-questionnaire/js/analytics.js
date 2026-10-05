// הכנת נתונים לדשבורדים ולדוחות. פונקציות טהורות, בלי DOM ובלי Firebase.
import { meanOf } from "./scoring.js";

const byDateAsc = (a, b) => (a.date || "").localeCompare(b.date || "") || (a.createdAt || 0) - (b.createdAt || 0);

// תחומים להצגה: לפי הטופס הנוכחי, ובסוף תחומים ישנים שמופיעים רק בסיכומים
export function domainList(form, summaries) {
  const list = form.domains.filter((d) => !d.closing).map((d) => ({ id: d.id, name: d.name, color: d.color }));
  const known = new Set(list.map((d) => d.id));
  for (const s of summaries) {
    for (const [id, d] of Object.entries(s.domains || {})) {
      if (!known.has(id)) { known.add(id); list.push({ id, name: d.name, color: "#e2e8f0" }); }
    }
  }
  return list;
}

export function latestPerChild(summaries) {
  const m = new Map();
  for (const s of [...summaries].sort(byDateAsc)) m.set(s.gardenId + "|" + s.childCode, s);
  return [...m.values()];
}

export function childHistory(summaries, gardenId, code) {
  return summaries.filter((s) => s.gardenId === gardenId && s.childCode === code).sort(byDateAsc);
}

const BINS = [
  { key: "low", label: "מתחת ל-2", test: (v) => v < 2 },
  { key: "mid", label: "2 עד 3", test: (v) => v >= 2 && v < 3 },
  { key: "high", label: "3 עד 4", test: (v) => v >= 3 && v < 4 },
  { key: "top", label: "4 ומעלה", test: (v) => v >= 4 },
];
export const BIN_DEFS = BINS.map(({ key, label }) => ({ key, label }));

// ממוצע גן לכל תחום: ממוצע של המילוי האחרון של כל ילד, והתפלגות הילדים בטווחים
export function gardenStats(summaries, domains) {
  const latest = latestPerChild(summaries);
  const rows = domains.map((d) => {
    const vals = latest.map((s) => s.domains && s.domains[d.id] && s.domains[d.id].avg).filter((v) => v != null);
    const bins = Object.fromEntries(BINS.map((b) => [b.key, vals.filter(b.test).length]));
    return { ...d, avg: meanOf(vals), n: vals.length, bins };
  });
  const scored = rows.filter((r) => r.avg != null);
  const lo = scored.length > 1 ? scored.reduce((a, b) => (b.avg < a.avg ? b : a)) : null;
  // כששווים כולם אין "תחום חלש"
  const weakest = lo && scored.some((r) => r.avg > lo.avg) ? lo : null;
  return { children: latest.length, rows, weakest };
}

// מגמה לאורך זמן: ממוצע התחום בכל חודש, מכל המילויים באותו חודש
export function gardenTrend(summaries, domains) {
  const months = [...new Set(summaries.map((s) => (s.date || "").slice(0, 7)).filter(Boolean))].sort();
  return domains.map((d) => ({
    id: d.id, name: d.name,
    points: months.map((m) => ({
      x: m,
      y: meanOf(summaries.filter((s) => (s.date || "").startsWith(m)).map((s) => s.domains && s.domains[d.id] && s.domains[d.id].avg)),
    })),
  }));
}

export function childSeries(history, domains) {
  return domains.map((d) => ({
    id: d.id, name: d.name,
    points: history.map((s) => ({ x: s.date, y: s.domains && s.domains[d.id] ? s.domains[d.id].avg : null })),
  }));
}

export function flaggedChildren(summaries) {
  return latestPerChild(summaries).filter((s) => s.flags && s.flags.length);
}

export function flagCounts(flagged) {
  const m = new Map();
  flagged.forEach((s) => s.flags.forEach((f) => m.set(f.text, (m.get(f.text) || 0) + 1)));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
