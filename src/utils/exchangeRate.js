import axios from "axios";
import { logWithCheckpoint, logError } from "./logger.js";

// Cache מרכזי לשערי מטבעות ל-EUR
// מפתח: "USD", "ILS", "GBP", ערך: { rate, timestamp }
const baseRatesCache = new Map();

// Cache לשערי מט"ח אחרים (לא נפוץ)
const exchangeRateCache = new Map(); // מפתח: "USD->EUR", ערך: { rate, timestamp }

const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 שעות
const SUPPORTED_CURRENCIES = ["USD", "ILS", "EUR", "GBP"]; // המטבעות שהמערכת תומכת בהם

// שערים קבועים כגיבוי (מ-update אחרון - יכולים להיות לא מעודכנים)
const FALLBACK_RATES = {
  USD: 0.92, // 1 USD = 0.92 EUR (קירוב)
  ILS: 0.25, // 1 ILS = 0.25 EUR (קירוב)
  GBP: 1.16, // 1 GBP = 1.16 EUR (קירוב)
  EUR: 1.0, // 1 EUR = 1 EUR
};

// Flag כדי למנוע קריאות מקבילות ל-API
let isLoadingRates = false;
let loadPromise = null;

/**
 * טעינה מראש של כל השערים המרכזיים ל-EUR פעם ביום
 * פונקציה זו נקראת אוטומטית בפעם הראשונה שמתבקשת המרה
 */
const loadBaseRates = async () => {
  const now = Date.now();

  // בדיקה אם צריך לטעון מחדש (אם אין cache או שפג תוקפו)
  const needsRefresh = SUPPORTED_CURRENCIES.some((currency) => {
    if (currency === "EUR") return false; // EUR הוא בסיס
    const cached = baseRatesCache.get(currency);
    return !cached || now - cached.timestamp >= CACHE_TTL_MS;
  });

  if (!needsRefresh) {
    return; // הכל תקין, אין צורך בטעינה
  }

  // אם כבר בטעינה - מחכים לאותה טעינה
  if (isLoadingRates && loadPromise) {
    return await loadPromise;
  }

  // התחלת טעינה חדשה
  isLoadingRates = true;
  loadPromise = (async () => {
    try {
      logWithCheckpoint(
        "info",
        "Loading base exchange rates from API",
        "EXCHANGE_RATE_LOAD_001",
        {
          currencies: SUPPORTED_CURRENCIES.filter((c) => c !== "EUR"),
        }
      );

      // טעינת כל השערים בבת אחת מה-API
      const symbols = SUPPORTED_CURRENCIES.filter((c) => c !== "EUR").join(",");
      const url = `https://api.exchangerate.host/latest?base=EUR&symbols=${symbols}`;

      const response = await axios.get(url, {
        timeout: 5000,
      });

      if (!response.data || !response.data.rates) {
        throw new Error("Invalid response from exchange rate API");
      }

      const rates = response.data.rates;
      const timestamp = Date.now();

      // שמירת כל השערים ב-cache
      for (const currency of SUPPORTED_CURRENCIES) {
        if (currency === "EUR") {
          // EUR ל-EUR הוא 1
          baseRatesCache.set("EUR", {
            rate: 1.0,
            timestamp,
          });
        } else if (rates[currency]) {
          // השער שמגיע מהא API הוא מ-EUR למטבע, אז נעשה הפוך (1/rate)
          baseRatesCache.set(currency, {
            rate: 1 / rates[currency], // המרה מ-currency ל-EUR
            timestamp,
          });
        }
      }

      logWithCheckpoint(
        "info",
        "Base exchange rates loaded successfully",
        "EXCHANGE_RATE_LOAD_002",
        {
          loadedCurrencies: Array.from(baseRatesCache.keys()),
          timestamp: new Date(timestamp).toISOString(),
        }
      );
    } catch (error) {
      logError(error, { operation: "loadBaseRates" });

      // אם ה-API נכשל, נשתמש בשערים קבועים אם אין בקש
      const now = Date.now();
      let hasAnyCache = false;

      for (const currency of SUPPORTED_CURRENCIES) {
        const cached = baseRatesCache.get(currency);
        if (cached) {
          hasAnyCache = true;
          break;
        }
      }

      // אם אין cache בכלל, נטען שערים קבועים
      if (!hasAnyCache) {
        logWithCheckpoint(
          "warn",
          "API failed, loading fixed fallback rates",
          "EXCHANGE_RATE_LOAD_FALLBACK",
          {
            currencies: SUPPORTED_CURRENCIES.filter((c) => c !== "EUR"),
          }
        );

        const fallbackTimestamp = now;
        for (const currency of SUPPORTED_CURRENCIES) {
          if (FALLBACK_RATES[currency]) {
            baseRatesCache.set(currency, {
              rate: FALLBACK_RATES[currency],
              timestamp: fallbackTimestamp,
            });
          }
        }

        logWithCheckpoint(
          "info",
          "Fixed fallback rates loaded",
          "EXCHANGE_RATE_LOAD_FALLBACK_SUCCESS",
          {
            loadedCurrencies: Array.from(baseRatesCache.keys()),
            note: "Rates may not be up-to-date",
          }
        );
      } else {
        // יש cache - נמשיך להשתמש בו (גם אם פג תוקף)
        logWithCheckpoint(
          "warn",
          "API failed, but cache exists - will use stale cache",
          "EXCHANGE_RATE_LOAD_CACHE_FALLBACK",
          {
            cachedCurrencies: Array.from(baseRatesCache.keys()),
          }
        );
      }

      // לא זורקים שגיאה - נמשיך עם cache או fallback
    } finally {
      isLoadingRates = false;
      loadPromise = null;
    }
  })();

  return await loadPromise;
};

