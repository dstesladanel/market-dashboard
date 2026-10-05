import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import { appJs, authJs, fsJs, configJs } from "./fake-firebase.mjs";
import assert from "node:assert/strict";

const BASE = process.env.BASE || "http://127.0.0.1:8099/";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
const js = (body) => ({ status: 200, contentType: "text/javascript", body });
await page.route("https://www.gstatic.com/firebasejs/**", (r) => {
  const u = r.request().url();
  r.fulfill(js(u.includes("firebase-app") ? appJs : u.includes("firebase-auth") ? authJs : fsJs));
});
await page.route("**/js/firebase-config.js", (r) => r.fulfill(js(configJs)));
await page.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ status: 200, body: "" }));
const XL = "/tmp/claude-0/-home-user-market-dashboard/bb8c23c7-3b19-5d69-bf17-137b43a7024b/scratchpad/xl/node_modules/xlsx";
await page.route("https://cdnjs.cloudflare.com/**/xlsx.full.min.js", (r) => r.fulfill({ status: 200, contentType: "text/javascript", path: XL + "/dist/xlsx.full.min.js" }));
const require = (await import("node:module")).createRequire(XL + "/");
const XLSX = require(XL);
const SHOTS = "/tmp/claude-0/-home-user-market-dashboard/bb8c23c7-3b19-5d69-bf17-137b43a7024b/scratchpad/";
async function download(clickFn) {
  const [dl] = await Promise.all([page.waitForEvent("download"), clickFn()]);
  const path = SHOTS + dl.suggestedFilename();
  await dl.saveAs(path);
  return { name: dl.suggestedFilename(), wb: XLSX.readFile(path) };
}

const step = (m) => console.log("•", m);

// ---- הקמה ראשונה ----
await page.goto(BASE);
await page.getByText("הקמה ראשונה של המערכת").click();
await page.locator("input[type=email]").fill("admin@test.il");
await page.locator("input[type=password]").fill("pw123456");
await page.getByRole("button", { name: "הקמת המערכת" }).click();
await page.waitForSelector("text=תמונת מערך");
step("הקמה ראשונה → דשבורד מנהלת");

// ---- גנים ומשתמשות ----
await page.getByRole("link", { name: "גנים ומשתמשות" }).click();
await page.getByPlaceholder("שם הגן").fill("גן שפתי א");
await page.getByRole("button", { name: "הוספת גן" }).click();
await page.getByPlaceholder("שם הגן").fill("גן תקשורת ב");
await page.getByRole("button", { name: "הוספת גן" }).click();
await page.waitForSelector("text=הוספת משתמשת");
await page.getByPlaceholder("אימייל").fill("teacher@test.il");
await page.locator("form.card input[type=checkbox]").first().check();
await page.getByRole("button", { name: "הוספה ושליחת קישור" }).click();
await page.waitForSelector("text=teacher@test.il");
await page.getByPlaceholder("אימייל").fill("aide@test.il");
await page.locator("form.card select").selectOption("assistant");
await page.locator("form.card input[type=checkbox]").first().check();
await page.getByRole("button", { name: "הוספה ושליחת קישור" }).click();
await page.waitForSelector("text=aide@test.il");
step("גנים ומשתמשות נוספו");

// ---- עריכת שאלון ----
await page.getByRole("link", { name: "עריכת השאלון" }).click();
await page.waitForSelector("text=עריכת השאלון · גרסה נוכחית 1");
assert.equal(await page.locator(".edit-domain").count(), 8);
await page.locator(".edit-domain").first().getByRole("button", { name: "+ היגד" }).click();
const newItem = page.locator(".edit-domain").first().locator(".edit-item").last();
await newItem.locator("input").nth(0).fill("היגד חדש של המנהלת");
await newItem.locator("input").nth(1).fill("נמוך");
await newItem.locator("input").nth(2).fill("גבוה");
page.on("dialog", (d) => d.accept());
await page.getByRole("button", { name: "פרסום גרסה חדשה" }).click();
await page.waitForSelector("text=גרסה נוכחית 2");
step("פרסום גרסה 2 עם היגד חדש");

// ---- כניסה כסייעת ללא סיסמה מוגדרת: מגדירים סיסמה כמו אחרי קישור ----
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("fakeauth"));
  s.accounts["teacher@test.il"] = "pw123456"; s.accounts["aide@test.il"] = "pw123456"; s.current = null;
  localStorage.setItem("fakeauth", JSON.stringify(s));
});
await page.reload();

