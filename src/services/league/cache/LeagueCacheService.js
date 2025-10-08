import { LRUCache } from "lru-cache";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";

class LeagueCacheService {
  constructor() {
    // LRU Cache לליגות
    this.cache = new LRUCache({
      max: 50, // מקסימום 50 entries (ליגות עם ובלי קבוצות)
      ttl: 1000 * 60 * 60 * 24, // יום שלם TTL
      allowStale: false,
      updateAgeOnGet: true,
    });

    // LRU Cache מהיר למיפוי slug → ID
    // זה cache קטן וקל שחוסך queries למונגו
    this.slugToIdCache = new LRUCache({
      max: 100, // מקסימום 100 מיפויים (קטן ומהיר)
      ttl: 1000 * 60 * 60 * 24 * 7, // שבוע TTL (slugs לא משתנים)
      allowStale: false,
      updateAgeOnGet: true,
    });

    logWithCheckpoint(
      "info",
      "LeagueCacheService initialized",
      "LEAGUE_CACHE_001",
      {
        leaguesCache: { maxSize: 50, ttl: "24 hours" },
        slugToIdCache: { maxSize: 100, ttl: "7 days" },
      }
    );
  }

  /**
   * יצירת מפתח cache
   */
  generateCacheKey(withTeams) {
    const cacheKey = `leagues:${withTeams ? "with-teams" : "without-teams"}`;

    logWithCheckpoint(
      "debug",
      "Generated league cache key",
      "LEAGUE_CACHE_002",
      {
        cacheKey,
        withTeams,
      }
    );

    return cacheKey;
  }

  // קבלת נתונים מה-cache
  get(withTeams) {
    try {
      const cacheKey = this.generateCacheKey(withTeams);
      const cachedData = this.cache.get(cacheKey);

      if (cachedData) {
        logWithCheckpoint("info", "League cache hit", "LEAGUE_CACHE_003", {
          cacheKey,
          withTeams,
          leaguesCount: cachedData.leagues?.length || 0,
        });
        return cachedData;
      }

      logWithCheckpoint("debug", "League cache miss", "LEAGUE_CACHE_004", {
        cacheKey,
        withTeams,
      });
      return null;
    } catch (error) {
      logError(error, { operation: "get", withTeams });
      return null;
    }
  }

  // שמירת נתונים ב-cache
  set(withTeams, data) {
    try {
      const cacheKey = this.generateCacheKey(withTeams);

      const cacheData = {
        ...data,
        cachedAt: new Date(),
        cacheKey,
        withTeams,
      };

      this.cache.set(cacheKey, cacheData);

      logWithCheckpoint(
        "info",
        "League data cached successfully",
        "LEAGUE_CACHE_005",
        {
          cacheKey,
          withTeams,
          leaguesCount: data.leagues?.length || 0,
          cacheSize: this.cache.size,
        }
      );

      return true;
    } catch (error) {
      logError(error, { operation: "set", withTeams });
      return false;
    }
  }

  // בדיקת קיום נתונים ב-cache
  has(withTeams) {
    try {
      const cacheKey = this.generateCacheKey(withTeams);
      const exists = this.cache.has(cacheKey);

      logWithCheckpoint(
        "debug",
        "League cache existence check",
        "LEAGUE_CACHE_006",
        {
          cacheKey,
          exists,
        }
      );

      return exists;
    } catch (error) {
      logError(error, { operation: "has", withTeams });
      return false;
    }
  }

  // מחיקת נתונים
  delete(withTeams) {
    try {
      const cacheKey = this.generateCacheKey(withTeams);
      const deleted = this.cache.delete(cacheKey);

      logWithCheckpoint(
        "info",
        "League cache entry deleted",
        "LEAGUE_CACHE_007",
        {
          cacheKey,
          deleted,
        }
      );

      return deleted;
    } catch (error) {
      logError(error, { operation: "delete", withTeams });
      return false;
    }
  }

