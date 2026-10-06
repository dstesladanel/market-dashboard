import { h, clear, toast } from "./ui.js";
import { auth, onAuthStateChanged, signOut, configured } from "./fb.js";
import { getProfile, listGardens, getCurrentForm } from "./store.js";
import { loginView } from "./views/login.js";
import { teacherView, teacherHome, activeGardenId } from "./views/teacher.js";
import { fillView } from "./views/fill.js";
import { profileView } from "./views/profile.js";
import { dashboardView, adminGardenView } from "./views/admin.js";
import { childView } from "./views/child.js";
import { formEditorView } from "./views/formEditor.js";
import { usersView } from "./views/users.js";
import { passwordView } from "./views/password.js";
import { reportView } from "./views/report.js";

const app = document.getElementById("app");
let ctx = null;

async function loadCtx(user) {
  const profile = await getProfile(user.email);
  if (!profile) return { denied: true };
  const c = { profile: { ...profile, email: profile.email }, gardens: [] };
  c.reloadGardens = async () => { c.gardens = await listGardens(); };
  await c.reloadGardens();
  let form = null;
  c.currentForm = async () => (form ||= await getCurrentForm());
  c.setCurrentForm = (f) => { form = f; };
  return c;
}

function shell(main) {
  const p = ctx.profile;
  const nav = p.role === "admin"
    ? [["#/", "תמונת מערך"], ["#/admin/garden", "דשבורד גן"], ["#/admin/form", "עריכת השאלון"], ["#/admin/users", "גנים ומשתמשות"]]
    : p.role === "teacher"
      ? [["#/", "דשבורד הגן"], ["#/children", "הילדים והמילוי"]]
      : [["#/", "הילדים בגן"]];
  const cur = location.hash.split("?")[0] || "#/";
  const isOn = (href) => cur === href || (href !== "#/" && cur.startsWith(href + "/"));
  clear(app).append(
    h("header", { class: "top" },
      h("div", { class: "brand" }, "שאלון תפקודי · גני חינוך מיוחד"),
      h("nav", {}, nav.map(([href, label]) => h("a", { href, class: isOn(href) ? "on" : "" }, label))),
      h("span", { class: "spacer" }),
      h("span", { class: "who" }, `${p.name || p.email}`),
      h("a", { href: "#/password", class: "link nav-link" }, "שינוי סיסמה"),
      h("button", { class: "link", onclick: () => signOut(auth) }, "יציאה")),
    main
  );
}

async function route() {
  if (!ctx) return;
  // שמירת טיוטה ממתינה לפני מעבר מסך
  if (window.__fillFlush) { try { await window.__fillFlush(); } catch { /* ignore */ } window.__fillFlush = null; }
  const [path, search] = (location.hash.slice(1) || "/").split("?");
  const parts = path.split("/").filter(Boolean);
  const main = h("main", { class: "main" }, h("p", { class: "muted" }, "טוען…"));
  shell(main);
  const isAdmin = ctx.profile.role === "admin";
  try {
    if (parts[0] === "password") await passwordView(main, ctx);
    else if (parts[0] === "fill" && !isAdmin) await fillView(main, ctx, { id: parts[1] || "new", step: parts[2] }, search);
    else if (parts[0] === "profile") await profileView(main, ctx, { id: parts[1] });
    else if (parts[0] === "report" && ctx.profile.role !== "assistant") await reportView(main, ctx, { id: parts[1] });
    else if (parts[0] === "child" && ctx.profile.role === "teacher")
      await childView(main, ctx, { gardenId: activeGardenId(ctx), code: decodeURIComponent(parts[1] || ""), mode: "staff" });
    else if (parts[0] === "children" && ctx.profile.role === "teacher") await teacherView(main, ctx);
    else if (parts[0] === "admin" && parts[1] === "garden" && isAdmin) await adminGardenView(main, ctx, { gardenId: parts[2] });
    else if (parts[0] === "admin" && parts[1] === "child" && isAdmin)
      await childView(main, ctx, { gardenId: parts[2], code: decodeURIComponent(parts[3] || ""), mode: "admin" });
    else if (parts[0] === "admin" && parts[1] === "form" && isAdmin) await formEditorView(main, ctx);
    else if (parts[0] === "admin" && parts[1] === "users" && isAdmin) await usersView(main, ctx);
    else if (isAdmin) await dashboardView(main, ctx);
    else if (ctx.profile.role === "teacher") await teacherHome(main, ctx);
    else await teacherView(main, ctx);
  } catch (e) {
    console.error(e);
    clear(main).append(h("div", { class: "card" }, h("p", { class: "error" }, e.message || "שגיאה")));
  }
}

window.addEventListener("hashchange", route);

if (!configured) {
  loginView(app);
} else {
  onAuthStateChanged(auth, async (user) => {
    ctx = null;
    if (!user) { history.replaceState(null, "", location.pathname + "#/"); loginView(app); return; }
    try {
      const c = await loadCtx(user);
      if (c.denied) {
        clear(app).append(h("div", { class: "login" },
          h("h1", {}, "אין הרשאה"),
          h("p", {}, `האימייל ${user.email} לא רשום במערכת. פנו למנהלת המערך.`),
          h("button", { class: "btn", onclick: () => signOut(auth) }, "יציאה")));
        return;
      }
      ctx = c;
      route();
    } catch (e) { toast(e.message, "err"); }
  });
}
