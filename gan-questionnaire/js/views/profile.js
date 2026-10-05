import { h, clear, fmtDate } from "../ui.js";
import { downloadChildReport } from "../reportActions.js";
import { getResponse, getForm, listResponses } from "../store.js";
import { computeSummary, deltas } from "../scoring.js";

export async function profileView(root, ctx, params) {
  clear(root);
  const admin = ctx.profile.role === "admin";
  const resp = await getResponse(params.id);
  if (!resp) { root.append(h("div", { class: "card" }, "המילוי לא נמצא")); return; }
  const form = await getForm(resp.formId);
  const answers = resp.answers || {};
  const sum = computeSummary(form, answers);

  // מילוי קודם של אותו ילד באותו גן, להשוואה לעצמו
  const all = (await listResponses(resp.gardenId)).filter((r) => r.childCode === resp.childCode && r.status === "final");
  const prev = all.filter((r) => r.date < resp.date || (r.date === resp.date && r.createdAt < resp.createdAt))[0];
  let prevSum = null;
  if (prev) prevSum = computeSummary(await getForm(prev.formId), prev.answers || {});
  const d = deltas(sum, prevSum);

  const domainRows = form.domains.filter((x) => !x.closing && sum.domains[x.id]).map((dom) => {
    const s = sum.domains[dom.id];
    const delta = d[dom.id];
    return h("div", { class: "bar-row" },
      h("div", { class: "bar-label" }, dom.name),
      h("div", { class: "bar-track", style: `background:${dom.color}` },
        s.avg != null ? h("div", { class: "bar-fill", style: `width:${(s.avg / 5) * 100}%` }) : null),
      h("div", { class: "bar-val" }, s.avg != null ? s.avg.toFixed(1) : "—"),
      h("div", { class: "bar-meta" },
        `${s.n}/${s.total} פריטים`,
        delta != null && delta !== 0 ? h("span", { class: delta > 0 ? "up" : "down" }, ` ${delta > 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(1)}`) : null,
        delta === 0 ? h("span", { class: "muted" }, " ללא שינוי") : null)
    );
  });

  const yesnos = form.items.filter((i) => i.active !== false && i.type === "yesno" && answers[i.id] !== undefined);
  const texts = form.items.filter((i) => i.active !== false && i.type === "text" && (answers[i.id] || "").trim());

  root.append(
    h("div", { class: "toolbar" },
      h("a", { class: "btn", href: admin ? `#/admin/garden/${resp.gardenId}` : "#/children" }, admin ? "חזרה לגן" : "חזרה לרשימה"),
      h("span", { class: "spacer" }),
      h("a", { class: "btn", href: admin ? `#/admin/child/${resp.gardenId}/${encodeURIComponent(resp.childCode)}` : `#/child/${encodeURIComponent(resp.childCode)}` }, "דשבורד הילד"),
      h("button", { class: "btn", onclick: () => downloadChildReport(ctx, { gardenId: resp.gardenId, code: resp.childCode, level: "staff" }) }, "הורדת דוח ילד (Excel)"),
      window.print && h("button", { class: "btn", onclick: () => window.print() }, "הדפסה")
    ),
    h("div", { class: "card" },
      h("h2", {}, `פרופיל · ילד ${resp.childCode}`),
      h("p", { class: "muted" },
        `גיל ${resp.age} · ${fmtDate(resp.date)} · ממלא: ${resp.fillerRole} · גרסת טופס ${resp.formVersion}` +
        (prev ? ` · השוואה למילוי מ-${fmtDate(prev.date)}` : " · זה המילוי הראשון")),
      h("p", { class: "notice" }, "אין ציון כולל. זה פרופיל לפי תחום, ולא אבחון או קביעת זכאות."),
      h("div", { class: "bars" }, domainRows)
    ),
    h("div", { class: "card" },
      h("h3", {}, "פריטי בטיחות ובריאות וכן/לא"),
      sum.flags.length
        ? h("ul", { class: "flags" }, sum.flags.map((f) => h("li", {}, "⚑ " + f.text)))
        : h("p", { class: "muted" }, "לא סומן אף פריט בטיחות."),
      h("table", { class: "table compact" }, h("tbody", {}, yesnos.map((i) =>
        h("tr", {}, h("td", {}, i.text), h("td", {}, answers[i.id] ? "כן" : "לא")))))
    ),
    texts.length ? h("div", { class: "card" },
      h("h3", {}, "חוזקה, מה עוזר, יעד"),
      texts.map((i) => h("p", {}, h("strong", {}, i.text + ": "), answers[i.id]))
    ) : null
  );
}
