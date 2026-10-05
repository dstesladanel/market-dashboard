import { h, clear, toast, todayISO, FILLER_ROLES } from "../ui.js";
import {
  getForm, getResponse, createResponse, updateResponse, listResponses, finalizeResponse,
} from "../store.js";
import { computeSummary, itemsForRole, answeredCount } from "../scoring.js";

// מסך 0 = פרטי מילוי. אחריו מסך לכל תחום, ובסוף שדות הסיום.
function buildSteps(form, role) {
  const visible = itemsForRole(form, role);
  const steps = [{ kind: "header" }];
  for (const d of form.domains) {
    const items = visible.filter((i) => i.domain === d.id);
    if (items.length) steps.push({ kind: "domain", domain: d, items });
  }
  return steps;
}

export async function fillView(root, ctx, params, search) {
  clear(root);
  const { profile, gardens } = ctx;
  const mine = gardens.filter((g) => profile.gardens.includes(g.id));
  const isNew = params.id === "new";
  let step = parseInt(params.step || "0", 10) || 0;

  let resp, form;
  if (isNew) {
    form = await ctx.currentForm();
    const q = new URLSearchParams(search || "");
    const g = localStorage.getItem("gan.activeGarden");
    resp = {
      gardenId: mine.some((x) => x.id === g) ? g : mine[0] && mine[0].id,
      childCode: q.get("code") || "",
      age: "", date: todayISO(),
      fillerRole: profile.role === "assistant" ? "סייעת" : "גננת",
      formId: form.id, formVersion: form.version, answers: {},
    };
  } else {
    resp = await getResponse(params.id);
    if (!resp) { root.append(h("div", { class: "card" }, "המילוי לא נמצא")); return; }
    if (resp.status === "final") { location.hash = `#/profile/${resp.id}`; return; }
    form = await getForm(resp.formId);
  }
  if (!resp.gardenId) { root.append(h("div", { class: "card" }, "לא שויכת לגן.")); return; }

  const steps = buildSteps(form, profile.role);
  if (step >= steps.length) step = steps.length - 1;
  const answers = resp.answers || (resp.answers = {});
  const canFinish = profile.role === "teacher";
  const home = canFinish ? "#/children" : "#/";

  // ---------- שמירה אוטומטית ----------
  const state = h("span", { class: "save-state" }, "");
  let timer;
  const saveNow = async () => {
    clearTimeout(timer);
    if (!resp.id) return;
    try { await updateResponse(resp.id, { answers }); state.textContent = "נשמר"; }
    catch (e) { state.textContent = "שגיאת שמירה"; toast(e.message, "err"); }
  };
  const scheduleSave = () => {
    state.textContent = "שומר…";
    clearTimeout(timer);
    timer = setTimeout(saveNow, 700);
  };
  window.__fillFlush = saveNow;

  const go = async (n) => { await saveNow(); location.hash = `#/fill/${resp.id}/${n}`; };

  // ---------- שורת התקדמות ----------
  const progress = h("div", { class: "progress" },
    steps.map((s, i) => h("span", {
      class: "dot" + (i === step ? " on" : i < step ? " done" : ""),
      title: s.kind === "header" ? "פרטי מילוי" : s.domain.name,
    }))
  );
  root.append(progress);

  // ---------- מסך פרטי מילוי ----------
  if (steps[step].kind === "header") {
    let existing = [];
    const hint = h("p", { class: "muted hint" });
    const code = h("input", {
      value: resp.childCode, required: true, dir: "ltr", disabled: !!resp.id,
      placeholder: "למשל 14", maxlength: 20, autocomplete: "off",
    });
    const gardenSel = h("select", { disabled: !!resp.id || mine.length === 1 },
      mine.map((g) => h("option", { value: g.id, selected: g.id === resp.gardenId }, g.name)));
    const age = h("select", {}, [h("option", { value: "" }, "בחרו"), ...[3, 4, 5, 6].map((a) =>
      h("option", { value: a, selected: String(resp.age) === String(a) }, a))]);
    const date = h("input", { type: "date", value: resp.date, required: true });
    const role = h("select", {}, FILLER_ROLES.map((r) =>
      h("option", { value: r, selected: r === resp.fillerRole }, r)));

    const showHint = async () => {
      if (resp.id || !code.value.trim()) { hint.textContent = ""; return; }
      existing = await listResponses(gardenSel.value);
      const n = existing.filter((r) => r.childCode === code.value.trim()).length;
      hint.textContent = n ? `קיימים ${n} מילויים קודמים למספר זה. המילוי הזה יתווסף להשוואה.` : "מספר חדש בגן.";
    };
    code.addEventListener("change", showHint);
    gardenSel.addEventListener("change", showHint);

    root.append(
      h("div", { class: "card" },
        h("h2", {}, "פרטי המילוי"),
        h("p", { class: "muted" }, form.settings.windowText),
        h("p", { class: "notice" }, "אין להקליד שם, תעודת זהות או תאריך לידה. רק המספר הפנימי שהגן קבע."),
        h("div", { class: "grid2" },
          h("label", {}, "גן", gardenSel),
          h("label", {}, "מספר ילד פנימי", code),
          h("label", {}, "גיל בשנים", age),
          h("label", {}, "תאריך מילוי", date),
          h("label", {}, "תפקיד הממלא", role)
        ),
        hint,
        h("div", { class: "nav" },
          h("span", {}),
          h("button", {
            class: "btn primary",
            onclick: async () => {
              if (!code.value.trim() || !age.value || !date.value) {
                toast("יש למלא מספר ילד, גיל ותאריך", "err"); return;
              }
              const head = {
                age: parseInt(age.value, 10), date: date.value, fillerRole: role.value,
              };
              if (!resp.id) {
                resp.id = await createResponse({
                  gardenId: gardenSel.value, childCode: code.value.trim(), formId: form.id,
                  formVersion: form.version, createdBy: profile.email, ...head,
                });
              } else {
                await updateResponse(resp.id, head);
              }
              location.hash = `#/fill/${resp.id}/1`;
            },
          }, steps.length > 1 ? "המשך" : "שמירה")
        )
      )
    );
    return;
  }

  // ---------- מסך תחום ----------
  const s = steps[step];
  const last = step === steps.length - 1;
  const scaleCtl = (item) => {
    const wrap = h("div", { class: "seg-row", role: "radiogroup" });
    const paint = () => [...wrap.querySelectorAll("button")].forEach((b) =>
      b.setAttribute("aria-pressed", String(answers[item.id] === Number(b.dataset.v))));
    for (const v of [1, 2, 3, 4, 5, 0]) {
      wrap.append(h("button", {
        type: "button", class: "seg" + (v === 0 ? " zero" : ""), "data-v": v, role: "radio",
        title: v === 0 ? "לא רלוונטי / לא נצפה" : String(v),
        onclick: () => {
          if (answers[item.id] === v) delete answers[item.id]; else answers[item.id] = v;
          paint(); scheduleSave(); refreshCount();
        },
      }, v === 0 ? "0 לא רלוונטי" : String(v)));
    }
    paint();
    return h("div", {}, wrap,
      item.low || item.high
        ? h("div", { class: "anchors" },
            h("span", {}, "1 · " + (item.low || "")), h("span", {}, "5 · " + (item.high || "")))
        : null);
  };
  const yesnoCtl = (item) => {
    const wrap = h("div", { class: "seg-row" });
    const paint = () => [...wrap.querySelectorAll("button")].forEach((b) =>
      b.setAttribute("aria-pressed", String(answers[item.id] === (b.dataset.v === "yes"))));
    for (const [v, label] of [["yes", "כן"], ["no", "לא"]]) {
      wrap.append(h("button", {
        type: "button", class: "seg wide", "data-v": v,
        onclick: () => {
          const val = v === "yes";
          if (answers[item.id] === val) delete answers[item.id]; else answers[item.id] = val;
          paint(); scheduleSave(); refreshCount();
        },
      }, label));
    }
    paint();
    return wrap;
  };
  const textCtl = (item) => h("textarea", {
    rows: 2, maxlength: 240, placeholder: "משפט קצר, בלי שמות",
    oninput: (e) => { answers[item.id] = e.target.value; scheduleSave(); refreshCount(); },
  }, answers[item.id] || "");

  const counter = h("span", { class: "muted" });
  const refreshCount = () => {
    counter.textContent = `${answeredCount(s.items, answers)} מתוך ${s.items.length} נענו במסך זה`;
  };

  const cards = s.items.map((item) => h("div", { class: "item" },
    h("div", { class: "item-text" }, item.text),
    item.note ? h("div", { class: "item-note" }, item.note) : null,
    item.type === "scale" ? scaleCtl(item) : item.type === "yesno" ? yesnoCtl(item) : textCtl(item)
  ));

  const finish = async () => {
    await saveNow();
    const all = itemsForRole(form, "teacher").filter((i) => i.type !== "text");
    const missing = all.length - answeredCount(all, answers);
    if (missing && !confirm(`${missing} פריטים לא נענו ולא ייכנסו לממוצע. לסיים בכל זאת?`)) return;
    const summary = computeSummary(form, answers);
    await finalizeResponse({ ...resp }, answers, summary);
    toast("המילוי הושלם");
    location.hash = `#/profile/${resp.id}`;
  };

  root.append(
    h("div", { class: "card", style: `border-top:6px solid ${s.domain.color}` },
      h("div", { class: "toolbar" },
        h("h2", {}, s.domain.name),
        h("span", { class: "spacer" }), state),
      s.domain.closing ? null : h("p", { class: "scale-legend" }, form.settings.scaleText),
      cards,
      h("div", { class: "nav" },
        h("button", { class: "btn", onclick: () => go(step - 1) }, "הקודם"),
        counter,
        last
          ? (canFinish
              ? h("button", { class: "btn primary", onclick: finish }, "סיום והצגת פרופיל")
              : h("button", { class: "btn primary", onclick: async () => { await saveNow(); toast("נשמר"); location.hash = home; } }, "שמירה ויציאה"))
          : h("button", { class: "btn primary", onclick: () => go(step + 1) }, "הבא")
      ),
      h("div", { class: "nav" },
        h("button", { class: "link", onclick: async () => { await saveNow(); toast("נשמר, אפשר להמשיך אחר כך"); location.hash = home; } }, "שמירה והמשך אחר כך")
      )
    )
  );
  refreshCount();
}
