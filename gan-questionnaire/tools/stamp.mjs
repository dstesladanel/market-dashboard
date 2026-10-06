// מסמן גרסה בכתובות הקבצים כדי שדפדפנים (במיוחד Safari בטלפון) לא יציגו קוד ישן מהמטמון.
// GitHub Pages שומר קבצים במטמון, ו-Safari שומר גם מודולי JS. הגרסה היא גיבוב של תוכן הקבצים,
// ולכן היא משתנה בדיוק כשקובץ משתנה. מריצים לפני כל commit:  node tools/stamp.mjs
// בדיקה בלי שינוי (ל-CI או לבדיקות):  node tools/stamp.mjs --check
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

const jsFiles = walk(join(root, "js")).filter((f) => f.endsWith(".js")).map((f) => "./" + relative(root, f).split("\\").join("/")).sort();
const assets = [...jsFiles, "./styles.css"];
const hash = createHash("sha1");
for (const f of assets) hash.update(f).update(readFileSync(join(root, f)));
const v = hash.digest("hex").slice(0, 8);

const importMap = { imports: Object.fromEntries(jsFiles.map((f) => [f, `${f}?v=${v}`])) };
const html = readFileSync(join(root, "index.html"), "utf8");
const block = `<!-- stamp:start -->
<script type="importmap">${JSON.stringify(importMap)}</script>
<script>window.__BUILD = "${v}";</script>
<!-- stamp:end -->`;
let out = html.replace(/<!-- stamp:start -->[\s\S]*?<!-- stamp:end -->/, block);
if (!out.includes("stamp:start")) out = out.replace("</head>", `${block}\n</head>`);
out = out.replace(/href="styles\.css[^"]*"/, `href="styles.css?v=${v}"`).replace(/src="js\/app\.js[^"]*"/, `src="js/app.js?v=${v}"`);

if (process.argv.includes("--check")) {
  if (out !== html) { console.error(`index.html לא מסומן לגרסה ${v}. הריצו: node tools/stamp.mjs`); process.exit(1); }
  console.log("stamp ok " + v);
} else {
  writeFileSync(join(root, "index.html"), out);
  console.log("stamped " + v);
}
