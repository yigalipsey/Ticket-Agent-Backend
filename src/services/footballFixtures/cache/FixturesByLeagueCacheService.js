import { LRUCache } from "lru-cache";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";

class FixturesByLeagueCacheService {
  constructor() {
    this.cache = new LRUCache({
      max: 200, // מקסימום 200 ליגות
      ttl: 1000 * 60 * 60, // שעה TTL
      allowStale: false,
      updateAgeOnGet: true,
    });

    logWithCheckpoint(
      "info",
      "FixturesByLeagueCacheService initialized",
      "FIXTURES_BY_LEAGUE_CACHE_001",
      {
        maxSize: 200,
        ttl: "1 hour",
      }
    );
  }

  // יצירת מפתח cache גמיש
  generateCacheKey(leagueId, opts = {}) {
    const { month = null, venueId = null } = opts;

    if (month) {
      return `league:${leagueId}:month:${month}`;
    }
    if (venueId) {
      return `league:${leagueId}:venue:${venueId}`;
    }
    return `league:${leagueId}:all`;
  }

  // קבלת נתונים מה-cache
  get(leagueId, opts = {}) {
    try {
      const cacheKey = this.generateCacheKey(leagueId, opts);
      const cachedData = this.cache.get(cacheKey);

      if (cachedData) {
        logWithCheckpoint(
          "info",
          "Fixtures by league cache hit",
          "FIXTURES_BY_LEAGUE_CACHE_002",
          {
            cacheKey,
            leagueId,
            ...opts,
            fixturesCount: cachedData.fixtures?.length || 0,
          }
        );
        return cachedData;
      }

      logWithCheckpoint(
        "debug",
        "Fixtures by league cache miss",
        "FIXTURES_BY_LEAGUE_CACHE_003",
        {
          cacheKey,
          leagueId,
          ...opts,
        }
      );
      return null;
    } catch (error) {
      logError(error, { operation: "get", leagueId, ...opts });
      return null;
    }
  }

  // שמירת נתונים ב-cache
  set(leagueId, data, opts = {}) {
    try {
      const cacheKey = this.generateCacheKey(leagueId, opts);

      const cacheData = {
        ...data,
        cachedAt: new Date(),
        cacheKey,
        leagueId,
        month: opts.month || "all",
        venueId: opts.venueId || "all",
      };

      this.cache.set(cacheKey, cacheData);

      logWithCheckpoint(
        "info",
        "Fixtures by league cached successfully",
        "FIXTURES_BY_LEAGUE_CACHE_004",
        {
          cacheKey,
          leagueId,
          ...opts,
          fixturesCount: data.fixtures?.length || 0,
          cacheSize: this.cache.size,
        }
      );

      return true;
    } catch (error) {
      logError(error, { operation: "set", leagueId, ...opts });
      return false;
    }
  }

  // בדיקת קיום נתונים ב-cache
  has(leagueId, opts = {}) {
    try {
      const cacheKey = this.generateCacheKey(leagueId, opts);
      const exists = this.cache.has(cacheKey);

      logWithCheckpoint(
        "debug",
        "Fixtures by league cache existence check",
        "FIXTURES_BY_LEAGUE_CACHE_005",
        {
          cacheKey,
          exists,
          leagueId,
          ...opts,
        }
      );

      return exists;
    } catch (error) {
      logError(error, { operation: "has", leagueId, ...opts });
      return false;
    }
  }

  // מחיקת נתונים של ליגה
  delete(leagueId, opts = {}) {
    try {
      const cacheKey = this.generateCacheKey(leagueId, opts);
      const deleted = this.cache.delete(cacheKey);

      logWithCheckpoint(
        "info",
        "Fixtures by league cache entry deleted",
        "FIXTURES_BY_LEAGUE_CACHE_006",
        {
          cacheKey,
          deleted,
          leagueId,
          ...opts,
        }
      );

      return deleted;
    } catch (error) {
      logError(error, { operation: "delete", leagueId, ...opts });
      return false;
    }
  }

  // מחיקת כל הנתונים של ליגה מסוימת
  deleteLeague(leagueId) {
    try {
      let deletedCount = 0;
      const keysToDelete = [];

      for (const [key] of this.cache.entries()) {
        if (key.startsWith(`league:${leagueId}:`)) {
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach((key) => {
        if (this.cache.delete(key)) {
          deletedCount++;
        }
      });

      logWithCheckpoint(
        "info",
        "Fixtures by league cache cleared",
        "FIXTURES_BY_LEAGUE_CACHE_007",
        {
          leagueId,
          deletedCount,
          remainingCacheSize: this.cache.size,
        }
      );

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
        "Fixtures by league cache cleared completely",
        "FIXTURES_BY_LEAGUE_CACHE_008",
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
        "Fixtures by league cache statistics",
        "FIXTURES_BY_LEAGUE_CACHE_009",
        stats
      );
      return stats;
    } catch (error) {
      logError(error, { operation: "getStats" });
      return null;
    }
  }
}

const fixturesByLeagueCacheService = new FixturesByLeagueCacheService();
export default fixturesByLeagueCacheService;
