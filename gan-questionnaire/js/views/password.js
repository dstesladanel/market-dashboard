import { h, clear, toast } from "../ui.js";
import { auth, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "../fb.js";

// שינוי סיסמה עצמי: מאמתים את הסיסמה הנוכחית ואז מחליפים
export async function passwordView(root, ctx) {
  clear(root);
  const cur = h("input", { type: "password", autocomplete: "current-password", required: true, dir: "ltr" });
  const nw = h("input", { type: "password", autocomplete: "new-password", required: true, minlength: 6, dir: "ltr" });
  const again = h("input", { type: "password", autocomplete: "new-password", required: true, minlength: 6, dir: "ltr" });
  const err = h("p", { class: "error", hidden: true });
  root.append(h("form", {
    class: "card", style: "max-width:420px",
    onsubmit: async (ev) => {
      ev.preventDefault();
      err.hidden = true;
      if (nw.value !== again.value) { err.textContent = "הסיסמאות החדשות לא זהות"; err.hidden = false; return; }
      try {
        const user = auth.currentUser;
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, cur.value));
        await updatePassword(user, nw.value);
        toast("הסיסמה שונתה");
        location.hash = "#/";
      } catch (e) {
        err.textContent = ["auth/invalid-credential", "auth/wrong-password"].includes(e.code) ? "הסיסמה הנוכחית שגויה" : (e.message || "שגיאה");
        err.hidden = false;
      }
    },
  },
    h("h2", {}, "שינוי סיסמה"),
    h("p", { class: "muted" }, ctx.profile.email),
    h("label", {}, "סיסמה נוכחית", cur),
    h("label", {}, "סיסמה חדשה (לפחות 6 תווים)", nw),
    h("label", {}, "הקלדה חוזרת", again),
    err,
    h("button", { class: "btn primary", type: "submit" }, "שינוי סיסמה")));
}
