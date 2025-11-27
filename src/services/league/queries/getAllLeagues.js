import League from "../../../models/League.js";
import Team from "../../../models/Team.js";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";
import {
  immutableArrayCopy,
  normalizeMongoData,
} from "../../../utils/immutable.js";
import leagueCacheService from "../cache/LeagueCacheService.js";

/**
 * קבלת כל הליגות עם או בלי הקבוצות שלהן עם cache
 */
export const getAllLeagues = async (withTeams = false) => {
  try {
    logWithCheckpoint(
      "info",
      "Starting to fetch all leagues with cache",
      "LEAGUE_QUERY_001",
      { withTeams }
    );

    // בדיקת cache
    const cachedData = leagueCacheService.get(withTeams);

    if (cachedData) {
      logWithCheckpoint(
        "info",
        "Using cached leagues data",
        "LEAGUE_QUERY_002",
        {
          withTeams,
          cachedLeaguesCount: cachedData.leagues?.length || 0,
        }
      );
      return {
        ...cachedData,
        leagues: immutableArrayCopy(cachedData.leagues),
        fromCache: true,
      };
    }

    // Cache miss - שליפה מה-DB
    logWithCheckpoint(
      "info",
      "Cache miss - fetching from database",
      "LEAGUE_QUERY_003",
      { withTeams }
    );

    let leagues;

    if (withTeams) {
      // קבלת ליגות עם הקבוצות שלהן
      leagues = await League.find({}).lean();

      // הוספת הקבוצות לכל ליגה
      for (const league of leagues) {
        const teams = await Team.find({ leagueIds: league._id })
          .select(
            "name name_en code slug logoUrl country country_he country_en isPopular primaryColor secondaryColor"
          )
          .lean();
        league.teams = normalizeMongoData(teams);
      }

      logWithCheckpoint(
        "info",
        "Successfully fetched leagues with teams from database",
        "LEAGUE_QUERY_004",
        {
          leaguesCount: leagues.length,
          withTeams: true,
        }
      );
    } else {
      // קבלת ליגות בלבד
      leagues = await League.find({}).lean();

      logWithCheckpoint(
        "info",
        "Successfully fetched leagues without teams from database",
        "LEAGUE_QUERY_005",
        {
          leaguesCount: leagues.length,
          withTeams: false,
        }
      );
    }

    // נרמול ObjectIds לפני שמירה ב-cache
    leagues = normalizeMongoData(leagues);

    const result = {
      leagues,
      count: leagues.length,
      withTeams,
      fromCache: false,
    };

    // שמירה ב-cache
    leagueCacheService.set(withTeams, result);

    // עדכון מסיבי של slug→ID mappings (אופטימיזציה לעתיד)
    leagueCacheService.bulkSetSlugToIdMappings(leagues);

    logWithCheckpoint(
      "info",
      "Data fetched from database and cached (including slug→ID mappings)",
      "LEAGUE_QUERY_006",
      {
        withTeams,
        leaguesCount: leagues.length,
      }
    );

    return result;
  } catch (error) {
    logError(error, {
      operation: "getAllLeagues",
      withTeams,
    });

    // Fallback: נסיון להחזיר cache ישן גם אם DB נכשל
    const staleCache = leagueCacheService.get(withTeams);
    if (staleCache) {
      logWithCheckpoint(
        "warn",
        "Database failed, returning stale cache as fallback",
        "LEAGUE_QUERY_FALLBACK",
        {
          withTeams,
          staleLeaguesCount: staleCache.leagues?.length || 0,
          error: error.message,
        }
      );

      return {
        ...staleCache,
        leagues: immutableArrayCopy(staleCache.leagues),
        fromCache: true,
        stale: true, // מסמן שזה cache ישן
        error: "Database unavailable, showing cached data",
      };
    }

    // אם גם אין cache ישן, זורק שגיאה
    throw error;
  }
};