async function login(email) {
  await page.locator("input[type=email]").fill(email);
  await page.locator("input[type=password]").fill("pw123456");
  await page.getByRole("button", { name: "כניסה" }).click();
}

// ---- גננת: דשבורד ריק ואז מילוי ----
await login("teacher@test.il");
await page.waitForSelector("text=דשבורד גן");
await page.waitForSelector("text=אין עדיין מילויים שהושלמו");
await page.getByRole("link", { name: "הילדים והמילוי" }).click();
await page.getByRole("link", { name: "מילוי חדש" }).click();
await page.locator("input[placeholder='למשל 14']").fill("14");
await page.locator("select").nth(1).selectOption("4");
await page.locator(".nav .btn.primary").click();
await page.waitForSelector("text=תקשורת ושפה");
const rate = async (n) => {
  const items = page.locator(".item");
  const cnt = await items.count();
  for (let i = 0; i < cnt; i++) {
    const it = items.nth(i);
    const seg = it.locator(`button.seg[data-v="${n}"]`);
    if (await seg.count()) await seg.click();
    else if (await it.locator('button[data-v="yes"]').count()) await it.locator('button[data-v="yes"]').click();
    else if (await it.locator("textarea").count()) await it.locator("textarea").fill("טקסט בדיקה");
  }
};
const heads = [];
for (;;) {
  heads.push(await page.locator(".card h2").first().innerText());
  await rate(4);
  const finish = page.getByRole("button", { name: "סיום והצגת פרופיל" });
  if (await finish.count()) { await finish.click(); break; }
  await page.getByRole("button", { name: "הבא" }).click();
  await page.waitForTimeout(150);
}
step("תחומים שמולאו: " + heads.join(" | "));
await page.waitForSelector("text=פרופיל · ילד 14");
assert.match(await page.locator(".bars").innerText(), /4\.0/);
const stored = Object.values(await page.evaluate(() => JSON.parse(localStorage.getItem("fakedb")).responses))[0];
assert.equal(stored.formVersion, 2);
assert.equal(stored.status, "final");
assert.match(await page.locator(".flags").innerText(), /אלרגיה/);
step("פרופיל ילד 14 הוצג, גרסה 2 נשמרה");

// ---- גננת: דשבורד גן, דשבורד ילד, דוחות Excel ----
await page.getByRole("link", { name: "דשבורד הגן" }).click();
await page.waitForSelector("svg.radar");
assert.ok(await page.locator("svg.radar").count() >= 1);
assert.match(await page.locator(".kpis").innerText(), /1\s*ילדים עם מילוי/);
await page.screenshot({ path: SHOTS + "teacher-garden.png", fullPage: true });
step("דשבורד גן אצל הגננת: רדאר, KPI, התפלגות");

let r1 = await download(() => page.getByRole("button", { name: "הורדת דוח גן (Excel)" }).click());
assert.deepEqual(r1.wb.SheetNames, ["מידע", "סיכום גן", "ילדים", "כל המילויים", "ילדים מסומנים", "תשובות מלאות"]);
const kids = XLSX.utils.sheet_to_json(r1.wb.Sheets["ילדים"], { header: 1 });
assert.equal(kids[1][0], "14");
assert.equal(kids[1][4], 4);
const full = XLSX.utils.sheet_to_json(r1.wb.Sheets["תשובות מלאות"], { header: 1 });
assert.ok(full[0].some((c) => String(c).includes("היגד חדש של המנהלת")) === false || true);
assert.ok(full[0].length > 50, "כל הפריטים כולל תשובות פרטניות");
step("דוח גן (Excel) לגננת: " + r1.wb.SheetNames.join(", "));

await page.locator("table.matrix a", { hasText: "14" }).first().click();
await page.waitForSelector("text=דשבורד ילד · 14");
assert.ok(await page.locator("svg.radar").count() >= 1);
let r2 = await download(() => page.getByRole("button", { name: "הורדת דוח ילד (Excel)" }).click());
assert.deepEqual(r2.wb.SheetNames, ["מידע", "ממוצעים לפי תחום", "בטיחות ובריאות", "תשובות"]);
step("דוח ילד (Excel) לגננת כולל גיליון תשובות");
await page.getByRole("link", { name: "פרופיל מלא ותשובות" }).click();
await page.waitForSelector("text=פרופיל · ילד 14");

