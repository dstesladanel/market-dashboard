import { h, clear, toast } from "../ui.js";
import {
  auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, configured,
} from "../fb.js";
import { bootstrapDone, bootstrap } from "../store.js";

const ERR = {
  "auth/invalid-credential": "אימייל או סיסמה שגויים",
  "auth/wrong-password": "אימייל או סיסמה שגויים",
  "auth/user-not-found": "אימייל או סיסמה שגויים",
  "auth/invalid-email": "כתובת אימייל לא תקינה",
  "auth/weak-password": "הסיסמה קצרה מדי (לפחות 6 תווים)",
  "auth/email-already-in-use": "האימייל כבר רשום. התחברו או בקשו איפוס סיסמה",
  "auth/too-many-requests": "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות",
};
export const errText = (e) => ERR[e.code] || e.message || "שגיאה";

export async function loginView(root) {
  clear(root);
  if (!configured) {
    root.append(
      h("div", { class: "login" },
        h("h1", {}, "שאלון תפקודי · גני חינוך מיוחד"),
        h("p", { class: "error" }, "Firebase עדיין לא מחובר. יש למלא את js/firebase-config.js לפי README.")
      )
    );
    return;
  }
  let setupOpen = false;
  try { setupOpen = !(await bootstrapDone()); } catch { /* נשאר במצב התחברות */ }
  let mode = "login";
  const box = h("div", { class: "login" });
  root.append(box);

  function draw() {
    clear(box);
    const email = h("input", { type: "email", autocomplete: "username", required: true, dir: "ltr" });
    const pass = h("input", { type: "password", autocomplete: mode === "setup" ? "new-password" : "current-password", required: true, dir: "ltr" });
    const name = h("input", { type: "text", autocomplete: "name" });
    const err = h("p", { class: "error", hidden: true });
    const showErr = (e) => { err.textContent = errText(e); err.hidden = false; };

    const form = h("form", {
      onsubmit: async (ev) => {
        ev.preventDefault();
        err.hidden = true;
        try {
          if (mode === "setup") {
            await createUserWithEmailAndPassword(auth, email.value.trim(), pass.value);
            await bootstrap(email.value, name.value.trim());
            location.reload();
          } else {
            await signInWithEmailAndPassword(auth, email.value.trim(), pass.value);
          }
        } catch (e) { showErr(e); }
      },
    },
      mode === "setup" && h("label", {}, "שם", name),
      h("label", {}, "אימייל", email),
      h("label", {}, "סיסמה", pass),
      err,
      h("button", { class: "btn primary wide", type: "submit" }, mode === "setup" ? "הקמת המערכת" : "כניסה")
    );

    box.append(
      h("h1", {}, "שאלון תפקודי · גני חינוך מיוחד"),
      h("p", { class: "muted" }, mode === "setup"
        ? "הקמה ראשונה: החשבון הזה יהיה מנהלת המערך ויקבל את תבנית הפיילוט."
        : "כלי עבודה פנימי. אין בו שמות ילדים או תעודות זהות."),
      form
    );
    if (mode === "login") {
      box.append(h("button", {
        class: "link", type: "button",
        onclick: async () => {
          if (!email.value.trim()) { showErr({ message: "הקלידו אימייל ואז לחצו שוב" }); return; }
          try { await sendPasswordResetEmail(auth, email.value.trim()); toast("נשלח קישור להגדרת סיסמה"); }
          catch (e) { showErr(e); }
        },
      }, "שכחתי סיסמה (שליחת מייל)"));
      box.append(h("p", { class: "muted small" }, "אין לכם סיסמה או שאבדה? פנו למנהלת המערך."));
    }
    box.append(h("p", { class: "muted small build-line" }, "גרסה " + (window.__BUILD || "dev")));
    if (setupOpen) {
      box.append(h("button", {
        class: "link", type: "button",
        onclick: () => { mode = mode === "setup" ? "login" : "setup"; draw(); },
      }, mode === "setup" ? "חזרה לכניסה" : "הקמה ראשונה של המערכת"));
    }
  }
  draw();
}
