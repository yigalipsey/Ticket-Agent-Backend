import { LRUCache } from "lru-cache";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";

class LeagueCacheService {
  constructor() {
    // LRU Cache לליגות
    this.cache = new LRUCache({
      max: 200, // מקסימום 200 ליגות
      ttl: 1000 * 60 * 60, // שעה TTL
      allowStale: false,
      updateAgeOnGet: true,
    });

    logWithCheckpoint(
      "info",
      "LeagueCacheService initialized",
      "LEAGUE_CACHE_001",
      {
        maxSize: 200,
        ttl: "1 hour",
      }
    );
  }

  // יצירת מפתח cache
  generateCacheKey(leagueId, month) {
    return `league:${leagueId}:${month || "all"}`;
  }

  // קבלת נתונים מה-cache
  get(leagueId, month) {
    try {
      const cacheKey = this.generateCacheKey(leagueId, month);
      const cachedData = this.cache.get(cacheKey);

      if (cachedData) {
        logWithCheckpoint("info", "League cache hit", "LEAGUE_CACHE_002", {
          cacheKey,
          leagueId,
          month: month || "all",
          fixturesCount: cachedData.fixtures?.length || 0,
        });
        return cachedData;
      }

      logWithCheckpoint("debug", "League cache miss", "LEAGUE_CACHE_003", {
        cacheKey,
        leagueId,
        month: month || "all",
      });
      return null;
    } catch (error) {
      logError(error, { operation: "get", leagueId, month });
      return null;
    }
  }

  // שמירת נתונים ב-cache
  set(leagueId, month, data) {
    try {
      const cacheKey = this.generateCacheKey(leagueId, month);

      const cacheData = {
        ...data,
        cachedAt: new Date(),
        cacheKey,
        leagueId,
        month: month || "all",
      };

      this.cache.set(cacheKey, cacheData);

      logWithCheckpoint(
        "info",
        "League data cached successfully",
        "LEAGUE_CACHE_004",
        {
          cacheKey,
          leagueId,
          month: month || "all",
          fixturesCount: data.fixtures?.length || 0,
          cacheSize: this.cache.size,
        }
      );

      return true;
    } catch (error) {
      logError(error, { operation: "set", leagueId, month });
      return false;
    }
  }

  // בדיקת קיום נתונים ב-cache
  has(leagueId, month) {
    try {
      const cacheKey = this.generateCacheKey(leagueId, month);
      const exists = this.cache.has(cacheKey);

      logWithCheckpoint(
        "debug",
        "League cache existence check",
        "LEAGUE_CACHE_005",
        {
          cacheKey,
          exists,
        }
      );

      return exists;
    } catch (error) {
      logError(error, { operation: "has", leagueId, month });
      return false;
    }
  }

  // מחיקת נתונים של ליגה
  delete(leagueId, month) {
    try {
      const cacheKey = this.generateCacheKey(leagueId, month);
      const deleted = this.cache.delete(cacheKey);

      logWithCheckpoint(
        "info",
        "League cache entry deleted",
        "LEAGUE_CACHE_006",
        {
          cacheKey,
          deleted,
        }
      );

      return deleted;
    } catch (error) {
      logError(error, { operation: "delete", leagueId, month });
      return false;
    }
  }

  // מחיקת כל הנתונים של ליגה מסוימת
  deleteLeague(leagueId) {
    try {
      let deletedCount = 0;
      const keysToDelete = [];

      // איתור כל המפתחות של הליגה
      for (const [key] of this.cache.entries()) {
        if (key.startsWith(`league:${leagueId}:`)) {
          keysToDelete.push(key);
        }
      }

      // מחיקת המפתחות
      keysToDelete.forEach((key) => {
        if (this.cache.delete(key)) {
          deletedCount++;
        }
      });

      logWithCheckpoint("info", "League cache cleared", "LEAGUE_CACHE_007", {
        leagueId,
        deletedCount,
        remainingCacheSize: this.cache.size,
      });

      return deletedCount;
    } catch (error) {
      logError(error, { operation: "deleteLeague", leagueId });
      return 0;
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
}

// יצירת instance יחיד (Singleton)
const leagueCacheService = new LeagueCacheService();

export default leagueCacheService;
