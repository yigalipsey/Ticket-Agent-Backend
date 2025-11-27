import { LRUCache } from "lru-cache";
import FootballEvent from "../../../models/FootballEvent.js";
import {
  immutableArrayCopy,
  normalizeMongoData,
} from "../../../utils/immutable.js";

/**
 * שירות לשליפת משחקים חמים
 */
class HotFixturesService {
  // Cache פנימי ל-Service
  static cache = new LRUCache({
    max: 50, // עד 50 רשומות
    ttl: 1000 * 60 * 60 * 8, // 8 שעות
  });
  /**
   * שליפת משחקים חמים
   * @param {Object} options - אפשרויות סינון
   * @param {number} options.limit - מספר משחקים מקסימלי
   * @param {string} options.sortBy - שדה למיון
   * @param {string} options.sortOrder - כיוון מיון
   * @param {Date} options.fromDate - תאריך התחלה
   * @param {Date} options.toDate - תאריך סיום
   * @returns {Promise<Object>} תוצאה עם משחקים חמים
   */
  static async getHotFixtures(options = {}) {
    const {
      limit = 10,
      sortBy = "date",
      sortOrder = "asc",
      fromDate,
      toDate,
    } = options;

    // יצירת מפתח cache
    const cacheKey = JSON.stringify({
      limit,
      sortBy,
      sortOrder,
      fromDate,
      toDate,
    });

    // בדיקת cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log("🔥 [HotFixturesService] Cache hit", { cacheKey });
      return {
        success: true,
        data: immutableArrayCopy(cached),
        count: cached.length,
        message: `נמצאו ${cached.length} משחקים חמים (מ-cache)`,
        fromCache: true,
      };
    }

    console.log("🔥 [HotFixturesService] Cache miss", { cacheKey });

    // בניית query
    const query = { isHot: true };

    // הוספת סינון לפי תאריכים
    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = new Date(fromDate);
      if (toDate) query.date.$lte = new Date(toDate);
    }

    // בניית sort
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // שליפת משחקים חמים
    const hotFixturesRaw = await FootballEvent.find(query)
      .populate("league", "name slug country nameHe")
      .populate("homeTeam", "name name_en slug logoUrl")
      .populate("awayTeam", "name name_en slug logoUrl")
      .populate("venue", "name city_en capacity city_he")
      .select("+minPrice") // Include minPrice (hidden field)
      .sort(sort)
      .limit(limit)
      .lean();

    // Remove unnecessary fields from response
    const hotFixtures = hotFixturesRaw.map((fixture) => {
      const {
        status,
        round,
        externalIds,
        createdAt,
        updatedAt,
        __v,
        supplierExternalIds,
        ...rest
      } = fixture;
      return rest;
    });

    // נרמול ObjectIds לפני שמירה ב-cache
    const normalizedFixtures = normalizeMongoData(hotFixtures);

    // שמירה ב-cache
    this.cache.set(cacheKey, normalizedFixtures);
    console.log("🔥 [HotFixturesService] Data cached", {
      cacheKey,
      fixturesCount: normalizedFixtures.length,
    });

    return {
      success: true,
      data: normalizedFixtures,
      count: normalizedFixtures.length,
      message: `נמצאו ${normalizedFixtures.length} משחקים חמים`,
      fromCache: false,
    };
  }

  /**
   * שליפת משחקים חמים קרובים (בחודש הקרוב) עם cache
   * @param {number} limit - מספר משחקים מקסימלי
   * @returns {Promise<Object>} משחקים חמים קרובים
   */
  static async getUpcomingHotFixtures(limit = 5) {
    const cacheKey = `upcoming:${limit}`;

    // בדיקה אם יש נתונים ב-cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log("🔥 [HotFixturesService] Upcoming cache hit", { cacheKey });
      return {
        success: true,
        data: immutableArrayCopy(cached),
        count: cached.length,
        message: `נמצאו ${cached.length} משחקים חמים (מ-cache)`,
        fromCache: true,
      };
    }

    console.log("🔥 [HotFixturesService] Upcoming cache miss", { cacheKey });

    // אם אין ב-cache, מביא מהמסד נתונים
    const now = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(now.getMonth() + 1);

    const result = await this.getHotFixtures({
      limit,
      sortBy: "date",
      sortOrder: "asc",
      fromDate: now,
      toDate: nextMonth,
    });

    // שמירה ב-cache אם הצליח
    if (result.success && result.data) {
      this.cache.set(cacheKey, result.data);
      console.log("🔥 [HotFixturesService] Upcoming data cached", {
        cacheKey,
        fixturesCount: result.data.length,
      });
    }

    return {
      ...result,
      fromCache: false,
    };
  }

  /**
   * איפוס cache של משחקים חמים
   * @returns {Object} תוצאה של ניקוי cache
   */
  static clearCache() {
    const size = this.cache.size;
    this.cache.clear();
    console.log("🔥 [HotFixturesService] Cache cleared", {
      clearedEntries: size,
    });

    return {
      success: true,
      clearedEntries: size,
      message: `Cache נוקה בהצלחה - ${size} רשומות נמחקו`,
    };
  }
}

export default HotFixturesService;
