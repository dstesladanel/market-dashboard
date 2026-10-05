import assert from "node:assert/strict";
import { seedForm } from "../js/seed.js";
import { computeSummary } from "../js/scoring.js";
import { domainList, gardenStats, gardenTrend, flaggedChildren, latestPerChild } from "../js/analytics.js";
import { childReport, gardenReport, systemReport } from "../js/reports.js";

const form = seedForm();
const mk = (g, code, date, answers, id) => ({ id, gardenId: g, childCode: code, age: 4, date, formVersion: 1, createdAt: 1, ...computeSummary(form, answers) });
const S = [
  mk("g1", "1", "2026-01-10", { C01: 2, C02: 2, S01: 3 }, "a"),
  mk("g1", "1", "2026-04-10", { C01: 4, C02: 4, S01: 3, B02: true }, "b"),
  mk("g1", "2", "2026-04-12", { C01: 5, S01: 1 }, "c"),
  mk("g2", "7", "2026-04-13", { C01: 3 }, "d"),
];
const domains = domainList(form, S);
assert.equal(domains.length, 7);

assert.equal(latestPerChild(S.filter((s) => s.gardenId === "g1")).length, 2);
const st = gardenStats(S.filter((s) => s.gardenId === "g1"), domains);
assert.equal(st.children, 2);
assert.equal(st.rows.find((r) => r.id === "C").avg, 4.5); // 4.0 של ילד 1, 5.0 של ילד 2
assert.equal(st.weakest.id, "S"); // 3 ו-1 → 2.0
assert.deepEqual(flaggedChildren(S).map((s) => s.childCode), ["1"]);
const tr = gardenTrend(S.filter((s) => s.gardenId === "g1"), domains);
assert.deepEqual(tr[0].points.map((p) => p.x), ["2026-01", "2026-04"]);

const child = childReport({ garden: "ג1", code: "1", domains, history: S.slice(0, 2) });
assert.deepEqual(child.map((x) => x.name), ["מידע", "ממוצעים לפי תחום", "בטיחות ובריאות"]);
const row = child[1].rows.find((r) => r[0] === "תקשורת ושפה");
assert.deepEqual(row.slice(1), [2, 4, 2]);

const garden = gardenReport({ garden: { name: "ג1", type: "שפתי" }, domains, summaries: S.slice(0, 3) });
assert.equal(garden.find((x) => x.name === "ילדים").rows.length, 4); // כותרת, שני ילדים, שורת ממוצע גן
const sys = systemReport({ gardens: [{ id: "g1", name: "ג1", type: "" }, { id: "g2", name: "ג2", type: "" }], domains, summaries: S });
assert.equal(sys[1].rows.at(-1)[0], "כלל המערך");
assert.equal(sys[2].rows.length, 1 + 4);
console.log("reports tests passed");
