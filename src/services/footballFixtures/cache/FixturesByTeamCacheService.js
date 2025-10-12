import { LRUCache } from "lru-cache";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";

class FixturesByTeamCacheService {
  constructor() {
    this.cache = new LRUCache({
      max: 500, // מקסימום 500 קבוצות
      ttl: 1000 * 60 * 60, // שעה TTL
      allowStale: false,
      updateAgeOnGet: true,
    });

    logWithCheckpoint(
      "info",
      "FixturesByTeamCacheService initialized",
      "FIXTURES_BY_TEAM_CACHE_001",
      {
        maxSize: 500,
        ttl: "1 hour",
      }
    );
  }

  // יצירת מפתח cache פשוט - רק קבוצה
  generateCacheKey(teamId) {
    return `team:${teamId}:all`;
  }

  // קבלת נתונים מה-cache
  get(teamId) {
    try {
      const cacheKey = this.generateCacheKey(teamId);
      const cachedData = this.cache.get(cacheKey);

      if (cachedData) {
        logWithCheckpoint(
          "info",
          "Fixtures by team cache hit",
          "FIXTURES_BY_TEAM_CACHE_002",
          {
            cacheKey,
            teamId,
            fixturesCount: cachedData.footballEvents?.length || 0,
          }
        );
        return cachedData;
      }

      logWithCheckpoint(
        "debug",
        "Fixtures by team cache miss",
        "FIXTURES_BY_TEAM_CACHE_003",
        {
          cacheKey,
          teamId,
        }
      );
      return null;
    } catch (error) {
      logError(error, { operation: "get", teamId });
      return null;
    }
  }

  // שמירת נתונים ב-cache
  set(teamId, data) {
    try {
      const cacheKey = this.generateCacheKey(teamId);

      const cacheData = {
        ...data,
        cachedAt: new Date(),
        cacheKey,
        teamId,
      };

      this.cache.set(cacheKey, cacheData);

      logWithCheckpoint(
        "info",
        "Fixtures by team cached successfully",
        "FIXTURES_BY_TEAM_CACHE_004",
        {
          cacheKey,
          teamId,
          fixturesCount: data.footballEvents?.length || 0,
          cacheSize: this.cache.size,
        }
      );

      return true;
    } catch (error) {
      logError(error, { operation: "set", teamId });
      return false;
    }
  }

  // בדיקת קיום נתונים ב-cache
  has(teamId) {
    try {
      const cacheKey = this.generateCacheKey(teamId);
      const exists = this.cache.has(cacheKey);

      logWithCheckpoint(
        "debug",
        "Fixtures by team cache existence check",
        "FIXTURES_BY_TEAM_CACHE_005",
        {
          cacheKey,
          exists,
          teamId,
        }
      );

      return exists;
    } catch (error) {
      logError(error, { operation: "has", teamId });
      return false;
    }
  }

  // מחיקת נתונים של קבוצה
  delete(teamId) {
    try {
      const cacheKey = this.generateCacheKey(teamId);
      const deleted = this.cache.delete(cacheKey);

      logWithCheckpoint(
        "info",
        "Fixtures by team cache entry deleted",
        "FIXTURES_BY_TEAM_CACHE_006",
        {
          cacheKey,
          deleted,
          teamId,
        }
      );

      return deleted;
    } catch (error) {
      logError(error, { operation: "delete", teamId });
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
        "Fixtures by team cache cleared completely",
        "FIXTURES_BY_TEAM_CACHE_007",
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
        "Fixtures by team cache statistics",
        "FIXTURES_BY_TEAM_CACHE_008",
        stats
      );
      return stats;
    } catch (error) {
      logError(error, { operation: "getStats" });
      return null;
    }
  }
}

const fixturesByTeamCacheService = new FixturesByTeamCacheService();
export default fixturesByTeamCacheService;
