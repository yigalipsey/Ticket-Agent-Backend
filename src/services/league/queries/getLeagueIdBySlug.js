import League from "../../../models/League.js";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";
import leagueCacheService from "../cache/LeagueCacheService.js";

/**
 * קבלת ID של ליגה לפי slug (אולטרה מהיר עם cache)
 * פונקציה פשוטה ומהירה שרק מחזירה את ה-ID
 */
export const getLeagueIdBySlug = async (slug) => {
  try {
    logWithCheckpoint(
      "info",
      "Fetching league ID by slug",
      "LEAGUE_ID_QUERY_001",
      {
        slug,
      }
    );

    // בדיקה ראשונה: האם יש ב-cache המהיר?
    const cachedId = leagueCacheService.getLeagueIdBySlug(slug);
    if (cachedId) {
      logWithCheckpoint(
        "info",
        "League ID found in slug→ID cache (ultra-fast)",
        "LEAGUE_ID_QUERY_002",
        {
          slug,
          leagueId: cachedId,
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
      "Slug→ID cache miss, fetching from database",
      "LEAGUE_ID_QUERY_003",
      {
        slug,
      }
    );

    // שליפה מינימלית רק של _id ו-slug
    const league = await League.findOne({ slug }).select("_id slug").lean();

    if (!league) {
      logWithCheckpoint(
        "warn",
        "League not found by slug",
        "LEAGUE_ID_QUERY_004",
        {
          slug,
        }
      );
      return null;
    }

    const leagueId = league._id.toString();

    // שמירה ב-cache לפעם הבאה
    leagueCacheService.setLeagueIdBySlug(slug, leagueId);

    logWithCheckpoint(
      "info",
      "League ID found in database and cached",
      "LEAGUE_ID_QUERY_005",
      {
        slug,
        leagueId,
        fromCache: false,
      }
    );

    return {
      _id: leagueId,
      slug,
      fromCache: false,
    };
  } catch (error) {
    logError(error, {
      operation: "getLeagueIdBySlug",
      slug,
    });
    throw error;
  }
};