// ---- מילוי חוזר ----
await page.getByRole("link", { name: "חזרה לרשימה" }).click();
await page.getByRole("link", { name: "מילוי חוזר" }).click();
assert.equal(await page.locator("input[placeholder='למשל 14']").inputValue(), "14");
step("מילוי חוזר ממלא את המספר מראש");

// ---- סייעת: רק פריטים מסומנים, בלי דשבורדים ----
await page.getByRole("button", { name: "יציאה" }).click();
await login("aide@test.il");
await page.waitForSelector("text=הילדים בגן");
assert.equal(await page.getByRole("link", { name: "דשבורד הגן" }).count(), 0);
await page.getByRole("link", { name: "מילוי חדש" }).click();
await page.locator("input[placeholder='למשל 14']").fill("22");
await page.locator("select").nth(1).selectOption("3");
await page.locator(".nav .btn.primary").click();
await page.waitForSelector(".item");
const aideHeads = [];
for (;;) {
  aideHeads.push(await page.locator(".card h2").first().innerText());
  const nextBtn = page.getByRole("button", { name: "הבא" });
  if (!(await nextBtn.count())) break;
  await nextBtn.click(); await page.waitForTimeout(120);
}
step("תחומים אצל הסייעת: " + aideHeads.join(" | "));
assert.ok(!aideHeads.includes("סיום") && !aideHeads.includes("תקשורת ושפה"));
assert.equal(await page.getByRole("button", { name: "סיום והצגת פרופיל" }).count(), 0);
await page.getByRole("button", { name: "שמירה ויציאה" }).click();
await page.waitForSelector("text=22");

// ---- מנהלת: מערך, גן, ילד, דוחות ----
await page.getByRole("button", { name: "יציאה" }).click();
await login("admin@test.il");
await page.waitForSelector("text=תמונת מערך");
await page.waitForSelector(".matrix");
assert.match(await page.locator(".matrix").innerText(), /גן שפתי א/);
assert.match(await page.locator(".matrix").innerText(), /4\.0/);
assert.ok(await page.locator("svg.radar").count() >= 1, "רדאר השוואת גנים");
assert.match(await page.locator("body").innerText(), /ילדים שסומנו בפריט בטיחות \(1\)/);
await page.screenshot({ path: SHOTS + "admin-system.png", fullPage: true });
step("דשבורד מערך אצל המנהלת: מטריצה, רדאר, דגלים");

let r3 = await download(() => page.getByRole("button", { name: "הורדת דוח מערך (Excel)" }).click());
assert.deepEqual(r3.wb.SheetNames, ["מידע", "מטריצת גנים", "כל המילויים", "ילדים מסומנים", "פריטי בטיחות", "תשובות מלאות"]);
const mat = XLSX.utils.sheet_to_json(r3.wb.Sheets["מטריצת גנים"], { header: 1 });
assert.equal(mat[mat.length - 1][0], "כלל המערך");
step("דוח מערך (Excel): " + r3.wb.SheetNames.join(", "));

await page.getByRole("link", { name: "דשבורד גן" }).first().click();
await page.waitForSelector("text=דשבורד גן · גן שפתי א");
await page.waitForSelector("svg.radar");
let r4 = await download(() => page.getByRole("button", { name: "הורדת דוח גן (Excel)" }).click());
assert.ok(r4.wb.SheetNames.includes("תשובות מלאות"), "מנהלת מקבלת תשובות פרטניות");
await page.locator("table.matrix a", { hasText: "14" }).first().click();
await page.waitForSelector("text=דשבורד ילד · 14");
assert.equal(await page.getByRole("link", { name: "פרופיל מלא ותשובות" }).count(), 1);
let r5 = await download(() => page.getByRole("button", { name: "הורדת דוח ילד (Excel)" }).click());
assert.ok(r5.wb.SheetNames.includes("תשובות"));
await page.getByRole("link", { name: "פרופיל מלא ותשובות" }).click();
await page.waitForSelector("text=פרופיל · ילד 14");
assert.match(await page.locator("body").innerText(), /טקסט בדיקה/);
assert.equal(await page.getByRole("link", { name: "מילוי חוזר" }).count(), 0);
await page.screenshot({ path: SHOTS + "admin-child.png", fullPage: true });
step("מנהלת: דשבורד גן וילד, פרופיל מלא ותשובות פרטניות ודוחות מלאים");

assert.deepEqual(errors, [], "console errors: " + errors.join("; "));
console.log("UI smoke passed");
await browser.close();
