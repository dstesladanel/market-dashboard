# חיבור טופס ההרשמה ל-Google Sheets

השלבים האלה נעשים פעם אחת בחשבון הגוגל שלך.

## 1. צרו גיליון חדש
פתחו [sheets.google.com](https://sheets.google.com) → גיליון חדש → תנו לו שם, למשל "לידים - קהילה".

## 2. פתחו את עורך הסקריפטים
בתפריט: **הרחבות (Extensions) → Apps Script**.

מחקו את הקוד הקיים והדביקו את זה במקומו:

```javascript
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Leads');
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('Leads');
    sheet.appendRow(['תאריך', 'שם מלא', 'אימייל', 'טלפון']);
  }
  var data = JSON.parse(e.postData.contents);
  sheet.appendRow([new Date(), data.name, data.email, data.phone]);
  return ContentService.createTextOutput(JSON.stringify({ result: 'success' }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

שמרו (סמל דיסקט או Ctrl+S), אפשר לתת לפרויקט שם כמו "Leads API".

## 3. פרסמו כ-Web App
1. למעלה מימין: **Deploy → New deployment**.
2. ליד "Select type" לחצו על גלגל השיניים ובחרו **Web app**.
3. הגדירו:
   - **Execute as:** Me (החשבון שלכם)
   - **Who has access:** Anyone
4. **Deploy**. גוגל תבקש אישור הרשאות — אשרו עם חשבון הגוגל שלכם (זהו שלב שרק אתם יכולים לבצע).
5. תקבלו **Web app URL** שנראה כך:
   `https://script.google.com/macros/s/XXXXXXXXXXXXXXXX/exec`
   העתיקו את הכתובת הזו.

## 4. הדביקו את הכתובת באתר
פתחו את `index.html`, חפשו את השורה:

```javascript
const GOOGLE_SCRIPT_URL = "PASTE_YOUR_APPS_SCRIPT_URL_HERE";
```

והחליפו את `PASTE_YOUR_APPS_SCRIPT_URL_HERE` בכתובת שקיבלתם. שמרו, ובקשו ממני לדחוף (`git push`) את העדכון ל-GitHub — האתר החי יתעדכן תוך דקה.

## עדכון עתידי של הסקריפט
אם תשנו את הקוד ב-Apps Script בעתיד, תצטרכו **Deploy → Manage deployments → ✎ ערוך → Deploy** מחדש כדי שהשינוי ייכנס לתוקף (כתובת ה-URL תישאר זהה).
