import { h, clear, fmtDate } from "../ui.js";
import { listSummaries } from "../store.js";
import { domainList, gardenStats, gardenTrend, flaggedChildren, flagCounts } from "../analytics.js";
import { radar, lines, legend, SERIES_COLORS } from "../charts.js";
import { downloadSystemReport, downloadGardenReport } from "../reportActions.js";
import { gardenDashboard, kpi, shade } from "./gardenDash.js";

// הדשבורדים נבנים מאוסף summaries (ממוצע לתחום ודגלי בטיחות). לתשובות הפרטניות המנהלת מגיעה דרך דף הילד.
export async function dashboardView(root, ctx) {
  clear(root);
  const [form, all] = [await ctx.currentForm(), await listSummaries()];
  const gardens = ctx.gardens;
  const gName = (id) => (gardens.find((g) => g.id === id) || { name: "גן שנמחק" }).name;
  const domains = domainList(form, all);

  root.append(h("div", { class: "toolbar" },
    h("h2", {}, "תמונת מערך"), h("span", { class: "spacer" }),
    h("button", { class: "btn primary", onclick: () => downloadSystemReport(ctx) }, "הורדת דוח מערך (Excel)")));

  if (!all.length) {
    root.append(h("div", { class: "card" }, h("p", {}, "עדיין אין מילויים שהושלמו. הדשבורד יתמלא כשהגננות יסיימו מילויים.")));
    return;
  }

  const perGarden = gardens.map((g) => {
    const list = all.filter((s) => s.gardenId === g.id);
    return { g, list, st: gardenStats(list, domains) };
  });
  const sys = gardenStats(all, domains);
  const flagged = flaggedChildren(all).sort((a, b) =>
    gName(a.gardenId).localeCompare(gName(b.gardenId), "he") || a.childCode.localeCompare(b.childCode, "he", { numeric: true }));
  const active = perGarden.filter((p) => p.st.children);
  const colored = active.map((p, i) => ({ ...p, color: SERIES_COLORS[i % SERIES_COLORS.length] }));

  const matrix = h("table", { class: "table matrix" },
    h("thead", {}, h("tr", {}, h("th", {}, "גן"), h("th", {}, "ילדים"),
      domains.map((d) => h("th", { style: `background:${d.color}` }, d.name)), h("th", {}, ""))),
    h("tbody", {},
      perGarden.map(({ g, st }) => h("tr", {},
        h("td", {}, h("a", { href: `#/admin/garden/${g.id}` }, h("strong", {}, g.name)), h("div", { class: "muted small" }, g.type)),
        h("td", {}, st.children),
        st.rows.map((r) => h("td", {
          class: "num" + (st.weakest && st.weakest.id === r.id ? " weakest" : ""), style: `background:${shade(r.avg)}`, title: `${r.n} ילדים`,
        }, r.avg != null ? r.avg.toFixed(1) : "—", st.weakest && st.weakest.id === r.id ? " ▼" : "")),
        h("td", { class: "actions" },
          h("a", { class: "btn small", href: `#/admin/garden/${g.id}` }, "דשבורד גן"),
          h("button", { class: "btn small", onclick: () => downloadGardenReport(ctx, { gardenId: g.id, level: "staff" }) }, "דוח Excel")))),
      h("tr", { class: "total" }, h("td", {}, "כלל המערך"), h("td", {}, sys.children),
        sys.rows.map((r) => h("td", { class: "num", style: `background:${shade(r.avg)}` }, r.avg != null ? r.avg.toFixed(1) : "—")), h("td", {}))));

  root.append(
    h("div", { class: "kpis" },
      kpi(gardens.length, "גנים"), kpi(sys.children, "ילדים עם מילוי"), kpi(all.length, "מילויים שהושלמו"),
      kpi(flagged.length, "ילדים עם פריט בטיחות"), kpi(sys.weakest ? sys.weakest.name : "—", "התחום החלש במערך", true)),

    h("div", { class: "card" },
      h("h3", {}, "ממוצע לפי גן ותחום"),
      h("p", { class: "muted small" }, "מילוי אחרון של כל ילד, לפי מספר פנימי. כהה יותר = ממוצע גבוה יותר. ▼ = התחום החלש באותו גן."),
      h("div", { class: "scroll-x" }, matrix)),

    h("div", { class: "grid-charts" },
      h("div", { class: "card" },
        h("h3", {}, "השוואת גנים"),
        colored.length && domains.length >= 3 ? [
          radar(domains.map((d) => d.name), colored.map((p) => ({ name: p.g.name, color: p.color, values: p.st.rows.map((r) => r.avg) }))),
          legend(colored.map((p) => ({ label: p.g.name, color: p.color }))),
        ] : h("p", { class: "muted" }, "ההשוואה תופיע כשיש לפחות שלושה תחומים עם נתונים.")),
      h("div", { class: "card" },
        h("h3", {}, "מגמת המערך"),
        (() => {
          const trend = gardenTrend(all, domains).map((t, i) => ({ ...t, color: SERIES_COLORS[i % SERIES_COLORS.length] }));
          return trend[0] && trend[0].points.length >= 2
            ? [lines(trend, { fmtX: (x) => x.slice(5) + "/" + x.slice(2, 4) }), legend(trend.map((t) => ({ label: t.name, color: t.color })))]
            : h("p", { class: "muted" }, "המגמה תופיע אחרי מילויים ביותר מחודש אחד.");
        })())),

    h("div", { class: "card" },
      h("h3", {}, `ילדים שסומנו בפריט בטיחות (${flagged.length})`),
      flagged.length ? [
        h("p", { class: "chips" }, flagCounts(flagged).map(([t, n]) => h("span", { class: "chip" }, `${t} · ${n}`))),
        h("table", { class: "table compact stack" },
          h("thead", {}, h("tr", {}, ["גן", "מספר ילד", "תאריך", "פריטים שסומנו"].map((t) => h("th", {}, t)))),
          h("tbody", {}, flagged.map((s) => h("tr", {},
            h("td", { "data-label": "גן" }, gName(s.gardenId)),
            h("td", { "data-label": "מספר ילד", class: "code" }, h("a", { href: `#/admin/child/${s.gardenId}/${encodeURIComponent(s.childCode)}` }, s.childCode)),
            h("td", { "data-label": "תאריך" }, fmtDate(s.date)), h("td", { "data-label": "פריטים שסומנו" }, s.flags.map((f) => f.text).join(" · "))))))
      ] : h("p", { class: "muted" }, "אין ילדים מסומנים."))
  );
}

// מנהלת צופה בגן אחד. אותו רכיב שגננת רואה, עם בורר גנים.
export async function adminGardenView(root, ctx, { gardenId }) {
  const gardens = ctx.gardens;
  if (!gardenId && gardens.length) gardenId = gardens[0].id;
  if (!gardenId) { clear(root).append(h("div", { class: "card" }, "אין גנים במערכת.")); return; }
  await gardenDashboard(root, ctx, {
    gardenId, mode: "admin", gardenChoices: gardens,
    onPick: (id) => { location.hash = `#/admin/garden/${id}`; },
  });
}