  // ניקוי כל ה-cache
  clear() {
    try {
      const size = this.cache.size;
      this.cache.clear();

      logWithCheckpoint(
        "info",
        "League cache cleared completely",
        "LEAGUE_CACHE_008",
        {
          clearedEntries: size,
        }
      );

      return size;
    } catch (error) {
      logError(error, { operation: "clear" });
      return 0;
    }
  }

  // קבלת סטטיסטיקות cache
  getStats() {
    try {
      const stats = {
        size: this.cache.size,
        maxSize: this.cache.max,
        ttl: this.cache.ttl,
        calculatedSize: this.cache.calculatedSize,
        slugToIdCacheSize: this.slugToIdCache.size,
      };

      logWithCheckpoint(
        "info",
        "League cache statistics",
        "LEAGUE_CACHE_009",
        stats
      );
      return stats;
    } catch (error) {
      logError(error, { operation: "getStats" });
      return null;
    }
  }

  // ========================================
  // Slug → ID Cache (אולטרה מהיר!)
  // ========================================

  /**
   * קבלת ID לפי slug מה-cache
   * @param {string} slug - הslug של הליגה
   * @returns {string|null} - ה-ID או null אם לא נמצא
   */
  getLeagueIdBySlug(slug) {
    try {
      const leagueId = this.slugToIdCache.get(slug);

      if (leagueId) {
        logWithCheckpoint(
          "info",
          "Slug→ID cache hit",
          "LEAGUE_SLUG_CACHE_001",
          {
            slug,
            leagueId,
          }
        );
        return leagueId;
      }

      logWithCheckpoint(
        "debug",
        "Slug→ID cache miss",
        "LEAGUE_SLUG_CACHE_002",
        {
          slug,
        }
      );
      return null;
    } catch (error) {
      logError(error, { operation: "getLeagueIdBySlug", slug });
      return null;
    }
  }

  /**
   * שמירת מיפוי slug → ID
   * @param {string} slug - הslug של הליגה
   * @param {string} leagueId - ה-ID של הליגה
   */
  setLeagueIdBySlug(slug, leagueId) {
    try {
      this.slugToIdCache.set(slug, leagueId);

      logWithCheckpoint(
        "info",
        "Slug→ID mapping cached",
        "LEAGUE_SLUG_CACHE_003",
        {
          slug,
          leagueId,
          cacheSize: this.slugToIdCache.size,
        }
      );

      return true;
    } catch (error) {
      logError(error, { operation: "setLeagueIdBySlug", slug, leagueId });
      return false;
    }
  }

  /**
   * עדכון מסיבי של מיפויי slug→ID (כשמביאים את כל הליגות)
   * @param {Array} leagues - מערך ליגות עם slug ו-_id
   */
  bulkSetSlugToIdMappings(leagues) {
    try {
      let count = 0;
      for (const league of leagues) {
        if (league.slug && league._id) {
          this.slugToIdCache.set(league.slug, league._id.toString());
          count++;
        }
      }

      logWithCheckpoint(
        "info",
        "Bulk slug→ID mappings cached",
        "LEAGUE_SLUG_CACHE_004",
        {
          mappingsAdded: count,
          totalLeagues: leagues.length,
          cacheSize: this.slugToIdCache.size,
        }
      );

      return count;
    } catch (error) {
      logError(error, { operation: "bulkSetSlugToIdMappings" });
      return 0;
    }
  }

  /**
   * מחיקת מיפוי slug → ID
   * @param {string} slug - הslug למחיקה
   */
  deleteSlugToIdMapping(slug) {
    try {
      const deleted = this.slugToIdCache.delete(slug);

      logWithCheckpoint(
        "info",
        "Slug→ID mapping deleted",
        "LEAGUE_SLUG_CACHE_005",
        {
          slug,
          deleted,
        }
      );

      return deleted;
    } catch (error) {
      logError(error, { operation: "deleteSlugToIdMapping", slug });
      return false;
    }
  }
}

// יצירת instance יחיד (Singleton)
const leagueCacheService = new LeagueCacheService();

export default leagueCacheService;