/**
 * מחזיר שער המרה בין שני מטבעות, עם cache ליום שלם
 * @param {string} fromCurrency - המטבע המקורי (למשל "USD")
 * @param {string} toCurrency - המטבע שאליו רוצים להמיר (למשל "EUR")
 * @returns {Promise<number>} - שער ההמרה (כפול למחיר)
 */
export const getExchangeRate = async (fromCurrency, toCurrency) => {
  try {
    // נרמול קוד המטבע לאותיות גדולות
    const from = fromCurrency?.toUpperCase() || "USD";
    const to = toCurrency?.toUpperCase() || "EUR";

    // אם אותו מטבע, תחזיר 1
    if (from === to) {
      return 1.0;
    }

    // אם שני המטבעות הם מהמטבעות המרכזיים - השתמש ב-cache המרכזי
    if (
      SUPPORTED_CURRENCIES.includes(from) &&
      SUPPORTED_CURRENCIES.includes(to)
    ) {
      // טעינת שערים מרכזיים אם נדרש
      await loadBaseRates();

      const fromRate = baseRatesCache.get(from);
      const toRate = baseRatesCache.get(to);

      if (fromRate && toRate) {
        // המרה דרך EUR: from -> EUR -> to
        // fromRate הוא שער מ-from ל-EUR
        // toRate הוא שער מ-to ל-EUR
        // אז שער מ-from ל-to הוא: fromRate / toRate
        const rate = fromRate.rate / toRate.rate;

        return rate;
      }
    }

    // אם לא מהמטבעות המרכזיים, נשתמש ב-cache הרגיל או נשלוף מה-API
    const cacheKey = `${from}->${to}`;
    const now = Date.now();

    const cached = exchangeRateCache.get(cacheKey);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return cached.rate;
    }

    // שליפה מה-API רק אם זה מטבע שלא נפוץ
    const url = `https://api.exchangerate.host/convert?from=${from}&to=${to}`;
    const response = await axios.get(url, {
      timeout: 5000,
    });

    if (!response.data || typeof response.data.result !== "number") {
      throw new Error(
        `Invalid response from exchange rate API: ${JSON.stringify(
          response.data
        )}`
      );
    }

    const rate = response.data.result;

    // שמירה ב-cache
    exchangeRateCache.set(cacheKey, {
      rate,
      timestamp: now,
    });

    return rate;
  } catch (error) {
    logError(error, {
      operation: "getExchangeRate",
      fromCurrency,
      toCurrency,
    });

    const from = fromCurrency?.toUpperCase() || "USD";
    const to = toCurrency?.toUpperCase() || "EUR";

    // נסיון 1: חזור ל-cache ישן (גם אם פג תוקף)
    if (
      SUPPORTED_CURRENCIES.includes(from) &&
      SUPPORTED_CURRENCIES.includes(to)
    ) {
      const fromRate = baseRatesCache.get(from);
      const toRate = baseRatesCache.get(to);
      if (fromRate && toRate) {
        logWithCheckpoint(
          "warn",
          "Using stale cache rate (API failed)",
          "EXCHANGE_RATE_FALLBACK_001",
          {
            fromCurrency: from,
            toCurrency: to,
            rate: fromRate.rate / toRate.rate,
          }
        );
        return fromRate.rate / toRate.rate;
      }
    }

    // נסיון 2: cache רגיל (גם אם פג תוקף)
    const cacheKey = `${from}->${to}`;
    const cached = exchangeRateCache.get(cacheKey);
    if (cached) {
      logWithCheckpoint(
        "warn",
        "Using stale exchange rate cache (API failed)",
        "EXCHANGE_RATE_FALLBACK_002",
        {
          fromCurrency: from,
          toCurrency: to,
          rate: cached.rate,
        }
      );
      return cached.rate;
    }

    // נסיון 3: שערים קבועים (fallback)
    if (
      SUPPORTED_CURRENCIES.includes(from) &&
      SUPPORTED_CURRENCIES.includes(to)
    ) {
      const fallbackFromRate = FALLBACK_RATES[from];
      const fallbackToRate = FALLBACK_RATES[to];
      if (fallbackFromRate && fallbackToRate) {
        const fallbackRate = fallbackFromRate / fallbackToRate;
        logWithCheckpoint(
          "warn",
          "Using fixed fallback rate (API and cache failed)",
          "EXCHANGE_RATE_FALLBACK_003",
          {
            fromCurrency: from,
            toCurrency: to,
            rate: fallbackRate,
            note: "Rate may not be up-to-date",
          }
        );
        return fallbackRate;
      }
    }

    // אם כל הנסיונות נכשלו - מחזירים 1 (לא להפליץ)
    logWithCheckpoint(
      "error",
      "All exchange rate fallbacks failed, using 1.0",
      "EXCHANGE_RATE_FALLBACK_004",
      {
        fromCurrency: from,
        toCurrency: to,
        warning: "No conversion applied - prices may be inaccurate",
      }
    );
    return 1.0;
  }
};

