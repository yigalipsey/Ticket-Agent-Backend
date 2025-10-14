import { LRUCache } from "lru-cache";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";

class OffersByFixtureCacheService {
  constructor() {
    this.cache = new LRUCache({
      max: 1000, // מקסימום 1000 משחקים
      ttl: 1000 * 60 * 15, // 15 דקות TTL (הצעות משתנות יותר מהר)
      allowStale: false,
      updateAgeOnGet: true,
    });

    logWithCheckpoint(
      "info",
      "OffersByFixtureCacheService initialized",
      "OFFERS_BY_FIXTURE_CACHE_001",
      {
        maxSize: 1000,
        ttl: "15 minutes",
      }
    );
  }

  // יצירת מפתח cache פשוט - רק משחק
  generateCacheKey(fixtureId) {
    return `fixture:${fixtureId}:offers`;
  }

  // קבלת נתונים מה-cache
  get(fixtureId) {
    try {
      const cacheKey = this.generateCacheKey(fixtureId);
      const cachedData = this.cache.get(cacheKey);

      if (cachedData) {
        logWithCheckpoint(
          "info",
          "Offers by fixture cache hit",
          "OFFERS_BY_FIXTURE_CACHE_002",
          {
            cacheKey,
            fixtureId,
            offersCount: cachedData.offers?.length || 0,
          }
        );
        return cachedData;
      }

      logWithCheckpoint(
        "debug",
        "Offers by fixture cache miss",
        "OFFERS_BY_FIXTURE_CACHE_003",
        {
          cacheKey,
          fixtureId,
        }
      );
      return null;
    } catch (error) {
      logError(error, { operation: "get", fixtureId });
      return null;
    }
  }

  // שמירת נתונים ב-cache
  set(fixtureId, data) {
    try {
      const cacheKey = this.generateCacheKey(fixtureId);

      const cacheData = {
        ...data,
        cachedAt: new Date(),
        cacheKey,
        fixtureId,
      };

      this.cache.set(cacheKey, cacheData);

      logWithCheckpoint(
        "info",
        "Offers by fixture cached successfully",
        "OFFERS_BY_FIXTURE_CACHE_004",
        {
          cacheKey,
          fixtureId,
          offersCount: data.offers?.length || 0,
          cacheSize: this.cache.size,
        }
      );

      return true;
    } catch (error) {
      logError(error, { operation: "set", fixtureId });
      return false;
    }
  }

  // בדיקת קיום נתונים ב-cache
  has(fixtureId) {
    try {
      const cacheKey = this.generateCacheKey(fixtureId);
      const exists = this.cache.has(cacheKey);

      logWithCheckpoint(
        "debug",
        "Offers by fixture cache existence check",
        "OFFERS_BY_FIXTURE_CACHE_005",
        {
          cacheKey,
          exists,
          fixtureId,
        }
      );

      return exists;
    } catch (error) {
      logError(error, { operation: "has", fixtureId });
      return false;
    }
  }

  // מחיקת נתונים של משחק
  delete(fixtureId) {
    try {
      const cacheKey = this.generateCacheKey(fixtureId);
      const deleted = this.cache.delete(cacheKey);

      logWithCheckpoint(
        "info",
        "Offers by fixture cache entry deleted",
        "OFFERS_BY_FIXTURE_CACHE_006",
        {
          cacheKey,
          deleted,
          fixtureId,
        }
      );

      return deleted;
    } catch (error) {
      logError(error, { operation: "delete", fixtureId });
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
        "Offers by fixture cache cleared completely",
        "OFFERS_BY_FIXTURE_CACHE_007",
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
        "Offers by fixture cache statistics",
        "OFFERS_BY_FIXTURE_CACHE_008",
        stats
      );
      return stats;
    } catch (error) {
      logError(error, { operation: "getStats" });
      return null;
    }
  }

  // פונקציה נוספת: מחיקת cache עבור מספר משחקים בבת אחת
  deleteMultiple(fixtureIds) {
    try {
      let deletedCount = 0;
      for (const fixtureId of fixtureIds) {
        if (this.delete(fixtureId)) {
          deletedCount++;
        }
      }

      logWithCheckpoint(
        "info",
        "Multiple fixture offers cache entries deleted",
        "OFFERS_BY_FIXTURE_CACHE_009",
        {
          total: fixtureIds.length,
          deleted: deletedCount,
        }
      );

      return deletedCount;
    } catch (error) {
      logError(error, { operation: "deleteMultiple", fixtureIds });
      return 0;
    }
  }

  // פונקציה נוספת: רענון cache עבור משחק ספציפי
  refresh(fixtureId, data) {
    try {
      // מחיקה ושמירה מחדש
      this.delete(fixtureId);
      return this.set(fixtureId, data);
    } catch (error) {
      logError(error, { operation: "refresh", fixtureId });
      return false;
    }
  }
}

const offersByFixtureCacheService = new OffersByFixtureCacheService();
export default offersByFixtureCacheService;
