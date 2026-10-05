import assert from "node:assert/strict";
import { seedForm } from "../js/seed.js";
import { computeSummary, itemsForRole, deltas } from "../js/scoring.js";

const form = seedForm();
const count = (f) => f(form.items);
// הספירה לפי "מפרט הפריטים": 45 מדורגים, 8 כן/לא, 3 טקסט
assert.equal(count((a) => a.filter((i) => i.type === "scale").length), 45);
assert.equal(count((a) => a.filter((i) => i.type === "yesno").length), 8);
assert.equal(count((a) => a.filter((i) => i.type === "text").length), 3);
const per = (d) => form.items.filter((i) => i.domain === d && i.type === "scale").length;
assert.deepEqual(["C", "S", "E", "A", "M", "L", "B"].map(per), [10, 8, 6, 7, 6, 7, 1]);

// ממוצע: 0 וחסר לא נספרים
const ans = { C01: 5, C02: 3, C03: 0, C04: 4, E07: true, B02: true, C11: true };
const s = computeSummary(form, ans);
assert.equal(s.domains.C.n, 3);
assert.equal(s.domains.C.avg, 4);
assert.equal(s.domains.C.total, 10);
assert.equal(s.domains.S.avg, null);
assert.equal(s.domains.N, undefined); // תחום סיום בלי ממוצע
// כן/לא לא נכנס לממוצע. דגלי בטיחות רק לפריטים מסומנים. C11 אינו דגל.
assert.deepEqual(s.flags.map((f) => f.id).sort(), ["B02", "E07"]);

// פריט שהוסר לא נספר
const f2 = structuredClone(form);
f2.items.find((i) => i.id === "C01").active = false;
assert.equal(computeSummary(f2, ans).domains.C.avg, 3.5);

// סייעת רואה רק פריטים שסומנו
const asst = itemsForRole(form, "assistant").map((i) => i.id).sort();
assert.deepEqual(asst, ["A01", "A02", "A03", "A04", "A05", "A06", "A07", "B05", "E02", "M02"]);

// השוואה לעצמו
const prev = computeSummary(form, { C01: 2, C02: 2 });
assert.equal(deltas(s, prev).C, 2);
assert.equal(deltas(s, prev).S, null);
console.log("scoring tests passed");