/**
 * פונקציית עזר: המרת מחיר בין מטבעות
 * @param {number} amount - הסכום להמרה
 * @param {string} fromCurrency - המטבע המקורי
 * @param {string} toCurrency - המטבע המבוקש
 * @returns {Promise<number>} - המחיר לאחר המרה
 */
export const convertCurrency = async (amount, fromCurrency, toCurrency) => {
  if (!amount || amount <= 0) {
    throw new Error("Amount must be greater than 0");
  }

  const rate = await getExchangeRate(fromCurrency, toCurrency);
  return amount * rate;
};

/**
 * פונקציית עזר: ניקוי cache ידני (למקרי צורך)
 */
export const clearExchangeRateCache = () => {
  const baseSize = baseRatesCache.size;
  const otherSize = exchangeRateCache.size;
  baseRatesCache.clear();
  exchangeRateCache.clear();
  logWithCheckpoint(
    "info",
    "Exchange rate cache cleared",
    "EXCHANGE_RATE_005",
    {
      baseRatesCleared: baseSize,
      otherRatesCleared: otherSize,
    }
  );
  return baseSize + otherSize;
};

/**
 * פונקציית עזר: קבלת סטטיסטיקות cache
 */
export const getExchangeRateCacheStats = () => {
  const stats = {
    totalEntries: exchangeRateCache.size,
    entries: [],
  };

  const now = Date.now();
  for (const [key, value] of exchangeRateCache.entries()) {
    const ageHours = (now - value.timestamp) / (1000 * 60 * 60);
    stats.entries.push({
      key,
      rate: value.rate,
      ageHours: ageHours.toFixed(2),
      isValid: ageHours < 24,
    });
  }

  return stats;
};
