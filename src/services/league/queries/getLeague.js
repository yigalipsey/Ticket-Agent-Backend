import League from "../../../models/League.js";
import Team from "../../../models/Team.js";
import mongoose from "mongoose";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";
import {
  immutableLeagueCopy,
  normalizeMongoData,
} from "../../../utils/immutable.js";
import leagueCacheService from "../cache/LeagueCacheService.js";

/**
 * קבלת ליגה בודדת לפי ID בלבד עם fallback ל-DB
 */
export const getLeague = async (leagueId, withTeams = false) => {
  try {
    logWithCheckpoint(
      "info",
      "Fetching single league by ID",
      "LEAGUE_QUERY_011",
      {
        leagueId,
        withTeams,
      }
    );

    // ולידציה של ID
    if (!mongoose.Types.ObjectId.isValid(leagueId)) {
      throw new Error(`Invalid league ID: ${leagueId}`);
    }

    logWithCheckpoint(
      "debug",
      "League ID validation passed",
      "LEAGUE_QUERY_011.5",
      {
        leagueId,
      }
    );

    // ניסיון לקבל מה-cache
    const cachedData = leagueCacheService.get(withTeams);

    if (cachedData && cachedData.leagues) {
      // חיפוש הליגה ב-cache לפי ID
      const league = cachedData.leagues.find(
        (l) =>
          l._id?.toString() === leagueId?.toString() ||
          l.id?.toString() === leagueId?.toString()
      );

      if (league) {
        logWithCheckpoint("info", "League found in cache", "LEAGUE_QUERY_012", {
          leagueId,
          leagueName: league.name,
          withTeams,
          teamsCount: league.teams?.length || 0,
        });

        // יצירת עותק immutable של הליגה
        const immutableLeague = immutableLeagueCopy(league);

        return {
          league: immutableLeague,
          fromCache: true,
          withTeams,
        };
      }
    }

    // Fallback ל-DB - הליגה לא נמצאה ב-cache
    logWithCheckpoint(
      "info",
      "League not found in cache, fetching from database",
      "LEAGUE_QUERY_013",
      { leagueId, withTeams }
    );

    let league;

    if (withTeams) {
      // קבלת ליגה עם הקבוצות שלה
      league = await League.findById(leagueId)
        .select("name slug country nameHe logoUrl months")
        .lean();

      if (league) {
        const teams = await Team.find({ leagueIds: league._id })
          .select(
            "name name_en code slug logoUrl country country_he country_en isPopular primaryColor secondaryColor"
          )
          .lean();
        league.teams = normalizeMongoData(teams);
      }
    } else {
      // קבלת ליגה בלבד
      league = await League.findById(leagueId)
        .select("name slug country nameHe logoUrl months")
        .lean();
    }

    if (!league) {
      logWithCheckpoint(
        "warn",
        "League not found in database",
        "LEAGUE_QUERY_014",
        { leagueId, withTeams }
      );
      return null;
    }

    // נרמול ObjectIds לפני החזרה
    league = normalizeMongoData(league);

    logWithCheckpoint("info", "League found in database", "LEAGUE_QUERY_015", {
      leagueId,
      leagueName: league.name,
      withTeams,
      teamsCount: league.teams?.length || 0,
    });

    // 🟢 Checkpoint 6 - עדכון cache
    console.log("🟢 [CHECKPOINT 6] Updating cache with new league", {
      leagueId: league._id,
      leagueName: league.name,
    });

    // עדכון cache עם הליגה החדשה
    try {
      const currentCache = leagueCacheService.get(withTeams);
      if (currentCache && currentCache.leagues) {
        // בדיקה אם הליגה כבר קיימת ב-cache
        const existingIndex = currentCache.leagues.findIndex(
          (l) => l._id?.toString() === league._id?.toString()
        );

        if (existingIndex >= 0) {
          // עדכון ליגה קיימת
          currentCache.leagues[existingIndex] = league;
        } else {
          // הוספת ליגה חדשה
          currentCache.leagues.push(league);
        }

        // שמירה ב-cache
        leagueCacheService.set(withTeams, currentCache);

        // 🟢 Checkpoint 7 - Cache עודכן בהצלחה
        console.log("🟢 [CHECKPOINT 7] Cache updated successfully", {
          leagueId: league._id,
          cacheSize: currentCache.leagues.length,
        });

        logWithCheckpoint(
          "debug",
          "Cache updated with new league",
          "LEAGUE_QUERY_016",
          {
            leagueId: league._id,
            cacheSize: currentCache.leagues.length,
          }
        );
      }
    } catch (cacheError) {
      logError(cacheError, {
        operation: "updateCacheAfterDBFetch",
        leagueId,
        withTeams,
      });
      // לא זורק שגיאה - זה לא קריטי
    }

    // 🟢 Checkpoint 8 - החזרת ליגה מ-DB
    console.log("🟢 [CHECKPOINT 8] Returning league from DB", {
      leagueId: league._id,
      fromCache: false,
    });

    return {
      league,
      fromCache: false,
      withTeams,
    };
  } catch (error) {
    logError(error, {
      operation: "getLeague",
      leagueId,
      withTeams,
    });

    // Fallback: נסיון להחזיר cache ישן גם אם DB נכשל
    const staleCache = leagueCacheService.get(withTeams);
    if (staleCache && staleCache.leagues) {
      const staleLeague = staleCache.leagues.find(
        (l) =>
          l._id?.toString() === leagueId?.toString() ||
          l.id?.toString() === leagueId?.toString()
      );

      if (staleLeague) {
        logWithCheckpoint(
          "warn",
          "Database failed, returning stale league from cache as fallback",
          "LEAGUE_QUERY_FALLBACK",
          {
            leagueId,
            leagueName: staleLeague.name,
            withTeams,
            error: error.message,
          }
        );

        // יצירת עותק immutable של הליגה הישנה
        const immutableStaleLeague = immutableLeagueCopy(staleLeague);

        return {
          league: immutableStaleLeague,
          fromCache: true,
          stale: true, // מסמן שזה cache ישן
          withTeams,
          error: "Database unavailable, showing cached data",
        };
      }
    }

    // אם גם אין cache ישן, זורק שגיאה
    throw error;
  }
};
