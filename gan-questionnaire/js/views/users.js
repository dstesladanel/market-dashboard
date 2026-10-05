import { h, clear, toast, ROLE_LABELS, GARDEN_TYPES } from "../ui.js";
import { listUsers, saveUser, deleteUser, saveGarden, deleteGarden } from "../store.js";
import {
  firebaseConfig, initializeApp, deleteApp, getAuth, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signOut, auth,
} from "../fb.js";
import { errText } from "./login.js";

// פרטי הכניסה האחרונים שנוצרו. מוצגים פעם אחת כדי שהמנהלת תשלח אותם, ולא נשמרים בשום מקום.
let share = null;

export async function usersView(root, ctx) {
  clear(root);
  const users = (await listUsers()).sort((a, b) => a.email.localeCompare(b.email));
  const gname = (id) => (ctx.gardens.find((g) => g.id === id) || { name: "?" }).name;

  // יצירת חשבון Auth עם סיסמה שהמנהלת קבעה, דרך אפליקציה משנית כדי שלא תתנתק מהחשבון שלה.
  // לא נשלח שום מייל. מחזיר "created" או "exists" (חשבון קיים ב-Firebase).
  async function createAccount(email, password) {
    const sec = initializeApp(firebaseConfig, "sec" + Date.now());
    const sa = getAuth(sec);
    try {
      await createUserWithEmailAndPassword(sa, email, password);
      await signOut(sa);
      return "created";
    } catch (e) {
      if (e.code === "auth/email-already-in-use") return "exists";
      throw e;
    } finally { await deleteApp(sec); }
  }

  // סיסמה קריאה להקלדה בטלפון, בלי תווים מבלבלים (0/O, 1/l/I)
  const genPassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyz23456789";
    const pick = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (v) => chars[v % chars.length]).join("");
    return `${pick(4)}-${pick(4)}-${pick(3)}`;
  };
  const siteUrl = () => location.origin + location.pathname.replace(/index\.html$/, "");

  const email = h("input", { type: "email", dir: "ltr", placeholder: "אימייל", required: true });
  const name = h("input", { placeholder: "שם (לא חובה)" });
  const tempPass = h("input", { type: "text", dir: "ltr", value: genPassword(), required: true, minlength: 6, autocomplete: "off" });
  const role = h("select", {}, ["teacher", "assistant", "admin"].map((r) => h("option", { value: r }, ROLE_LABELS[r])));
  const gBoxes = ctx.gardens.map((g) => h("label", { class: "check" }, h("input", { type: "checkbox", value: g.id }), g.name));

  const addForm = h("form", {
    class: "card",
    onsubmit: async (ev) => {
      ev.preventDefault();
      const gs = gBoxes.map((l) => l.querySelector("input")).filter((i) => i.checked).map((i) => i.value);
      try {
        const pw = tempPass.value.trim();
        if (pw.length < 6) { toast("הסיסמה חייבת להיות לפחות 6 תווים", "err"); return; }
        const addr = email.value.trim();
        const res = await createAccount(addr, pw);
        await saveUser({ email: addr, name: name.value, role: role.value, gardens: gs });
        if (res === "exists") {
          toast("החשבון כבר קיים ב-Firebase, וההרשאות עודכנו. הסיסמה לא שונתה.", "err");
          share = null;
        } else {
          share = { email: addr, name: name.value.trim(), password: pw, url: siteUrl() };
          toast("המשתמשת נוצרה. ההודעה לוואטסאפ מוכנה למטה.");
        }
        usersView(root, ctx);
      } catch (e) { toast(errText(e), "err"); }
    },
  },
    h("h3", {}, "הוספת משתמשת"),
    h("div", { class: "grid2" }, h("label", {}, "אימייל", email), h("label", {}, "שם", name), h("label", {}, "תפקיד", role), h("label", {}, "סיסמה", h("div", { class: "edit-line" }, tempPass,
      h("button", { type: "button", class: "btn small", onclick: () => { tempPass.value = genPassword(); } }, "הגרלה")))),
    h("div", { class: "chips" }, ctx.gardens.length ? gBoxes : h("span", { class: "muted" }, "יש להוסיף גנים קודם")),
    h("p", { class: "muted small" }, "לא נשלח מייל. אחרי ההוספה תופיע הודעה מוכנה לשליחה בוואטסאפ עם הקישור, האימייל והסיסמה."),
    h("button", { class: "btn primary", type: "submit" }, "הוספה")
  );

  const table = h("table", { class: "table" },
    h("thead", {}, h("tr", {}, ["אימייל", "שם", "תפקיד", "גנים", ""].map((t) => h("th", {}, t)))),
    h("tbody", {}, users.map((u) => h("tr", {},
      h("td", { dir: "ltr" }, u.email), h("td", {}, u.name), h("td", {}, h("select", {
        disabled: u.email === ctx.profile.email, title: u.email === ctx.profile.email ? "לא ניתן לשנות את התפקיד של עצמך" : "",
        onchange: async (e) => {
          if (e.target.value === "admin" && !confirm(`להפוך את ${u.email} למנהלת מערך? היא תראה את כל הגנים והתשובות.`)) { e.target.value = u.role; return; }
          await saveUser({ ...u, role: e.target.value }); toast("התפקיד עודכן"); usersView(root, ctx);
        },
      }, Object.entries(ROLE_LABELS).map(([k, v]) => h("option", { value: k, selected: k === u.role }, v)))),
      h("td", {}, u.role === "admin" ? "כולם" : (u.gardens || []).map(gname).join(", ")),
      h("td", { class: "actions" },
        h("button", { class: "btn small", onclick: async () => {
          try { await sendPasswordResetEmail(auth, u.email); toast("נשלח קישור לאיפוס סיסמה"); } catch (e) { toast(errText(e), "err"); }
        } }, "קישור איפוס במייל (לא חובה)"),
        u.email !== ctx.profile.email && h("button", { class: "btn small danger", onclick: async () => {
          if (confirm(`להסיר את ההרשאה של ${u.email}?`)) { await deleteUser(u.email); usersView(root, ctx); }
        } }, "הסרה"))))));

  // ---------- גנים ----------
  const gName = h("input", { placeholder: "שם הגן", required: true });
  const gType = h("select", {}, GARDEN_TYPES.map((t) => h("option", {}, t)));
  const gForm = h("form", {
    class: "toolbar",
    onsubmit: async (ev) => {
      ev.preventDefault();
      await saveGarden({ name: gName.value.trim(), type: gType.value });
      await ctx.reloadGardens(); usersView(root, ctx);
    },
  }, gName, gType, h("button", { class: "btn primary", type: "submit" }, "הוספת גן"));

  const gTable = h("table", { class: "table compact" }, h("tbody", {}, ctx.gardens.map((g) => h("tr", {},
    h("td", {}, h("input", { value: g.name, onchange: async (e) => { await saveGarden({ ...g, name: e.target.value.trim() }); await ctx.reloadGardens(); toast("נשמר"); } })),
    h("td", {}, h("select", { onchange: async (e) => { await saveGarden({ ...g, type: e.target.value }); await ctx.reloadGardens(); toast("נשמר"); } },
      GARDEN_TYPES.map((t) => h("option", { selected: t === g.type }, t)))),
    h("td", {}, h("button", { class: "btn small danger", onclick: async () => {
      if (confirm(`למחוק את הגן ${g.name}? מילויים קיימים לא יימחקו.`)) { await deleteGarden(g.id); await ctx.reloadGardens(); usersView(root, ctx); }
    } }, "מחיקה"))))));

  const shareCard = share && (() => {
    const text = `שלום${share.name ? " " + share.name : ""},\nהקישור לשאלון התפקודי לגני החינוך המיוחד:\n${share.url}\n\nאימייל: ${share.email}\nסיסמה: ${share.password}\n\nמומלץ לשנות את הסיסמה אחרי הכניסה הראשונה (בתפריט העליון: שינוי סיסמה).`;
    return h("div", { class: "card share" },
      h("h3", {}, "הודעה לשליחה בוואטסאפ"),
      h("p", { class: "muted small" }, "הסיסמה מוצגת עכשיו בלבד ואינה נשמרת. אם יאבדו אותה, צריך ליצור את הכניסה מחדש."),
      h("pre", { class: "share-text", dir: "rtl" }, text),
      h("div", { class: "toolbar" },
        h("button", { class: "btn primary", onclick: async () => { try { await navigator.clipboard.writeText(text); toast("הועתק"); } catch { toast("לא ניתן להעתיק. סמנו ידנית", "err"); } } }, "העתקה"),
        h("a", { class: "btn", target: "_blank", rel: "noopener", href: `https://wa.me/?text=${encodeURIComponent(text)}` }, "פתיחה בוואטסאפ"),
        h("button", { class: "btn", onclick: () => { share = null; usersView(root, ctx); } }, "סגירה")));
  })();

  root.append(
    shareCard,
    h("h2", {}, "גנים"), gForm, gTable,
    h("h2", {}, "משתמשות והרשאות"),
    h("p", { class: "muted" }, "גננת וסייעת רואות רק את הגנים ששויכו להן. מנהלת רואה סיכומים בלבד. אין חשבון להורים."),
    addForm, table
  );
}
