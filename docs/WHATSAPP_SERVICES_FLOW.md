# דוח: WhatsApp Bot Services - זרימת עבודה ומבנה Services

## סקירה כללית

המערכת מאפשרת חיפוש משחקים בשפה טבעית בעברית ומחזירה את כל ההצעות למשחק. המערכת מורכבת מ-4 services עיקריים הפועלים בסדר מסוים.

---

## Services - רשימה מלאה

### 1. **WhatsAppSearchService** (Service ראשי)

**מיקום:** `backend/src/services/whatsapp/WhatsAppSearchService.js`

**תפקיד:**

- Service ראשי המנהל את כל הזרימה
- מקבל query בשפה טבעית ותאריך (אופציונלי)
- מחזיר תוצאה מוכנה עם משחק והצעות

**פונקציות:**

- `searchGame(query, date)` - פונקציה ראשית המבצעת את כל התהליך
- `validateQuery(query)` - ולידציה של ה-query

**תלויות:**

- TeamMatcherService
- FixtureFinderService
- getOffersByFixtureId (from offer service)

---

### 2. **TeamMatcherService**

**מיקום:** `backend/src/services/whatsapp/TeamMatcherService.js`

**תפקיד:**

- מזהה שתי קבוצות מתוך טקסט טבעי בעברית
- תומך ב-aliases ו-fuzzy matching לטעויות הקלדה
- מחזיר ObjectIds של הקבוצות

**פונקציות:**

- `matchTeamsFromQuery(query)` - מזהה קבוצות מתוך טקסט

**תלויות:**

- קובץ `backend/data/teams/team_aliases.json` - מכיל aliases של כל הקבוצות
- Team model - לבדיקת קיום הקבוצות במסד הנתונים

**אלגוריתם:**

1. טוען aliases מקובץ JSON
2. מפרק את הטקסט לזיהוי שתי קבוצות (מחפש מילות מפתח: "נגד", "vs", "מול", "עם")
3. מבצע התאמה מדויקת (exact match) על שם הקבוצה ו-aliases
4. אם לא נמצא, מבצע התאמה fuzzy עם Levenshtein distance
5. בודק שהקבוצות קיימות במסד הנתונים
6. מחזיר ObjectIds של שתי הקבוצות

**דוגמה:**

```
Input: "סיטי נגד יונייטד"
Output: {
  success: true,
  team1: { _id: "...", name: "מנצ'סטר סיטי", slug: "manchester-city" },
  team2: { _id: "...", name: "מנצ'סטר יונייטד", slug: "manchester-united" }
}
```

---

### 3. **FixtureFinderService**

**מיקום:** `backend/src/services/whatsapp/FixtureFinderService.js`

**תפקיד:**

- מוצא משחק בין שתי קבוצות
- בונה slug למשחק בפורמט: `{homeTeam-slug}-vs-{awayTeam-slug}-{YYYY-MM-DD}`
- מחפש משחק ספציפי לפי תאריך או את המשחק הקרוב ביותר בעתיד

**פונקציות:**

- `findFixtureBetweenTeams(team1Id, team2Id, date)` - מוצא משחק בין שתי קבוצות
- `findFixtureBySlug(slug)` - מוצא משחק לפי slug

**תלויות:**

- FootballEvent model - לשאילתות במסד הנתונים
- Team model - לשליפת slug של הקבוצות

**אלגוריתם:**

1. בונה filter לחיפוש משחקים בין שתי הקבוצות (בודק בשני הכיוונים: homeTeam/awayTeam)
2. אם יש תאריך - מוסיף filter לתאריך ספציפי (±1 יום לסובלנות timezone)
3. אם אין תאריך - מחפש רק משחקים עתידיים (`date >= now`)
4. ממיין לפי תאריך (הקרוב ביותר ראשון)
5. בונה slug מהמשחק שנמצא
6. מחזיר פרטי המשחק המלאים

