import { h, clear, fmtDate } from "../ui.js";
import { listGardenSummaries } from "../store.js";
import { domainList, childHistory, childSeries } from "../analytics.js";
import { deltas } from "../scoring.js";
import { radar, lines, legend, SERIES_COLORS } from "../charts.js";
import { downloadChildReport } from "../reportActions.js";

// דשבורד ילד לפי מספר פנימי. נבנה מהסיכומים בלבד, ולכן זהה בעיקרו אצל גננת ואצל מנהלת.
// צוות הגן מקבל בנוסף קישור לפרופיל המלא עם התשובות הפרטניות והטקסט החופשי.
export async function childView(root, ctx, { gardenId, code, mode }) {
  clear(root);
  const level = "staff"; // גם מנהלת המערך מקבלת דוחות עם תשובות פרטניות
  const back = mode === "staff" ? "#/" : `#/admin/garden/${gardenId}`;
  const garden = ctx.gardens.find((g) => g.id === gardenId);
  const [form, all] = [await ctx.currentForm(), await listGardenSummaries(gardenId)];
  const history = childHistory(all, gardenId, code);
  if (!history.length) {
    root.append(h("div", { class: "card" }, h("p", {}, `אין מילוי שהושלם לילד ${code}.`), h("a", { class: "btn", href: back }, "חזרה")));
    return;
  }
  const domains = domainList(form, history);
  const cur = history[history.length - 1];
  const prev = history.length > 1 ? history[history.length - 2] : null;
  const d = prev ? deltas(cur, prev) : {};

  root.append(
    h("div", { class: "toolbar" },
      h("a", { class: "btn", href: back }, "חזרה לגן"),
      h("h2", {}, `דשבורד ילד · ${code}`), garden ? h("span", { class: "chip" }, garden.name) : null,
      h("span", { class: "spacer" }),
      mode === "staff" ? h("a", { class: "btn", href: `#/fill/new/0?code=${encodeURIComponent(code)}` }, "מילוי חוזר") : null,
      h("button", { class: "btn primary", onclick: () => downloadChildReport(ctx, { gardenId, code, level }) }, "הורדת דוח ילד (Excel)")),
    h("p", { class: "muted" },
      `גיל ${cur.age} · מילוי אחרון ${fmtDate(cur.date)} · ${history.length} מילויים`),
    h("p", { class: "notice" }, "אין ציון כולל. זה פרופיל לפי תחום, ולא אבחון או קביעת זכאות."),

    h("div", { class: "grid-charts" },
      h("div", { class: "card" },
        h("h3", {}, "פרופיל לפי תחום"),
        domains.length >= 3 ? [
          radar(domains.map((x) => x.name), [
            ...(prev ? [{ name: "קודם", color: "#9aa3b2", dashed: true, values: domains.map((x) => (prev.domains[x.id] ? prev.domains[x.id].avg : null)) }] : []),
            { name: "אחרון", color: SERIES_COLORS[0], values: domains.map((x) => (cur.domains[x.id] ? cur.domains[x.id].avg : null)) },
          ]),
          legend([{ label: `אחרון · ${fmtDate(cur.date)}`, color: SERIES_COLORS[0] }, ...(prev ? [{ label: `קודם · ${fmtDate(prev.date)}`, color: "#9aa3b2" }] : [])]),
        ] : null),
      h("div", { class: "card" },
        h("h3", {}, "ממוצע לפי תחום"),
        h("div", { class: "bars" }, domains.map((dom) => {
          const s = cur.domains[dom.id];
          const delta = d[dom.id];
          return h("div", { class: "bar-row" },
            h("div", { class: "bar-label" }, dom.name),
            h("div", { class: "bar-track", style: `background:${dom.color}` }, s && s.avg != null ? h("div", { class: "bar-fill", style: `width:${(s.avg / 5) * 100}%` }) : null),
            h("div", { class: "bar-val" }, s && s.avg != null ? s.avg.toFixed(1) : "—"),
            h("div", { class: "bar-meta" }, s ? `${s.n}/${s.total} פריטים` : "",
              delta != null && delta !== 0 ? h("span", { class: delta > 0 ? "up" : "down" }, ` ${delta > 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(1)}`) : null));
        })))),

    h("div", { class: "card" },
      h("h3", {}, "שינוי לאורך זמן"),
      history.length >= 2
        ? (() => {
            const series = childSeries(history, domains).map((t, i) => ({ ...t, color: SERIES_COLORS[i % SERIES_COLORS.length] }));
            return [lines(series, { fmtX: (x) => fmtDate(x).slice(0, 5) }), legend(series.map((t) => ({ label: t.name, color: t.color })))];
          })()
        : h("p", { class: "muted" }, "זה המילוי הראשון. אחרי מילוי חוזר יוצג כאן שינוי של הילד לעומת עצמו.")),

    h("div", { class: "card" },
      h("h3", {}, "בטיחות ובריאות"),
      cur.flags && cur.flags.length
        ? h("ul", { class: "flags" }, cur.flags.map((f) => h("li", {}, "⚑ " + f.text)))
        : h("p", { class: "muted" }, "לא סומן אף פריט בטיחות במילוי האחרון.")),

    h("div", { class: "card" },
      h("h3", {}, "מילויים"),
      h("table", { class: "table compact" },
        h("thead", {}, h("tr", {}, ["תאריך", "גיל", "גרסת טופס", "פריטי בטיחות", ""].map((t) => h("th", {}, t)))),
        h("tbody", {}, [...history].reverse().map((s) => h("tr", {},
          h("td", {}, fmtDate(s.date)), h("td", {}, s.age), h("td", {}, s.formVersion),
          h("td", {}, (s.flags || []).map((f) => f.text).join(" · ")),
          h("td", {}, h("a", { class: "btn small", href: `#/profile/${s.id}` }, "פרופיל מלא ותשובות")))))))
  );
}
