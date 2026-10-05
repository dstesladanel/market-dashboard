// חישוב ללא תלות ב-DOM או ב-Firebase, כדי שאפשר לבדוק אותו בנפרד.
// כלל הממוצע: רק פריטי 1–5 פעילים בתחום; 0 / ללא תשובה לא נספרים.

const round2 = (n) => Math.round(n * 100) / 100;

export const isActive = (item) => item.active !== false;

export function scaleItems(form, domainId) {
  return form.items.filter((i) => i.domain === domainId && i.type === "scale" && isActive(i));
}

export function computeSummary(form, answers) {
  const domains = {};
  for (const d of form.domains) {
    if (d.closing) continue;
    const items = scaleItems(form, d.id);
    if (!items.length) continue;
    const vals = items
      .map((i) => answers[i.id])
      .filter((v) => Number.isInteger(v) && v >= 1 && v <= 5);
    const avg = vals.length ? round2(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    domains[d.id] = { name: d.name, avg, n: vals.length, total: items.length };
  }
  const flags = form.items
    .filter((i) => isActive(i) && i.type === "yesno" && i.flag && answers[i.id] === true)
    .map((i) => ({ id: i.id, text: i.text }));
  return { domains, flags };
}

// פריטים שהמשתמש רואה: סייעת רואה רק פריטים שסומנו עבורה
export function itemsForRole(form, role) {
  return form.items.filter((i) => isActive(i) && (role !== "assistant" || i.assistant));
}

export function answeredCount(items, answers) {
  return items.filter((i) => {
    const v = answers[i.id];
    if (i.type === "text") return typeof v === "string" && v.trim() !== "";
    return v !== undefined && v !== null;
  }).length;
}

// הפרש בין שני סיכומים לפי מזהה תחום
export function deltas(curr, prev) {
  const out = {};
  for (const [id, d] of Object.entries(curr.domains)) {
    const p = prev && prev.domains[id];
    out[id] = d.avg != null && p && p.avg != null ? round2(d.avg - p.avg) : null;
  }
  return out;
}

export function meanOf(values) {
  const v = values.filter((x) => x != null);
  return v.length ? round2(v.reduce((a, b) => a + b, 0) / v.length) : null;
}