**דוגמה:**

```
Input: team1Id="...", team2Id="...", date="2026-01-17"
Output: {
  success: true,
  fixture: {
    _id: "...",
    slug: "manchester-united-vs-manchester-city-2026-01-17",
    date: "2026-01-17T12:30:00.000Z",
    homeTeam: { ... },
    awayTeam: { ... },
    ...
  }
}
```

---

### 4. **getOffersByFixtureId** (from Offer Service)

**מיקום:** `backend/src/services/offer/queries/getOffersByFixtureId.js`

**תפקיד:**

- מביא את כל ההצעות למשחק ספציפי
- כולל הצעות מ-Agents ומ-Suppliers
- ממיין לפי מחיר (מהזול ליקר)

**פונקציות:**

- `getOffersByFixtureId(fixtureId, query)` - מביא הצעות למשחק

**תלויות:**

- AgentOfferService - הצעות מ-agents
- SupplierApiService - הצעות מ-suppliers (API calls)
- FootballEvent model - פרטי המשחק

**אלגוריתם:**

1. שולף את פרטי המשחק מה-DB
2. מביא הצעות מ-Agents (מה-DB)
3. מביא הצעות מ-Suppliers (קריאות API)
4. ממיר מחירים ל-EUR למיון אחיד
5. ממיין לפי מחיר
6. מחזיר את כל ההצעות עם פרטי המשחק

---

## זרימת עבודה (Flow)

```
┌─────────────────────────────────────────────────────────────┐
│                    Route: /api/whatsapp/search-game          │
│                    (GET or POST)                             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              WhatsAppSearchService.searchGame()             │
│                                                              │
│  Step 1: Validate Query                                     │
│    ├─ Check if query exists                                 │
│    └─ Check if query is non-empty string                    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│         Step 2: TeamMatcherService.matchTeamsFromQuery()    │
│                                                              │
│  1. Load team aliases from JSON file                        │
│  2. Extract team names from query                           │
│     (look for: "נגד", "vs", "מול", "עם")                    │
│  3. Match teams using aliases                               │
│     ├─ Exact match on name_he and aliases                   │
│     └─ Fuzzy match (Levenshtein) if no exact match         │
│  4. Verify teams exist in DB                                │
│  5. Return team ObjectIds                                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│    Step 3: FixtureFinderService.findFixtureBetweenTeams()   │
│                                                              │
│  1. Build MongoDB filter                                    │
│     ├─ Check both directions (homeTeam/awayTeam)           │
│     └─ Add date filter if provided                          │
│  2. Query FootballEvent collection                          │
│  3. Sort by date (earliest first)                          │
│  4. Build slug: {homeTeam-slug}-vs-{awayTeam-slug}-{date}  │
│  5. Return fixture details                                 │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│      Step 4: getOffersByFixtureId()                         │
│                                                              │
│  1. Fetch fixture details from DB                          │
│  2. Get agent offers (from DB)                              │
│  3. Get supplier offers (from APIs)                        │
│  4. Convert prices to EUR for sorting                       │
│  5. Sort by price (ascending)                              │
│  6. Return all offers with fixture details                 │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Step 5: Format Response                        │
│                                                              │
│  Return:                                                    │
│  {                                                           │
│    success: true,                                            │
│    data: {                                                   │
│      fixture: { ... },                                       │
│      offers: [ ... ],                                        │
│      offersCount: number,                                    │
│      query: string,                                          │
│      matchedTeams: { team1, team2 }                         │
│    }                                                         │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## מבנה קבצים

```
backend/
├── src/
│   ├── routes/
│   │   └── whatsapp.js                    # Route נקי - רק קורא ל-service
│   │
│   └── services/
│       └── whatsapp/
│           ├── WhatsAppSearchService.js   # Service ראשי - מנהל את הזרימה
│           ├── TeamMatcherService.js      # זיהוי קבוצות מתוך טקסט
│           └── FixtureFinderService.js    # חיפוש משחק בין קבוצות
│
│       └── offer/
│           └── queries/
│               └── getOffersByFixtureId.js  # שליפת הצעות למשחק
│
└── data/
    └── teams/
        └── team_aliases.json              # קובץ aliases של קבוצות
