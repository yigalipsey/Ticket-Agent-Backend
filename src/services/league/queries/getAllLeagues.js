import League from "../../../models/League.js";
import Team from "../../../models/Team.js";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";
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
            "name name_he name_en code slug logoUrl country country_he country_en"
          )
          .lean();
        league.teams = teams;
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

    const result = {
      leagues,
      count: leagues.length,
      withTeams,
      fromCache: false,
    };

    // שמירה ב-cache
    leagueCacheService.set(withTeams, result);

    logWithCheckpoint(
      "info",
      "Data fetched from database and cached",
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
    throw error;
  }
};
