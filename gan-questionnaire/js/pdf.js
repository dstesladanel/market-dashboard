// הורדת PDF ישירה מהדפדפן (בלי חלון הדפסה). הדוח מצולם כתמונה ומחולק לעמודי A4,
// והעברית נשמרת במלואה (מימין לשמאל) כי הצילום נעשה אחרי שהדפדפן כבר עיצב את הדף.
// המחיר: הטקסט ב-PDF הוא תמונה ולא ניתן לסימון. מי שצריכה טקסט לסימון משתמשת ב"הדפסה" ושומרת כ-PDF.
const SCRIPTS = {
  html2canvas: "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
  jspdf: "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
};
const pending = {};

function loadScript(key, getter) {
  if (getter()) return Promise.resolve(getter());
  pending[key] ||= new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = SCRIPTS[key];
    el.onload = () => resolve(getter());
    el.onerror = () => { pending[key] = null; reject(new Error("לא ניתן לטעון את ספריית ה-PDF. בדקו חיבור לאינטרנט, או השתמשו ב\"הדפסה\".")); };
    document.head.append(el);
  });
  return pending[key];
}

const PAGE_W_MM = 210, PAGE_H_MM = 297, MARGIN_MM = 12;
const CONTENT_W_MM = PAGE_W_MM - 2 * MARGIN_MM;
const CONTENT_H_MM = PAGE_H_MM - 2 * MARGIN_MM - 4; // מקום למספר עמוד
const CSS_W = 703; // רוחב התוכן בפיקסלים של CSS (186 מ"מ ב-96dpi)

// מכינים עותק נקי של הדוח: שדות הטקסט הופכים לטקסט רגיל ופקדי העריכה מוסרים
function printClone(report) {
  const clone = report.cloneNode(true);
  clone.querySelectorAll(".no-print").forEach((n) => n.remove());
  const live = report.querySelectorAll("textarea");
  clone.querySelectorAll("textarea").forEach((t, i) => {
    const d = document.createElement("div");
    d.className = (t.className || "") + " pdftext";
    d.textContent = live[i] ? live[i].value : t.value;
    t.replaceWith(d);
  });
  Object.assign(clone.style, {
    position: "fixed", left: "-10000px", top: "0", width: CSS_W + "px", maxWidth: "none",
    border: "0", borderRadius: "0", padding: "0", margin: "0", background: "#fff",
  });
  clone.classList.add("pdf-mode");
  return clone;
}

// חיתוך בגבולות בלוקים, כדי לא לחתוך שורה באמצע
function pageCuts(clone, totalH, pageH) {
  const top = clone.getBoundingClientRect().top;
  const bottoms = [...clone.querySelectorAll(".pdftext, .brow, .rprofile, .rhead")]
    .map((el) => el.getBoundingClientRect().bottom - top)
    .sort((a, b) => a - b);
  const cuts = [];
  let y = 0;
  while (totalH - y > pageH + 1) {
    const limit = y + pageH;
    const ok = bottoms.filter((b) => b <= limit && b > y + pageH * 0.4);
    const cut = ok.length ? ok[ok.length - 1] : limit;
    cuts.push(cut);
    y = cut;
  }
  return cuts;
}

export async function downloadReportPdf(reportEl, filename) {
  const [html2canvas, jspdf] = await Promise.all([
    loadScript("html2canvas", () => window.html2canvas),
    loadScript("jspdf", () => window.jspdf),
  ]);
  const clone = printClone(reportEl);
  document.body.append(clone);
  try {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const totalH = Math.ceil(clone.getBoundingClientRect().height);
    // מגבלת גודל קנבס בדפדפני נייד: מצמצמים את הרזולוציה בדוחות ארוכים
    const scale = Math.max(1, Math.min(2, Math.sqrt(12e6 / (CSS_W * totalH))));
    const canvas = await html2canvas(clone, { scale, backgroundColor: "#ffffff", width: CSS_W, windowWidth: CSS_W, logging: false });
    const pageH = CSS_W * (CONTENT_H_MM / CONTENT_W_MM);
    const cuts = pageCuts(clone, totalH, pageH);
    const bounds = [0, ...cuts, totalH];
    const doc = new jspdf.jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    for (let p = 0; p < bounds.length - 1; p++) {
      const y0 = Math.round(bounds[p] * scale), y1 = Math.min(canvas.height, Math.round(bounds[p + 1] * scale));
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = Math.max(1, y1 - y0);
      const ctx = slice.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, y0, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
      if (p > 0) doc.addPage();
      doc.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", MARGIN_MM, MARGIN_MM, CONTENT_W_MM, (slice.height / canvas.width) * CONTENT_W_MM);
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(`${p + 1}/${bounds.length - 1}`, PAGE_W_MM / 2, PAGE_H_MM - 7, { align: "center" });
    }
    doc.save(filename);
    return bounds.length - 1;
  } finally {
    clone.remove();
  }
}