```

---

## Error Handling

כל service מחזיר אובייקט עם:

- `success: boolean` - האם הפעולה הצליחה
- `error: string | object` - הודעת שגיאה (אם נכשל)
- `statusCode: number` - קוד סטטוס HTTP
- `data: object` - הנתונים (אם הצליח)

**Error Codes:**

- `VALIDATION_MISSING_FIELDS` - query חסר או לא תקין
- `TEAM_MATCH_FAILED` - לא הצליח לזהות קבוצות
- `FIXTURE_NOT_FOUND` - לא נמצא משחק בין הקבוצות
- `INTERNAL_SERVER_ERROR` - שגיאה פנימית

---

## דוגמאות שימוש

### דוגמה 1: חיפוש עם תאריך

```javascript
// Input
{
  "query": "סיטי נגד יונייטד",
  "date": "2026-01-17"
}

// Process
1. WhatsAppSearchService.validateQuery() ✓
2. TeamMatcherService.matchTeamsFromQuery()
   → "סיטי" → מנצ'סטר סיטי
   → "יונייטד" → מנצ'סטר יונייטד
3. FixtureFinderService.findFixtureBetweenTeams()
   → מוצא משחק ב-2026-01-17
4. getOffersByFixtureId()
   → מביא את כל ההצעות

// Output
{
  "success": true,
  "data": {
    "fixture": { ... },
    "offers": [ ... ],
    "offersCount": 3,
    "query": "סיטי נגד יונייטד",
    "matchedTeams": {
      "team1": "מנצ'סטר סיטי",
      "team2": "מנצ'סטר יונייטד"
    }
  }
}
```

### דוגמה 2: חיפוש בלי תאריך (מוצא את הקרוב ביותר)

```javascript
// Input
{
  "query": "ליברפול נגד ארסנל"
}

// Process
1. WhatsAppSearchService.validateQuery() ✓
2. TeamMatcherService.matchTeamsFromQuery()
   → "ליברפול" → ליברפול
   → "ארסנל" → ארסנל
3. FixtureFinderService.findFixtureBetweenTeams()
   → מוצא את המשחק הקרוב ביותר בעתיד
4. getOffersByFixtureId()
   → מביא את כל ההצעות

// Output
{
  "success": true,
  "data": {
    "fixture": {
      "date": "2026-02-15T15:00:00.000Z",
      ...
    },
    "offers": [ ... ],
    ...
  }
}
```

---

## שיפורים עתידיים אפשריים

1. **Caching** - הוספת cache לתוצאות חיפוש נפוצות
2. **Fuzzy Matching משופר** - שימוש ב-embeddings לזיהוי טוב יותר של קבוצות
3. **תמיכה בכמה משחקים** - החזרת כל המשחקים בין שתי קבוצות במקום רק אחד
4. **תמיכה בליגות** - אפשרות לציין ליגה ספציפית בחיפוש
5. **תמיכה בשפות נוספות** - הוספת תמיכה באנגלית ובשפות אחרות

---

## סיכום

המערכת בנויה בצורה מודולרית עם הפרדה ברורה בין ה-services:

- **Route** - רק קורא ל-service ומחזיר תשובה
- **WhatsAppSearchService** - מנהל את הזרימה הכללית
- **TeamMatcherService** - זיהוי קבוצות
- **FixtureFinderService** - חיפוש משחקים
- **getOffersByFixtureId** - שליפת הצעות

כל service אחראי על חלק ספציפי בתהליך, מה שמקל על תחזוקה, בדיקות והרחבה עתידית.







