// עזרי DOM קטנים. כל טקסט נכנס כ-textContent, לכן אין הזרקת HTML.

// append מקורי מצייר "null" כטקסט כשמעבירים null/false. כאן מסננים אותם, ומשטחים מערכים.
const nativeAppend = Element.prototype.append;
Element.prototype.append = function (...nodes) {
  return nativeAppend.apply(this, nodes.flat(Infinity).filter((n) => n != null && n !== false));
};
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  let value;
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === "class") el.className = v;
    else if (k === "value") value = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (["checked", "disabled", "selected", "hidden", "required"].includes(k)) el[k] = !!v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  const add = (kid) => {
    if (Array.isArray(kid)) kid.forEach(add);
    else if (kid == null || kid === false) return;
    else el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  };
  kids.forEach(add);
  if (value !== undefined) el.value = value;
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

let toastTimer;
export function toast(msg, kind = "ok") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "show " + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = ""), 3200);
}

export function fmtDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export const todayISO = () => new Date().toISOString().slice(0, 10);

// CSV עם BOM כדי ש-Excel יציג עברית נכון
export function downloadCsv(filename, rows) {
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = h("a", { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const ROLE_LABELS = { admin: "מנהלת מערך", teacher: "גננת", assistant: "סייעת" };
export const FILLER_ROLES = ["גננת", "סייעת", "צוות טיפולי", "משותף"];
export const GARDEN_TYPES = [
  "שפתי", "תקשורת", "עיכוב התפתחותי", "מש״ה", "רגשי-התנהגותי", "פיזי", "שמיעה וראייה", "אחר",
];
