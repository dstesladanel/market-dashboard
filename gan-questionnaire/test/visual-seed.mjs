import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import { appJs, authJs, fsJs, configJs } from "./fake-firebase.mjs";
import { seedForm } from "../js/seed.js";
import { computeSummary } from "../js/scoring.js";

const form = { ...seedForm(), version: 1 };
let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
const gardens = { g1: { name: "גן שפתי א", type: "שפתי" }, g2: { name: "גן תקשורת ב", type: "תקשורת" }, g3: { name: "גן עיכוב התפתחותי ג", type: "עיכוב התפתחותי" } };
const summaries = {};
let n = 0;
for (const [g, base] of [["g1", 3.6], ["g2", 2.6], ["g3", 3.1]]) {
  for (let c = 1; c <= 9; c++) {
    for (const [date, lift] of [["2026-01-14", -0.6], ["2026-04-20", 0]]) {
      const answers = {};
      for (const i of form.items) {
        if (i.type === "scale") {
          const bias = i.domain === "E" && g === "g2" ? -0.9 : i.domain === "C" && g === "g1" ? 0.5 : 0;
          answers[i.id] = Math.max(1, Math.min(5, Math.round(base + lift + bias + (rnd() - 0.5) * 3)));
        } else if (i.type === "yesno" && i.flag) answers[i.id] = rnd() < 0.08;
      }
      const sm = computeSummary(form, answers);
      summaries["s" + n++] = { gardenId: g, childCode: String(c), age: 3 + (c % 4), date, formVersion: 1, createdAt: n, domains: sm.domains, flags: sm.flags };
    }
  }
}
const db = {
  gardens, summaries, forms: { f1: form }, config: { bootstrap: { at: 1 }, current: { formId: "f1", version: 1 } },
  users: { "admin@t.il": { email: "admin@t.il", name: "מנהלת", role: "admin", gardens: [] }, "t@t.il": { email: "t@t.il", name: "גננת", role: "teacher", gardens: ["g1"] } },
};
const SH = "/tmp/claude-0/-home-user-market-dashboard/bb8c23c7-3b19-5d69-bf17-137b43a7024b/scratchpad/";
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
const js = (body) => ({ status: 200, contentType: "text/javascript", body });
await p.route("https://www.gstatic.com/firebasejs/**", (r) => { const u = r.request().url(); r.fulfill(js(u.includes("firebase-app") ? appJs : u.includes("firebase-auth") ? authJs : fsJs)); });
await p.route("**/js/firebase-config.js", (r) => r.fulfill(js(configJs)));
await p.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ status: 200, body: "" }));
await p.addInitScript(([d]) => { if (!localStorage.getItem("fakedb")) { localStorage.setItem("fakedb", JSON.stringify(d)); localStorage.setItem("fakeauth", JSON.stringify({ accounts: { "admin@t.il": "x", "t@t.il": "x" }, current: "admin@t.il" })); } }, [db]);
await p.goto("http://127.0.0.1:8099/#/"); await p.waitForSelector(".matrix"); await p.waitForTimeout(300);
await p.screenshot({ path: SH + "v-admin.png", fullPage: true });
await p.goto("http://127.0.0.1:8099/#/admin/garden/g2"); await p.waitForSelector("svg.stacked"); await p.waitForTimeout(300);
await p.screenshot({ path: SH + "v-garden.png", fullPage: true });
await p.goto("http://127.0.0.1:8099/#/admin/child/g2/3"); await p.waitForSelector("svg.lines"); await p.waitForTimeout(300);
await p.screenshot({ path: SH + "v-child.png", fullPage: true });
await b.close();
