import { LRUCache } from "lru-cache";
import FootballEvent from "../../../models/FootballEvent.js";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";

// Cache מקומי לשמירת slug → fixtureId
const fixtureIdBySlugCache = new LRUCache({
  max: 2000, // מקסימום 2000 משחקים
  ttl: 1000 * 60 * 60 * 24 * 7, // שבוע TTL
  allowStale: false,
  updateAgeOnGet: true,
});

logWithCheckpoint(
  "info",
  "Fixture ID by slug cache initialized",
  "FIXTURE_SLUG_CACHE_INIT",
  {
    maxSize: 2000,
    ttl: "7 days",
  }
);

/**
 * קבלת ID של משחק לפי slug עם cache מובנה
 * Cache TTL: שבוע
 */
export const getFixtureIdBySlug = async (slug) => {
  try {
    logWithCheckpoint(
      "info",
      "Fetching fixture ID by slug",
      "FIXTURE_SLUG_001",
      {
        slug,
      }
    );

    // בדיקת cache
    const cacheKey = `slug:${slug}`;
    const cachedId = fixtureIdBySlugCache.get(cacheKey);

    if (cachedId) {
      logWithCheckpoint(
        "info",
        "Fixture ID found in cache (ultra-fast)",
        "FIXTURE_SLUG_002",
        {
          slug,
          fixtureId: cachedId,
          fromCache: true,
        }
      );

      return {
        _id: cachedId,
        slug,
        fromCache: true,
      };
    }

    // Cache miss - שליפה מינימלית מה-DB
    logWithCheckpoint(
      "info",
      "Cache miss - fetching fixture ID from database",
      "FIXTURE_SLUG_003",
      {
        slug,
      }
    );

    // 1. Try exact match first
    let fixture = await FootballEvent.findOne({ slug })
      .select("_id slug date")
      .lean();

    // 2. If no exact match, try partial match (slug starts with the input)
    if (!fixture) {
      logWithCheckpoint(
        "info",
        "Exact slug match failed, trying partial match",
        "FIXTURE_SLUG_003b",
        { slug }
      );

      // Search for slugs starting with the input (case-insensitive)
      fixture = await FootballEvent.findOne({
        slug: { $regex: new RegExp(`^${slug}`, "i") }
      })
        .select("_id slug date")
        .lean();
    }

    if (!fixture) {
      logWithCheckpoint(
        "warn",
        "Fixture not found by slug (even with partial match)",
        "FIXTURE_SLUG_004",
        {
          slug,
        }
      );
      return null;
    }

    const fixtureId = fixture._id.toString();

    // שמירה ב-cache
    fixtureIdBySlugCache.set(cacheKey, fixtureId);

    logWithCheckpoint(
      "info",
      "Fixture ID found in database and cached",
      "FIXTURE_SLUG_005",
      {
        slug,
        fixtureId,
        fromCache: false,
        cacheSize: fixtureIdBySlugCache.size,
      }
    );

    return {
      _id: fixtureId,
      slug,
      fromCache: false,
    };
  } catch (error) {
    logError(error, {
      operation: "getFixtureIdBySlug",
      slug,
    });
    throw error;
  }
};

/**
 * פונקציית עזר: ניקוי cache ידני (למקרי צורך)
 */
export const clearFixtureSlugCache = () => {
  try {
    const size = fixtureIdBySlugCache.size;
    fixtureIdBySlugCache.clear();

    logWithCheckpoint(
      "info",
      "Fixture slug cache cleared",
      "FIXTURE_SLUG_CACHE_CLEAR",
      {
        clearedEntries: size,
      }
    );

    return size;
  } catch (error) {
    logError(error, { operation: "clearFixtureSlugCache" });
    return 0;
  }
};

/**
 * פונקציית עזר: קבלת סטטיסטיקות cache
 */
export const getFixtureSlugCacheStats = () => {
  try {
    const stats = {
      size: fixtureIdBySlugCache.size,
      maxSize: fixtureIdBySlugCache.max,
      ttl: fixtureIdBySlugCache.ttl,
      calculatedSize: fixtureIdBySlugCache.calculatedSize,
    };

    logWithCheckpoint(
      "info",
      "Fixture slug cache statistics",
      "FIXTURE_SLUG_CACHE_STATS",
      stats
    );

    return stats;
  } catch (error) {
    logError(error, { operation: "getFixtureSlugCacheStats" });
    return null;
  }
};
