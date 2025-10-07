import { logWithCheckpoint } from "../../../utils/logger.js";

/**
 * יצירת מפתח cache לליגה
 */
export const generateLeagueCacheKey = (leagueId, month) => {
  const cacheKey = `league:${leagueId}:${month || "all"}`;

  logWithCheckpoint("debug", "Generated league cache key", "CACHE_KEY_001", {
    cacheKey,
    leagueId,
    month: month || "all",
  });

  return cacheKey;
};

/**
 * יצירת מפתח cache לקבוצה
 */
export const generateTeamCacheKey = (teamId, month) => {
  const cacheKey = `team:${teamId}:${month || "all"}`;

  logWithCheckpoint("debug", "Generated team cache key", "CACHE_KEY_002", {
    cacheKey,
    teamId,
    month: month || "all",
  });

  return cacheKey;
};

/**
 * פירוק מפתח cache
 */
export const parseCacheKey = (cacheKey) => {
  const parts = cacheKey.split(":");

  if (parts.length < 2) {
    return null;
  }

  const [type, id, month] = parts;

  return {
    type, // "league" או "team"
    id,
    month: month || "all",
  };
};

/**
 * בדיקה אם מפתח cache הוא של ליגה
 */
export const isLeagueCacheKey = (cacheKey) => {
  return cacheKey.startsWith("league:");
};

/**
 * בדיקה אם מפתח cache הוא של קבוצה
 */
export const isTeamCacheKey = (cacheKey) => {
  return cacheKey.startsWith("team:");
};

/**
 * חיפוש מפתחות cache לפי תבנית
 */
export const findCacheKeysByPattern = (cacheKeys, pattern) => {
  return cacheKeys.filter((key) => key.includes(pattern));
};

/**
 * חיפוש מפתחות cache של ליגה מסוימת
 */
export const findLeagueCacheKeys = (cacheKeys, leagueId) => {
  return findCacheKeysByPattern(cacheKeys, `league:${leagueId}:`);
};

/**
 * חיפוש מפתחות cache של קבוצה מסוימת
 */
export const findTeamCacheKeys = (cacheKeys, teamId) => {
  return findCacheKeysByPattern(cacheKeys, `team:${teamId}:`);
};
