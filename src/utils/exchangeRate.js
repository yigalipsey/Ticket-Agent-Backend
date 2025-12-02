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

// שמירת השער האחרון כגיבוי (תמיד)
let lastLoadedRates = null;

/**
 * טעינת שערים מה-API (לקריאה מ-worker בלבד - לא בזמן אמת!)
 * פונקציה זו נקראת פעם ביום דרך worker
 */
export const loadBaseRatesFromAPI = async () => {
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

    // שמירת השערים האחרונים כגיבוי
    lastLoadedRates = {
      rates: Object.fromEntries(
        Array.from(baseRatesCache.entries()).map(([key, value]) => [
          key,
          value.rate,
        ])
      ),
      timestamp,
    };

    logWithCheckpoint(
      "info",
      "Base exchange rates loaded successfully",
      "EXCHANGE_RATE_LOAD_002",
      {
        loadedCurrencies: Array.from(baseRatesCache.keys()),
        timestamp: new Date(timestamp).toISOString(),
      }
    );

    return {
      success: true,
      loadedCurrencies: Array.from(baseRatesCache.keys()),
      timestamp: new Date(timestamp).toISOString(),
    };
  } catch (error) {
    logError(error, { operation: "loadBaseRatesFromAPI" });

    // ניסיון 1: אם יש שערים שטענו בעבר - נשתמש בהם
    if (lastLoadedRates) {
      logWithCheckpoint(
        "warn",
        "API failed, using last loaded rates as fallback",
        "EXCHANGE_RATE_LOAD_LAST_FALLBACK",
        {
          lastLoadedTimestamp: new Date(
            lastLoadedRates.timestamp
          ).toISOString(),
          currencies: Object.keys(lastLoadedRates.rates),
        }
      );

      const now = Date.now();
      for (const [currency, rate] of Object.entries(lastLoadedRates.rates)) {
        baseRatesCache.set(currency, {
          rate,
          timestamp: now, // עדכון timestamp כדי שימשיך לעבוד
        });
      }

      return {
        success: false,
        error: error.message,
        usedFallback: true,
        fallbackType: "lastLoadedRates",
      };
    }

    // ניסיון 2: נטען שערים קבועים
    logWithCheckpoint(
      "warn",
      "API failed, loading fixed fallback rates",
      "EXCHANGE_RATE_LOAD_FALLBACK",
      {
        currencies: SUPPORTED_CURRENCIES.filter((c) => c !== "EUR"),
      }
    );

    const fallbackTimestamp = Date.now();
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

    return {
      success: false,
      error: error.message,
      usedFallback: true,
      fallbackType: "fixedRates",
    };
  }
};

/**
 * בדיקה אם יש cache תקין (לא קורא ל-API)
 */
const checkCache = () => {
  const now = Date.now();
  const needsRefresh = SUPPORTED_CURRENCIES.some((currency) => {
    if (currency === "EUR") return false;
    const cached = baseRatesCache.get(currency);
    return !cached || now - cached.timestamp >= CACHE_TTL_MS;
  });
  return !needsRefresh;
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
      // בדיקה אם יש cache - אם לא, נשתמש ב-fallback (ללא קריאת API!)
      if (!checkCache()) {
        // Cache פג תוקף - נשתמש ב-fallback
        logWithCheckpoint(
          "warn",
          "Exchange rate cache expired, using fallback (no API call)",
          "EXCHANGE_RATE_CACHE_EXPIRED",
          {
            fromCurrency: from,
            toCurrency: to,
          }
        );
      }

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

    // אם לא מהמטבעות המרכזיים, נשתמש ב-cache הרגיל בלבד (ללא קריאת API!)
    const cacheKey = `${from}->${to}`;
    const now = Date.now();

    const cached = exchangeRateCache.get(cacheKey);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return cached.rate;
    }

    // Cache פג תוקף - לא עושים קריאת API, נשתמש ב-fallback
    logWithCheckpoint(
      "warn",
      "Exchange rate cache expired for non-standard currency, cannot convert",
      "EXCHANGE_RATE_UNSUPPORTED",
      {
        fromCurrency: from,
        toCurrency: to,
      }
    );

    // זורק שגיאה כדי שניפול ל-fallback
    throw new Error(
      `Exchange rate for ${from}->${to} not in cache and API calls disabled`
    );
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
