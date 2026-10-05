import { h, clear, toast, fmtDate } from "../ui.js";
import { listResponses, deleteResponse } from "../store.js";
import { downloadGardenReport, downloadChildReport } from "../reportActions.js";
import { gardenDashboard } from "./gardenDash.js";

export function activeGardenId(ctx) {
  const mine = ctx.gardens.filter((g) => ctx.profile.gardens.includes(g.id));
  const saved = localStorage.getItem("gan.activeGarden");
  return (mine.find((g) => g.id === saved) || mine[0] || {}).id;
}

// דשבורד הגן של הגננת: גרפים, ילדים וסימוני בטיחות
export async function teacherHome(root, ctx) {
  const mine = ctx.gardens.filter((g) => ctx.profile.gardens.includes(g.id));
  const gardenId = activeGardenId(ctx);
  if (!gardenId) { clear(root).append(h("div", { class: "card" }, h("p", {}, "עדיין לא שויכת לגן. פנו למנהלת המערך."))); return; }
  await gardenDashboard(root, ctx, {
    gardenId, mode: "staff", gardenChoices: mine,
    onPick: (id) => { localStorage.setItem("gan.activeGarden", id); teacherHome(root, ctx); },
  });
}

export async function teacherView(root, ctx) {
  clear(root);
  const { profile, gardens } = ctx;
  const mine = gardens.filter((g) => profile.gardens.includes(g.id));
  if (!mine.length) {
    root.append(h("div", { class: "card" }, h("p", {}, "עדיין לא שויכת לגן. פנו למנהלת המערך.")));
    return;
  }
  let active = localStorage.getItem("gan.activeGarden");
  if (!mine.some((g) => g.id === active)) active = mine[0].id;
  localStorage.setItem("gan.activeGarden", active);

  const select = h("select", {
    onchange: (e) => { localStorage.setItem("gan.activeGarden", e.target.value); teacherView(root, ctx); },
  }, mine.map((g) => h("option", { value: g.id, selected: g.id === active }, g.name)));

  const list = h("div", {}, h("p", { class: "muted" }, "טוען…"));
  const isAssistant = profile.role === "assistant";

  root.append(
    h("div", { class: "toolbar" },
      h("h2", {}, "הילדים בגן"),
      mine.length > 1 ? select : h("strong", {}, mine[0].name),
      h("span", { class: "spacer" }),
      !isAssistant && h("button", { class: "btn", onclick: () => downloadGardenReport(ctx, { gardenId: active, level: "staff" }) }, "הורדת דוח גן (Excel)"),
      h("a", { class: "btn primary", href: "#/fill/new/0" }, "מילוי חדש")
    ),
    h("p", { class: "muted" }, "כל ילד מופיע לפי מספר פנימי בלבד. מילוי נוסף לאותו מספר מאפשר להשוות אותו לעצמו."),
    list
  );

  const responses = await listResponses(active);
  clear(list);
  if (!responses.length) {
    list.append(h("div", { class: "card" }, h("p", {}, "אין עדיין מילויים בגן. לחצו על \"מילוי חדש\".")));
    return;
  }
  const byChild = new Map();
  for (const r of responses) {
    if (!byChild.has(r.childCode)) byChild.set(r.childCode, []);
    byChild.get(r.childCode).push(r);
  }
  const rows = [...byChild.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], "he", { numeric: true })
  );

  list.append(
    h("table", { class: "table stack" },
      h("thead", {}, h("tr", {}, ["מספר ילד", "גיל", "מילויים", "אחרון", "סטטוס", ""].map((t) => h("th", {}, t)))),
      h("tbody", {}, rows.map(([code, rs]) => {
        const last = rs[0];
        const open = last.status === "final" ? `#/profile/${last.id}` : `#/fill/${last.id}/1`;
        return h("tr", {},
          h("td", { "data-label": "מספר ילד", class: "code" }, isAssistant ? code : h("a", { href: `#/child/${encodeURIComponent(code)}` }, code)),
          h("td", { "data-label": "גיל" }, last.age),
          h("td", { "data-label": "מילויים" }, rs.length),
          h("td", { "data-label": "אחרון" }, fmtDate(last.date)),
          h("td", { "data-label": "סטטוס" }, h("span", { class: "badge " + last.status }, last.status === "final" ? "הושלם" : "טיוטה")),
          h("td", { class: "actions", "data-label": "פעולות" },
            h("a", { class: "btn small", href: open }, last.status === "final" ? "פרופיל" : "המשך מילוי"),
            !isAssistant && h("a", { class: "btn small", href: `#/fill/new/0?code=${encodeURIComponent(code)}` }, "מילוי חוזר"),
            !isAssistant && h("button", { class: "btn small", onclick: () => downloadChildReport(ctx, { gardenId: active, code, level: "staff" }) }, "דוח Excel"),
            !isAssistant && h("button", {
              class: "btn small danger",
              onclick: async () => {
                if (!confirm(`למחוק את המילוי האחרון של ילד ${code} (${fmtDate(last.date)})?`)) return;
                await deleteResponse(last);
                toast("המילוי נמחק");
                teacherView(root, ctx);
              },
            }, "מחיקה")
          )
        );
      }))
    )
  );
}
