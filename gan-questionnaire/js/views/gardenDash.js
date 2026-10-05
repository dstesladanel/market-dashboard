import { h, clear, fmtDate } from "../ui.js";
import { listGardenSummaries } from "../store.js";
import { domainList, gardenStats, gardenTrend, flaggedChildren, flagCounts, latestPerChild, BIN_DEFS } from "../analytics.js";
import { radar, lines, stackedBars, legend, SERIES_COLORS } from "../charts.js";
import { downloadGardenReport, downloadChildReport } from "../reportActions.js";

export const shade = (avg) => (avg == null ? "transparent" : `rgba(31,111,175,${0.1 + ((avg - 1) / 4) * 0.55})`);

// דשבורד גן. mode: "staff" (גננת, רואה גם תשובות פרטניות בדף הילד) או "admin" (סיכומים בלבד)
export async function gardenDashboard(root, ctx, { gardenId, mode, gardenChoices, onPick }) {
  clear(root);
  const garden = ctx.gardens.find((g) => g.id === gardenId);
  const level = mode === "staff" ? "staff" : "admin";
  const childHref = (code) => mode === "staff" ? `#/child/${encodeURIComponent(code)}` : `#/admin/child/${gardenId}/${encodeURIComponent(code)}`;

  const picker = gardenChoices && gardenChoices.length > 1
    ? h("select", { onchange: (e) => onPick(e.target.value) },
        gardenChoices.map((g) => h("option", { value: g.id, selected: g.id === gardenId }, g.name)))
    : null;

  root.append(h("div", { class: "toolbar" },
    h("h2", {}, `דשבורד גן · ${garden ? garden.name : ""}`), picker,
    garden && garden.type ? h("span", { class: "chip" }, garden.type) : null,
    h("span", { class: "spacer" }),
    h("button", { class: "btn primary", onclick: () => downloadGardenReport(ctx, { gardenId, level }) }, "הורדת דוח גן (Excel)")));

  const body = h("div", {}, h("p", { class: "muted" }, "טוען…"));
  root.append(body);

  const [form, summaries] = [await ctx.currentForm(), await listGardenSummaries(gardenId)];
  clear(body);
  if (!summaries.length) {
    body.append(h("div", { class: "card" }, h("p", {}, "אין עדיין מילויים שהושלמו בגן הזה. הדשבורד יתמלא עם המילוי הראשון.")));
    return;
  }

  const domains = domainList(form, summaries);
  const stats = gardenStats(summaries, domains);
  const flagged = flaggedChildren(summaries);
  const latest = latestPerChild(summaries).sort((a, b) => a.childCode.localeCompare(b.childCode, "he", { numeric: true }));
  const scored = stats.rows.filter((r) => r.avg != null);

  body.append(
    h("div", { class: "kpis" },
      kpi(stats.children, "ילדים עם מילוי"),
      kpi(summaries.length, "מילויים שהושלמו"),
      kpi(flagged.length, "ילדים עם פריט בטיחות"),
      kpi(stats.weakest ? stats.weakest.name : "—", "התחום החלש בגן", true)),

    h("div", { class: "grid-charts" },
      h("div", { class: "card" },
        h("h3", {}, "ממוצע הגן לפי תחום"),
        h("p", { class: "muted small" }, "מילוי אחרון של כל ילד. 1 = מידה נמוכה, 5 = מידה גבוהה של עצמאות והשתתפות."),
        scored.length >= 3
          ? radar(stats.rows.map((r) => r.name), [{ name: "גן", color: SERIES_COLORS[0], values: stats.rows.map((r) => r.avg) }])
          : null,
        h("div", { class: "bars" }, stats.rows.map((r) => h("div", { class: "bar-row" },
          h("div", { class: "bar-label" }, r.name),
          h("div", { class: "bar-track", style: `background:${r.color}` }, r.avg != null ? h("div", { class: "bar-fill", style: `width:${(r.avg / 5) * 100}%` }) : null),
          h("div", { class: "bar-val" }, r.avg != null ? r.avg.toFixed(1) : "—"),
          h("div", { class: "bar-meta" }, `${r.n} ילדים`, stats.weakest && stats.weakest.id === r.id ? h("span", { class: "down" }, " ▼ חלש") : null))))),
      h("div", { class: "card" },
        h("h3", {}, "התפלגות הילדים בכל תחום"),
        h("p", { class: "muted small" }, "כמה ילדים נמצאים בכל טווח ממוצע."),
        (() => {
          const { svg, shades } = stackedBars(stats.rows.map((r) => ({ label: r.name, bins: r.bins })), BIN_DEFS);
          return [svg, legend(BIN_DEFS.map((b, i) => ({ label: b.label, color: shades[i] })))];
        })()
      )),

    trendCard(summaries, domains),

    h("div", { class: "card" },
      h("h3", {}, `ילדים (${latest.length})`),
      h("p", { class: "muted small" }, "מספר פנימי בלבד. הצבע מציג את הממוצע בכל תחום במילוי האחרון."),
      h("div", { class: "scroll-x" }, h("table", { class: "table matrix" },
        h("thead", {}, h("tr", {}, h("th", {}, "מספר ילד"), h("th", {}, "גיל"), h("th", {}, "אחרון"),
          domains.map((d) => h("th", { style: `background:${d.color}` }, d.name)), h("th", {}, "בטיחות"), h("th", {}, ""))),
        h("tbody", {}, latest.map((s) => h("tr", {},
          h("td", { class: "code" }, h("a", { href: childHref(s.childCode) }, s.childCode)),
          h("td", {}, s.age), h("td", {}, fmtDate(s.date)),
          domains.map((d) => {
            const a = s.domains && s.domains[d.id] ? s.domains[d.id].avg : null;
            return h("td", { class: "num", style: `background:${shade(a)}` }, a != null ? a.toFixed(1) : "—");
          }),
          h("td", {}, s.flags && s.flags.length ? h("span", { class: "flag-pill", title: s.flags.map((f) => f.text).join(" · ") }, `⚑ ${s.flags.length}`) : ""),
          h("td", { class: "actions" },
            h("a", { class: "btn small", href: childHref(s.childCode) }, "דשבורד ילד"),
            h("button", { class: "btn small", onclick: () => downloadChildReport(ctx, { gardenId, code: s.childCode, level }) }, "דוח Excel")))))))),

    flagged.length ? h("div", { class: "card" },
      h("h3", {}, `ילדים שסומנו בפריט בטיחות (${flagged.length})`),
      h("p", { class: "chips" }, flagCounts(flagged).map(([t, n]) => h("span", { class: "chip" }, `${t} · ${n}`))),
      h("table", { class: "table compact" }, h("tbody", {}, flagged.map((s) => h("tr", {},
        h("td", { class: "code" }, h("a", { href: childHref(s.childCode) }, s.childCode)),
        h("td", {}, fmtDate(s.date)), h("td", {}, s.flags.map((f) => f.text).join(" · ")))))))
      : null
  );
}

export const kpi = (value, label, text) => h("div", { class: "kpi" }, h("div", { class: "kpi-val" + (text ? " text" : "") }, value), h("div", { class: "kpi-label" }, label));

function trendCard(summaries, domains) {
  const trend = gardenTrend(summaries, domains);
  const months = trend[0] ? trend[0].points.length : 0;
  const withColor = trend.map((t, i) => ({ ...t, color: SERIES_COLORS[i % SERIES_COLORS.length] }));
  return h("div", { class: "card" },
    h("h3", {}, "מגמה לאורך זמן"),
    h("p", { class: "muted small" }, "ממוצע הגן בכל תחום, לפי חודש מילוי."),
    months >= 2
      ? [lines(withColor, { fmtX: (x) => x.slice(5) + "/" + x.slice(2, 4) }), legend(withColor.map((t) => ({ label: t.name, color: t.color })))]
      : h("p", { class: "muted" }, "המגמה תופיע אחרי מילויים ביותר מחודש אחד."));
}
