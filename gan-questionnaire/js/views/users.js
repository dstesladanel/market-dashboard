import { h, clear, toast, ROLE_LABELS, GARDEN_TYPES } from "../ui.js";
import { listUsers, saveUser, deleteUser, saveGarden, deleteGarden } from "../store.js";
import {
  firebaseConfig, initializeApp, deleteApp, getAuth, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signOut, auth,
} from "../fb.js";
import { errText } from "./login.js";

export async function usersView(root, ctx) {
  clear(root);
  const users = (await listUsers()).sort((a, b) => a.email.localeCompare(b.email));
  const gname = (id) => (ctx.gardens.find((g) => g.id === id) || { name: "?" }).name;

  // יצירת חשבון Auth דרך אפליקציה משנית, כדי שהמנהלת לא תתנתק מהחשבון שלה
  async function createAccount(email) {
    const sec = initializeApp(firebaseConfig, "sec" + Date.now());
    const sa = getAuth(sec);
    try {
      const tmp = crypto.randomUUID() + "Aa1!";
      await createUserWithEmailAndPassword(sa, email, tmp);
      await sendPasswordResetEmail(sa, email);
      await signOut(sa);
      return "created";
    } catch (e) {
      if (e.code === "auth/email-already-in-use") return "exists";
      throw e;
    } finally { await deleteApp(sec); }
  }

  const email = h("input", { type: "email", dir: "ltr", placeholder: "אימייל", required: true });
  const name = h("input", { placeholder: "שם (לא חובה)" });
  const role = h("select", {}, ["teacher", "assistant", "admin"].map((r) => h("option", { value: r }, ROLE_LABELS[r])));
  const gBoxes = ctx.gardens.map((g) => h("label", { class: "check" }, h("input", { type: "checkbox", value: g.id }), g.name));

  const addForm = h("form", {
    class: "card",
    onsubmit: async (ev) => {
      ev.preventDefault();
      const gs = gBoxes.map((l) => l.querySelector("input")).filter((i) => i.checked).map((i) => i.value);
      try {
        const res = await createAccount(email.value.trim());
        await saveUser({ email: email.value, name: name.value, role: role.value, gardens: gs });
        toast(res === "created" ? "המשתמשת נוצרה ונשלח אליה קישור להגדרת סיסמה" : "החשבון כבר קיים. ההרשאות עודכנו");
        usersView(root, ctx);
      } catch (e) { toast(errText(e), "err"); }
    },
  },
    h("h3", {}, "הוספת משתמשת"),
    h("div", { class: "grid2" }, h("label", {}, "אימייל", email), h("label", {}, "שם", name), h("label", {}, "תפקיד", role)),
    h("div", { class: "chips" }, ctx.gardens.length ? gBoxes : h("span", { class: "muted" }, "יש להוסיף גנים קודם")),
    h("button", { class: "btn primary", type: "submit" }, "הוספה ושליחת קישור")
  );

  const table = h("table", { class: "table" },
    h("thead", {}, h("tr", {}, ["אימייל", "שם", "תפקיד", "גנים", ""].map((t) => h("th", {}, t)))),
    h("tbody", {}, users.map((u) => h("tr", {},
      h("td", { dir: "ltr" }, u.email), h("td", {}, u.name), h("td", {}, ROLE_LABELS[u.role]),
      h("td", {}, u.role === "admin" ? "כולם" : (u.gardens || []).map(gname).join(", ")),
      h("td", { class: "actions" },
        h("button", { class: "btn small", onclick: async () => {
          try { await sendPasswordResetEmail(auth, u.email); toast("נשלח קישור לאיפוס סיסמה"); } catch (e) { toast(errText(e), "err"); }
        } }, "איפוס סיסמה"),
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

  root.append(
    h("h2", {}, "גנים"), gForm, gTable,
    h("h2", {}, "משתמשות והרשאות"),
    h("p", { class: "muted" }, "גננת וסייעת רואות רק את הגנים ששויכו להן. מנהלת רואה סיכומים בלבד. אין חשבון להורים."),
    addForm, table
  );
}
