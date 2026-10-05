// הורדות דוחות לפי בקשה. כל לחיצה קוראת את הנתונים העדכניים ובונה קובץ חדש.
import { toast } from "./ui.js";
import { listResponses, listAllResponses, listGardenSummaries, listSummaries, getForm } from "./store.js";
import { domainList, childHistory } from "./analytics.js";
import { childReport, gardenReport, systemReport, downloadXlsx, fileSafe } from "./reports.js";

const day = () => new Date().toISOString().slice(0, 10);

async function staffFills(gardenId, onlyCode) {
  const rs = (await listResponses(gardenId))
    .filter((r) => r.status === "final" && (!onlyCode || r.childCode === onlyCode))
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  return Promise.all(rs.map(async (response) => ({ response, form: await getForm(response.formId) })));
}

async function run(label, fn) {
  toast(`מכינה ${label}…`);
  try { await fn(); toast("הדוח ירד"); } catch (e) { console.error(e); toast(e.message || "שגיאה בהכנת הדוח", "err"); }
}

export const downloadChildReport = (ctx, { gardenId, code, level }) => run("דוח ילד", async () => {
  const [form, summaries] = [await ctx.currentForm(), await listGardenSummaries(gardenId)];
  const history = childHistory(summaries, gardenId, code);
  const garden = ctx.gardens.find((g) => g.id === gardenId);
  const fills = level === "staff" ? await staffFills(gardenId, code) : null;
  await downloadXlsx(`דוח-ילד-${fileSafe(code)}-${day()}.xlsx`, childReport({
    garden: garden ? garden.name : "", code, domains: domainList(form, history), history, fills,
  }));
});

export const downloadGardenReport = (ctx, { gardenId, level }) => run("דוח גן", async () => {
  const [form, summaries] = [await ctx.currentForm(), await listGardenSummaries(gardenId)];
  const garden = ctx.gardens.find((g) => g.id === gardenId) || { name: "גן", type: "" };
  const fills = level === "staff" ? await staffFills(gardenId) : null;
  await downloadXlsx(`דוח-גן-${fileSafe(garden.name)}-${day()}.xlsx`, gardenReport({
    garden, domains: domainList(form, summaries), summaries, fills,
  }));
});

export const downloadSystemReport = (ctx) => run("דוח מערך", async () => {
  const [form, summaries] = [await ctx.currentForm(), await listSummaries()];
  const rs = (await listAllResponses()).filter((r) => r.status === "final")
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  const fills = await Promise.all(rs.map(async (response) => ({ response, form: await getForm(response.formId) })));
  await downloadXlsx(`דוח-מערך-${day()}.xlsx`, systemReport({
    gardens: ctx.gardens, domains: domainList(form, summaries), summaries, fills,
  }));
});
