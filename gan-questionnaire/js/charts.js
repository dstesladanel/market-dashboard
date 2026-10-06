// תרשימי SVG ללא ספריות חיצוניות. הכול נבנה עם createElementNS, בלי innerHTML.
const NS = "http://www.w3.org/2000/svg";
export function s(tag, attrs, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null && v !== false) el.setAttribute(k, v);
  kids.flat().forEach((k) => k != null && el.append(k instanceof Node ? k : document.createTextNode(String(k))));
  return el;
}

export const SERIES_COLORS = ["#1f6faf", "#d6481a", "#2f7d4f", "#8a4fb0", "#c78a00", "#0e8a8a", "#b0446a"];
const GRID = "#d9d3c7", INK = "#1d2430", MUTED = "#6a7280";

function wrapLabel(text, max = 15) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

// רדאר 1–5. series: [{name, color, values:[number|null]}], labels לפי הסדר
export function radar(labels, series, { size = 360 } = {}) {
  const n = labels.length;
  const W = size + 120;
  const cx = W / 2, cy = size / 2, R = size / 2 - 58;
  const pt = (i, v) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    const r = (R * v) / 5;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const svg = s("svg", { viewBox: `0 0 ${W} ${size}`, role: "img", class: "chart radar", style: "direction:ltr", "aria-label": "רדאר תחומים" });
  for (let g = 1; g <= 5; g++) {
    svg.append(s("polygon", {
      points: labels.map((_, i) => pt(i, g).join(",")).join(" "), fill: "none", stroke: GRID, "stroke-width": g === 5 ? 1.4 : 0.8,
    }));
  }
  labels.forEach((l, i) => {
    const [x, y] = pt(i, 5);
    svg.append(s("line", { x1: cx, y1: cy, x2: x, y2: y, stroke: GRID, "stroke-width": 0.8 }));
    const [lx, ly] = pt(i, 5.75);
    const lines = wrapLabel(l);
    const anchor = lx < cx - 8 ? "end" : lx > cx + 8 ? "start" : "middle";
    // כל שורה היא אלמנט <text> נפרד. ב-Safari טקסט עברי בכמה tspan נערבב (סדר דו-כיווני חוצה שורות)
    lines.forEach((ln, k) => svg.append(s("text", {
      x: lx, y: ly - ((lines.length - 1) * 6) + 4 + k * 12, "text-anchor": anchor, "font-size": 11, fill: INK,
    }, ln)));
  });
  [1, 3, 5].forEach((g) => svg.append(s("text", { x: cx + 3, y: cy - (R * g) / 5 - 2, "font-size": 9, fill: MUTED }, g)));
  series.forEach((se) => {
    const pts = se.values.map((v, i) => (v == null ? null : pt(i, v)));
    const filled = pts.filter(Boolean);
    if (filled.length >= 3) {
      svg.append(s("polygon", {
        points: filled.map((p) => p.join(",")).join(" "), fill: se.color, "fill-opacity": se.dashed ? 0 : 0.18,
        stroke: se.color, "stroke-width": 2, "stroke-dasharray": se.dashed ? "5 4" : null,
      }));
    }
    pts.forEach((p, i) => p && svg.append(s("circle", { cx: p[0], cy: p[1], r: 3.4, fill: se.color }, s("title", {}, `${labels[i]}: ${se.values[i]}`))));
  });
  return svg;
}

// קווים לאורך זמן. series: [{name, points:[{x,y}]}], xLabels נגזרות מהנקודות
export function lines(series, { width = 640, height = 280, fmtX = (x) => x } = {}) {
  const xs = series[0] ? series[0].points.map((p) => p.x) : [];
  const m = { l: 34, r: 14, t: 12, b: 34 };
  const w = width - m.l - m.r, h = height - m.t - m.b;
  const X = (i) => m.l + (xs.length > 1 ? (w * i) / (xs.length - 1) : w / 2);
  const Y = (v) => m.t + h - ((v - 1) / 4) * h;
  const svg = s("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", class: "chart lines", style: "direction:ltr", "aria-label": "מגמה לאורך זמן" });
  for (let g = 1; g <= 5; g++) {
    svg.append(
      s("line", { x1: m.l, x2: width - m.r, y1: Y(g), y2: Y(g), stroke: GRID, "stroke-width": 0.8 }),
      s("text", { x: m.l - 8, y: Y(g) + 4, "text-anchor": "end", "font-size": 10, fill: MUTED }, g));
  }
  xs.forEach((x, i) => svg.append(s("text", { x: X(i), y: height - 10, "text-anchor": "middle", "font-size": 10, fill: MUTED }, fmtX(x))));
  series.forEach((se, k) => {
    const color = se.color || SERIES_COLORS[k % SERIES_COLORS.length];
    // פיסוק: קו נקטע כשחסר ערך
    let seg = [];
    const flush = () => {
      if (seg.length > 1) svg.append(s("polyline", { points: seg.join(" "), fill: "none", stroke: color, "stroke-width": 2.2, "stroke-linejoin": "round" }));
      seg = [];
    };
    se.points.forEach((p, i) => {
      if (p.y == null) { flush(); return; }
      seg.push(`${X(i)},${Y(p.y)}`);
    });
    flush();
    se.points.forEach((p, i) => p.y != null && svg.append(
      s("circle", { cx: X(i), cy: Y(p.y), r: 3.8, fill: color, stroke: "#fff", "stroke-width": 1 }, s("title", {}, `${se.name} · ${fmtX(p.x)}: ${p.y}`))));
  });
  return svg;
}

// עמודות מוערמות אופקיות: התפלגות ילדים בטווחי ממוצע לכל תחום
export function stackedBars(rows, binDefs, { width = 480 } = {}) {
  const left = 170, rowH = 30, h = rows.length * rowH + 8;
  const w = width - left - 10;
  const shades = ["#d6481a", "#f0a273", "#9cc3df", "#1f6faf"];
  const svg = s("svg", { viewBox: `0 0 ${width} ${h}`, role: "img", class: "chart stacked", style: "direction:ltr", "aria-label": "התפלגות ילדים לפי תחום" });
  rows.forEach((r, i) => {
    const total = binDefs.reduce((a, b) => a + (r.bins[b.key] || 0), 0);
    const y = i * rowH + 4;
    svg.append(s("text", { x: width - 6, y: y + 15, "text-anchor": "end", "font-size": 12, fill: INK }, r.label));
    let x = width - left;
    binDefs.forEach((b, k) => {
      const c = r.bins[b.key] || 0;
      if (!total || !c) return;
      const bw = (w * c) / total;
      x -= bw;
      svg.append(s("rect", { x, y, width: bw, height: 20, fill: shades[k] }, s("title", {}, `${r.label} · ${b.label}: ${c} ילדים`)));
      if (bw > 16) svg.append(s("text", { x: x + bw / 2, y: y + 14, "text-anchor": "middle", "font-size": 11, fill: k === 0 || k === 3 ? "#fff" : INK }, c));
    });
    if (!total) svg.append(s("text", { x: width - left, y: y + 14, "text-anchor": "end", "font-size": 11, fill: MUTED }, "אין נתונים"));
  });
  return { svg, shades };
}

export function legend(items) {
  const wrap = document.createElement("div");
  wrap.className = "legend";
  items.forEach(({ label, color }) => {
    const i = document.createElement("span");
    const sw = document.createElement("i");
    sw.style.background = color;
    i.append(sw, document.createTextNode(label));
    wrap.append(i);
  });
  return wrap;
}
