# פתרון בעיות - WhatsApp Natural Language API

## URL המלא

```
https://api.ticketagent.co.il/api/whatsapp/offers/natural-language
```

## בעיות נפוצות ופתרונות

### 1. CORS Error

**תסמינים:**

```
Access to fetch at 'https://api.ticketagent.co.il/api/whatsapp/offers/natural-language'
from origin '...' has been blocked by CORS policy
```

**פתרון:**

- ה-CORS עודכן לכלול את `https://api.ticketagent.co.il`
- ודא שה-`FRONTEND_URL` ב-.env כולל את ה-domains הנכונים

### 2. Route Not Found (404)

**תסמינים:**

```json
{
  "success": false,
  "error": "Route not found",
  "message": "Cannot POST /api/whatsapp/offers/natural-language"
}
```

**פתרונות:**

1. ודא שהשרת רץ: `curl https://api.ticketagent.co.il/health`
2. ודא שה-route רשום ב-`src/index.js`:
   ```javascript
   app.use("/api/whatsapp", whatsappRoutes);
   ```
3. ודא שה-route קיים ב-`src/routes/whatsapp.js`:
   ```javascript
   router.post("/offers/natural-language", ...)
   ```

### 3. Validation Error (400)

**תסמינים:**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_MISSING_FIELDS",
    "message": "Query is required"
  }
}
```

**פתרון:**

- ודא שאתה שולח `query` ב-body:
  ```json
  {
    "query": "צלסי ארסנל"
  }
  ```

### 4. Internal Server Error (500)

**תסמינים:**

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Internal server error"
  }
}
```

**פתרונות:**

1. בדוק את הלוגים של השרת
2. ודא שמסד הנתונים מחובר
3. ודא שקובץ `team_aliases.json` קיים

### 5. Team Not Found

**תסמינים:**

```json
{
  "success": false,
  "error": {
    "code": "TEAM_NOT_FOUND",
    "message": "Could not find team: ...",
    "suggestions": [...]
  }
}
```

**פתרון:**

- השתמש באחת מההצעות שמוחזרות
- או הוסף את הכינוי ל-`team_aliases.json`

## בדיקות

### בדיקה בסיסית עם cURL

```bash
# POST request
curl -X POST https://api.ticketagent.co.il/api/whatsapp/offers/natural-language \
  -H "Content-Type: application/json" \
  -d '{"query": "צלסי ארסנל"}'

# GET request
curl "https://api.ticketagent.co.il/api/whatsapp/offers/natural-language?query=צלסי%20ארסנל"
```

### בדיקה עם Postman/Insomnia

1. **Method:** POST
2. **URL:** `https://api.ticketagent.co.il/api/whatsapp/offers/natural-language`
3. **Headers:**
   ```
   Content-Type: application/json
   ```
4. **Body (JSON):**
   ```json
   {
     "query": "צלסי ארסנל",
     "date": "2026-02-28"
   }
   ```

## לוגים

המערכת מדפיסה לוגים מפורטים:

- `📥 [WHATSAPP ROUTE]` - בקשה התקבלה
- `🔍 [WHATSAPP SEARCH]` - התחלת חיפוש
- `📋 [STEP 1]` - ולידציה
- `🔎 [STEP 2]` - זיהוי קבוצות
- `🏟️ [STEP 3]` - חיפוש משחק
- `💰 [STEP 4]` - שליפת הצעות
- `🔵 [ROUTE DEBUG]` - תוצאה מהסרוויס
- `🟢 [ROUTE DEBUG]` - תשובה סופית

## בדיקת Health

```bash
curl https://api.ticketagent.co.il/health
```

צריך להחזיר:

```json
{
  "success": true,
  "message": "Ticket Agent API is running",
  "database": {
    "status": "connected"
  }
}
```

## Environment Variables

ודא שהמשתנים הבאים מוגדרים:

```env
MONGODB_URI=mongodb+srv://...
FRONTEND_URL=https://ticketagent.co.il
NODE_ENV=production
PORT=8080
```

## Deployment Checklist

- [ ] השרת רץ על ה-domain הנכון
- [ ] CORS מוגדר נכון
- [ ] מסד הנתונים מחובר
- [ ] קובץ `team_aliases.json` קיים
- [ ] Environment variables מוגדרים
- [ ] Health endpoint עובד


