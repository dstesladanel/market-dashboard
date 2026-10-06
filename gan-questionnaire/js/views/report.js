import { h, clear, toast } from "../ui.js";
import { getResponse, getForm, listResponses } from "../store.js";
import { buildReport, GENDERS } from "../narrative.js";
import { radar, legend, SERIES_COLORS } from "../charts.js";

// דוח תפקודי מילולי לצוות ולמנהלת.
// הטיוטה נוצרת בדפדפן מתוך התשובות. שם הילד ומגדר מוקלדים כאן בלבד: הם לא נשלחים ולא נשמרים בשום מקום
// (לא ב-Firebase, לא ב-localStorage ולא בשם הקובץ). גם העריכות אינן נשמרות, ולכן מורידים PDF לפני יציאה.
export async function reportView(root, ctx, params) {
  clear(root);
  const resp = await getResponse(params.id);
  if (!resp || resp.status !== "final") {
    root.append(h("div", { class: "card" }, h("p", {}, "אפשר להפיק דוח רק ממילוי שהושלם."), h("a", { class: "btn", href: "#/" }, "חזרה")));
    return;
  }
  const form = await getForm(resp.formId);
  const garden = ctx.gardens.find((g) => g.id === resp.gardenId);
  const admin = ctx.profile.role === "admin";

  // מילוי קודם של אותו ילד, להשוואה
  const same = (await listResponses(resp.gardenId)).filter((r) => r.childCode === resp.childCode && r.status === "final");
  const prevResp = same.filter((r) => r.date < resp.date || (r.date === resp.date && r.createdAt < resp.createdAt))[0] || null;
  const prev = prevResp ? { answers: prevResp.answers || {}, date: prevResp.date } : null;

  const state = { gender: "n", name: "" };
  let dirty = false;
  const backHref = admin ? `#/admin/child/${resp.gardenId}/${encodeURIComponent(resp.childCode)}` : `#/profile/${resp.id}`;

  const warnUnload = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
  window.addEventListener("beforeunload", warnUnload);
  // מנקה את המאזינים כשעוברים מסך
  const cleanup = () => { window.removeEventListener("beforeunload", warnUnload); window.removeEventListener("hashchange", cleanup); window.removeEventListener("beforeprint", fitAll); };
  window.addEventListener("hashchange", cleanup);

  const fitAll = () => root.querySelectorAll(".report textarea").forEach(fit);
  window.addEventListener("beforeprint", fitAll);

  function fit(t) { t.style.height = "auto"; t.style.height = t.scrollHeight + 2 + "px"; }

  // ---------- שלב 1: פרטים להדפסה ----------
  function setup() {
    clear(root);
    const gender = h("select", { onchange: (e) => { state.gender = e.target.value; } },
      Object.entries(GENDERS).map(([k, v]) => h("option", { value: k, selected: state.gender === k }, v)));
    const name = h("input", { value: state.name, placeholder: "לא חובה", maxlength: 60, autocomplete: "off", oninput: (e) => { state.name = e.target.value; } });
    root.append(
      h("div", { class: "toolbar" }, h("a", { class: "btn", href: backHref }, "חזרה"), h("h2", {}, `דוח תפקודי · ילד ${resp.childCode}`)),
      h("div", { class: "card", style: "max-width:560px" },
        h("h3", {}, "פרטים להדפסה (לא חובה)"),
        h("p", { class: "notice" }, "השם והמגדר מיועדים להדפסה בלבד. הם אינם נשמרים בשום מקום, לא במערכת ולא בדפדפן, ויימחקו ברגע שתצאו מהמסך הזה."),
        h("label", {}, "מגדר (להתאמת הניסוח)", gender),
        h("label", {}, "שם הילד/ה (יודפס בראש הדוח)", name),
        h("p", { class: "muted small" }, "בלי מגדר הניסוח הוא בלשון זכר. ניסוח היגדים שנוספו ידנית בעורך השאלון עשוי לדרוש תיקון קטן בלשון נקבה."),
        h("div", { class: "toolbar" },
          h("button", { class: "btn primary", onclick: () => { build(); } }, "יצירת טיוטת דוח"))));
  }

  // ---------- שלב 2: עריכה והדפסה ----------
  let report = null;
  function build() {
    report = buildReport({
      form, answers: resp.answers || {}, gender: state.gender, prev,
      child: { age: resp.age, date: resp.date, fillerRole: resp.fillerRole, gardenName: garden ? garden.name : "", childCode: resp.childCode, formVersion: resp.formVersion },
    });
    dirty = false;
    draw();
  }

  const area = (value, onChange, cls = "") => {
    const t = h("textarea", { class: cls, rows: 1, value, oninput: (e) => { onChange(e.target.value); dirty = true; fit(e.target); } });
    queueMicrotask(() => fit(t));
    return t;
  };

  function bulletList(list) {
    const wrap = h("div", { class: "bl" });
    const render = () => {
      clear(wrap);
      list.forEach((txt, i) => wrap.append(h("div", { class: "brow" },
        h("span", { class: "bul" }, "•"),
        area(txt, (v) => { list[i] = v; }),
        h("button", { class: "icon danger no-print", title: "מחיקה", onclick: () => { list.splice(i, 1); dirty = true; render(); } }, "✕"))));
      wrap.append(h("button", { class: "btn small no-print", onclick: () => { list.push(""); dirty = true; render(); setTimeout(() => wrap.querySelectorAll("textarea")[list.length - 1]?.focus(), 0); } }, "+ הוספת נקודה"));
      wrap.querySelectorAll("textarea").forEach((t) => queueMicrotask(() => fit(t)));
    };
    render();
    return wrap;
  }

  function section(sec) {
    const body = [];
    if (sec.kind === "paragraphs") {
      sec.paragraphs.forEach((p, i) => body.push(area(p, (v) => { sec.paragraphs[i] = v; }, "para")));
    } else {
      if (sec.intro !== undefined && sec.intro !== "") body.push(area(sec.intro, (v) => { sec.intro = v; }, "para intro"));
      if (sec.kind === "groups") {
        for (const grp of sec.groups) {
          // פסקה רציפה לתחום (prose) או רשימת נקודות
          body.push(h("div", { class: "grp" }, h("div", { class: "grp-title" }, grp.title),
            grp.prose ? area(grp.bullets[0] || "", (v) => { grp.bullets[0] = v; }, "para") : bulletList(grp.bullets)));
        }
        if (!sec.groups.length) body.push(h("div", { class: "no-print muted small" }, "אין תוכן לסעיף זה."));
      } else {
        body.push(bulletList(sec.bullets));
      }
    }
    return h("section", { class: "rsec" + (sec.id === "notes" ? " rnotes" : "") }, h("h3", {}, sec.title), body);
  }

  function draw() {
    clear(root);
    const nameLine = state.name.trim() ? h("div", { class: "rname" }, `שם: ${state.name.trim()}`) : null;
    const labels = report.radar.labels;
    const series = [
      ...(report.radar.prevValues ? [{ name: "קודם", color: "#9aa3b2", dashed: true, values: report.radar.prevValues }] : []),
      { name: "אחרון", color: SERIES_COLORS[0], values: report.radar.values },
    ];

    root.append(
      h("div", { class: "toolbar no-print" },
        h("a", { class: "btn", href: backHref }, "חזרה"),
        h("h2", {}, `דוח תפקודי · ילד ${resp.childCode}`),
        h("span", { class: "spacer" }),
        h("button", { class: "btn", onclick: () => { if (!dirty || confirm("שינוי הפרטים ייצור את הטיוטה מחדש ויימחקו העריכות. להמשיך?")) { dirty = false; setup(); } } }, "שינוי מגדר ושם"),
        h("button", {
          class: "btn primary",
          onclick: () => {
            const old = document.title;
            document.title = `דוח-תפקודי-${resp.childCode}-${resp.date}`; // בלי שם הילד: שם הקובץ משתמש במספר בלבד
            fitAll();
            window.print();
            setTimeout(() => { document.title = old; }, 1500);
          },
        }, "הורדה / הדפסה (PDF)")),
      h("p", { class: "notice no-print" }, "הטקסט הוא טיוטה שנוצרה מהנתונים: כל פסקה ונקודה ניתנות לעריכה, מחיקה והוספה. בחלון ההדפסה יש לבחור \"שמירה כ-PDF\". העריכות, השם והמגדר אינם נשמרים במערכת."),
      h("article", { class: "report", dir: "rtl" },
        h("header", { class: "rhead" },
          h("div", { class: "rtitle" }, "דוח תפקודי לצוות הגן"),
          h("div", { class: "rsub" }, "מערך גני החינוך המיוחד · חריש"),
          nameLine,
          h("div", { class: "rage" }, report.ageLine),
          h("table", { class: "rmeta" }, h("tbody", {}, chunk(report.meta, 3).map((row) =>
            h("tr", {}, row.flatMap(([k, v]) => [h("th", {}, k), h("td", {}, v)])))))),
        h("section", { class: "rprofile" },
          h("div", { class: "rchart" },
            labels.length >= 3 ? [radar(labels, series, { size: 300 }), legend([{ label: "מילוי נוכחי", color: SERIES_COLORS[0] }, ...(report.radar.prevValues ? [{ label: "מילוי קודם", color: "#9aa3b2" }] : [])])] : null),
          h("table", { class: "rdoms" },
            h("thead", {}, h("tr", {}, h("th", {}, "תחום"), h("th", {}, "ממוצע"), h("th", {}, "פריטים"))),
            h("tbody", {}, report.domains.map((d) => h("tr", {},
              h("td", {}, h("span", { class: "sw", style: `background:${d.color}` }), d.name),
              h("td", { class: "num" }, d.avg != null ? d.avg.toFixed(1) : "—"),
              h("td", { class: "num" }, `${d.n}/${d.total}`)))))),
        ...report.sections.map(section),
        h("footer", { class: "rfoot" }, h("p", {}, report.footer), h("div", { class: "sign" }, "חתימה: ____________________   תאריך: ____________"))));
    // התאמת גובה אחרי שהמסך צויר
    setTimeout(fitAll, 0);
  }

  setup();
}

const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };
