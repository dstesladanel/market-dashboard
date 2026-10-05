import { h, clear, toast } from "../ui.js";
import { publishForm } from "../store.js";
import { seedForm } from "../seed.js";

const PALETTE = ["#fbe8dc", "#f8eed7", "#f5e3e3", "#e4eee4", "#e5eef5", "#ece6f5", "#f5ede2", "#f3ece6", "#e2e8f0", "#fde7f3"];
const TYPES = { scale: "סולם 1–5", yesno: "כן / לא", text: "טקסט קצר" };
const rid = (p) => p + Math.random().toString(36).slice(2, 8);

export async function formEditorView(root, ctx) {
  clear(root);
  const base = await ctx.currentForm();
  let draft = JSON.parse(JSON.stringify({ settings: base.settings, domains: base.domains, items: base.items }));
  let dirty = false;
  const touch = () => { dirty = true; badge.textContent = "יש שינויים שלא פורסמו"; badge.hidden = false; };

  const badge = h("span", { class: "badge draft", hidden: true });
  const body = h("div", {});

  const move = (arr, i, dir, same = () => true) => {
    let j = i + dir;
    while (j >= 0 && j < arr.length && !same(arr[j])) j += dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    touch(); draw();
  };

  // מצב פתיחה נשמר בין ציורים מחדש, כדי שהמסך לא "יקפוץ" אחרי כל שינוי
  const openItems = new Set();
  const closedDomains = new Set();

  const chip = (text, cls = "") => h("span", { class: "chip-sm " + cls }, text);

  function itemRow(item, n) {
    const idx = draft.items.indexOf(item);
    const bind = (key) => (e) => { item[key] = e.target.value; touch(); };
    const sumText = h("span", { class: "sum-text" }, item.text || "היגד חדש (לחצו לעריכה)");
    const field = (label, ctl) => h("label", { class: "field" }, h("span", {}, label), ctl);
    const typeSel = h("select", {
      onchange: (e) => { item.type = e.target.value; touch(); draw(); },
    }, Object.entries(TYPES).map(([k, v]) => h("option", { value: k, selected: item.type === k }, v)));

    return h("details", {
      class: "edit-item" + (item.active === false ? " off" : ""), open: openItems.has(item.id),
      ontoggle: (e) => { if (e.target.open) openItems.add(item.id); else openItems.delete(item.id); },
    },
      h("summary", {},
        h("span", { class: "num" }, n),
        sumText,
        h("span", { class: "chips-sm" },
          chip(TYPES[item.type]),
          item.type === "yesno" && item.flag ? chip("⚑ דגל", "warn") : null,
          item.assistant ? chip("סייעת") : null,
          item.active === false ? chip("לא פעיל", "off") : null)),
      h("div", { class: "edit-body" },
        field("ניסוח ההיגד (התנהגות שנראית בגן)", h("textarea", {
          rows: 2, value: item.text,
          oninput: (e) => { item.text = e.target.value; sumText.textContent = e.target.value || "היגד חדש (לחצו לעריכה)"; touch(); },
        })),
        h("div", { class: "grid2" },
          field("סוג תשובה", typeSel),
          field("הערה או דוגמה (לא חובה)", h("input", { value: item.note || "", oninput: bind("note") }))),
        item.type === "scale" && h("div", { class: "grid2" },
          field("עוגן לציון 1", h("input", { value: item.low || "", oninput: bind("low") })),
          field("עוגן לציון 5", h("input", { value: item.high || "", oninput: bind("high") }))),
        h("div", { class: "edit-line checks" },
          item.type === "yesno" && h("label", { class: "check", title: "הילד יופיע ברשימת הילדים המסומנים אצל המנהלת" },
            h("input", { type: "checkbox", checked: !!item.flag, onchange: (e) => { item.flag = e.target.checked; touch(); draw(); } }), "דגל בטיחות"),
          item.type !== "text" && h("label", { class: "check", title: "הסייעת רואה וממלאת רק היגדים כאלה" },
            h("input", { type: "checkbox", checked: !!item.assistant, onchange: (e) => { item.assistant = e.target.checked; touch(); draw(); } }), "מוצג לסייעת"),
          h("label", { class: "check" },
            h("input", { type: "checkbox", checked: item.active !== false, onchange: (e) => { item.active = e.target.checked; touch(); draw(); } }), "פעיל")),
        h("div", { class: "edit-line actions-row" },
          h("button", { class: "btn small", onclick: () => move(draft.items, idx, -1, (x) => x.domain === item.domain) }, "↑ למעלה"),
          h("button", { class: "btn small", onclick: () => move(draft.items, idx, 1, (x) => x.domain === item.domain) }, "↓ למטה"),
          h("span", { class: "spacer" }),
          h("button", {
            class: "btn small danger",
            onclick: () => { if (confirm("למחוק את ההיגד? מילויים קודמים נשארים כפי שמולאו.")) { draft.items.splice(idx, 1); touch(); draw(); } },
          }, "מחיקה"))
      )
    );
  }

  function domainCard(dom, di) {
    const items = draft.items.filter((i) => i.domain === dom.id);
    const field = (label, ctl) => h("label", { class: "field" }, h("span", {}, label), ctl);
    const nameShown = h("span", { class: "dom-name" }, dom.name || "תחום חדש");
    return h("details", {
      class: "card edit-domain", style: `border-top:6px solid ${dom.color}`, open: !closedDomains.has(dom.id),
      ontoggle: (e) => { if (e.target.open) closedDomains.delete(dom.id); else closedDomains.add(dom.id); },
    },
      h("summary", { class: "dom-sum" },
        h("span", { class: "dom-dot", style: `background:${dom.color}` }),
        nameShown,
        h("span", { class: "muted small" }, `${items.length} היגדים${dom.closing ? " · תחום סיום" : ""}`)),
      h("details", { class: "dom-settings" }, h("summary", {}, "⚙ הגדרות התחום (שם, צבע, סדר, מחיקה)"), h("div", { class: "edit-body" },
        h("div", { class: "grid2" },
          field("שם התחום", h("input", { value: dom.name, oninput: (e) => { dom.name = e.target.value; nameShown.textContent = e.target.value || "תחום חדש"; touch(); } })),
          field("צבע", h("select", { onchange: (e) => { dom.color = e.target.value; touch(); draw(); } },
            PALETTE.map((c) => h("option", { value: c, selected: c === dom.color, style: `background:${c}` }, "■ " + c))))),
        h("div", { class: "edit-line checks" },
          h("label", { class: "check", title: "תחום סיום: שדות טקסט בלי ממוצע" },
            h("input", { type: "checkbox", checked: !!dom.closing, onchange: (e) => { dom.closing = e.target.checked; touch(); draw(); } }), "תחום סיום (טקסט, בלי ממוצע)"),
          h("span", { class: "spacer" }),
          h("button", { class: "btn small", onclick: () => move(draft.domains, di, -1) }, "↑ תחום למעלה"),
          h("button", { class: "btn small", onclick: () => move(draft.domains, di, 1) }, "↓ תחום למטה"),
          h("button", {
            class: "btn small danger",
            onclick: () => {
              if (!confirm(`למחוק את התחום "${dom.name}" ואת ${items.length} ההיגדים שבו?`)) return;
              draft.items = draft.items.filter((i) => i.domain !== dom.id);
              draft.domains.splice(di, 1); touch(); draw();
            },
          }, "מחיקת תחום"))
      )),
      h("div", { class: "items-list" }, items.map((it, k) => itemRow(it, k + 1))),
      h("div", { class: "edit-line" },
        h("button", {
          class: "btn small",
          onclick: () => {
            const it = { id: rid("i"), domain: dom.id, type: dom.closing ? "text" : "scale", text: "", low: "", high: "", note: "", flag: false, assistant: false, active: true };
            draft.items.push(it); openItems.add(it.id); touch(); draw();
          },
        }, "+ היגד")));
  }

  function validate() {
    const problems = [];
    if (!draft.domains.length) problems.push("אין אף תחום");
    draft.domains.forEach((d) => { if (!d.name.trim()) problems.push("יש תחום בלי שם"); });
    draft.items.forEach((i) => {
      if (!i.text.trim()) problems.push("יש היגד בלי ניסוח");
      if (i.type === "scale" && i.active !== false && (!(i.low || "").trim() || !(i.high || "").trim()))
        problems.push(`להיגד "${i.text}" חסר עוגן ל-1 או ל-5`);
    });
    return problems;
  }

  async function publish() {
    const problems = validate();
    if (problems.length && !confirm("נמצאו נקודות לבדיקה:\n- " + [...new Set(problems)].slice(0, 6).join("\n- ") + "\n\nלפרסם בכל זאת?")) return;
    if (!confirm(`לפרסם את הטופס כגרסה ${base.version + 1}? מילויים חדשים ישתמשו בו, מילויים קיימים נשארים בגרסה שלהם.`)) return;
    try {
      const saved = await publishForm({ ...draft, version: base.version }, ctx.profile.email);
      ctx.setCurrentForm(saved);
      toast(`פורסמה גרסה ${saved.version}`);
      formEditorView(root, ctx);
    } catch (e) { toast(e.message, "err"); }
  }

  function draw() {
    clear(body);
    body.append(
      h("div", { class: "card" },
        h("h3", {}, "נוסח כללי"),
        h("label", {}, "חלון התבוננות", h("input", { value: draft.settings.windowText, oninput: (e) => { draft.settings.windowText = e.target.value; touch(); } })),
        h("label", {}, "הסבר הסולם (מוצג בראש כל תחום)", h("textarea", { rows: 3, oninput: (e) => { draft.settings.scaleText = e.target.value; touch(); } }, draft.settings.scaleText))),
      ...draft.domains.map(domainCard),
      h("button", {
        class: "btn",
        onclick: () => {
          draft.domains.push({ id: rid("d"), name: "תחום חדש", color: PALETTE[draft.domains.length % PALETTE.length] });
          touch(); draw();
        },
      }, "+ תחום")
    );
  }

  root.append(
    h("div", { class: "toolbar" },
      h("h2", {}, `עריכת השאלון · גרסה נוכחית ${base.version}`), badge,
      h("span", { class: "spacer" }),
      h("button", { class: "btn", onclick: () => { draft.items.forEach((i) => openItems.add(i.id)); draw(); } }, "פתיחת כל ההיגדים"),
      h("button", { class: "btn", onclick: () => { openItems.clear(); draw(); } }, "סגירת כל ההיגדים"),
      h("button", {
        class: "btn",
        onclick: () => { if (confirm("להחליף את הטיוטה בתבנית הפיילוט המקורית? (לא משפיע עד פרסום)")) { const s = seedForm(); draft = { settings: s.settings, domains: s.domains, items: s.items }; touch(); draw(); } },
      }, "שחזור תבנית הפיילוט"),
      h("button", {
        class: "btn",
        onclick: () => { if (!dirty || confirm("לבטל את כל השינויים שלא פורסמו?")) formEditorView(root, ctx); },
      }, "ביטול שינויים"),
      h("button", { class: "btn primary", onclick: publish }, "פרסום גרסה חדשה")
    ),
    h("p", { class: "muted" }, "השינויים נשמרים רק בפרסום. הציון תמיד 1–5 (5 = יותר עצמאות והשתתפות), ו-0 = לא רלוונטי. פריטי כן/לא וטקסט לא נכנסים לממוצע. פרטי הילד בראש הטופס קבועים: גן, מספר, גיל, תאריך, תפקיד."),
    body
  );
  draw();
}
