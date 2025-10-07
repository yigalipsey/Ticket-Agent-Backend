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
 * קבלת ליגה בודדת לפי מזהה או slug עם fallback ל-DB
 */
export const getLeague = async (identifier, withTeams = false) => {
  try {
    logWithCheckpoint("info", "Fetching single league", "LEAGUE_QUERY_011", {
      identifier,
      withTeams,
    });

    // ולידציה של identifier
    const isValidObjectId = mongoose.Types.ObjectId.isValid(identifier);
    const isSlug = typeof identifier === "string" && !isValidObjectId;

    logWithCheckpoint("debug", "Identifier validation", "LEAGUE_QUERY_011.5", {
      identifier,
      isValidObjectId,
      isSlug,
    });

    // ניסיון לקבל מה-cache
    const cachedData = leagueCacheService.get(withTeams);

    if (cachedData && cachedData.leagues) {
      // חיפוש הליגה ב-cache לפי ID או slug
      const league = cachedData.leagues.find(
        (l) =>
          l._id?.toString() === identifier?.toString() ||
          l.id?.toString() === identifier?.toString() ||
          l.slug === identifier
      );

      if (league) {
        logWithCheckpoint("info", "League found in cache", "LEAGUE_QUERY_012", {
          identifier,
          leagueName: league.name,
          leagueId: league._id,
          leagueSlug: league.slug,
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
      { identifier, withTeams }
    );

    let league;

    // בניית query מותאם לפי סוג ה-identifier
    let query;
    if (isValidObjectId) {
      query = { _id: identifier };
    } else {
      query = { slug: identifier };
    }

    if (withTeams) {
      // קבלת ליגה עם הקבוצות שלה
      league = await League.findOne(query)
        .select("name slug country nameHe logoUrl")
        .lean();

      if (league) {
        const teams = await Team.find({ leagueIds: league._id })
          .select(
            "name name_he name_en code slug logoUrl country country_he country_en"
          )
          .lean();
        league.teams = normalizeMongoData(teams);
      }
    } else {
      // קבלת ליגה בלבד
      league = await League.findOne(query)
        .select("name slug country nameHe logoUrl")
        .lean();
    }

    if (!league) {
      logWithCheckpoint(
        "warn",
        "League not found in database",
        "LEAGUE_QUERY_014",
        { identifier, withTeams }
      );
      return null;
    }

    // נרמול ObjectIds לפני החזרה
    league = normalizeMongoData(league);

    logWithCheckpoint("info", "League found in database", "LEAGUE_QUERY_015", {
      identifier,
      leagueName: league.name,
      leagueId: league._id,
      leagueSlug: league.slug,
      withTeams,
      teamsCount: league.teams?.length || 0,
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
        logWithCheckpoint(
          "debug",
          "Cache updated with new league",
          "LEAGUE_QUERY_016",
          {
            identifier,
            leagueId: league._id,
            cacheSize: currentCache.leagues.length,
          }
        );
      }
    } catch (cacheError) {
      logError(cacheError, {
        operation: "updateCacheAfterDBFetch",
        identifier,
        withTeams,
      });
      // לא זורק שגיאה - זה לא קריטי
    }

    return {
      league,
      fromCache: false,
      withTeams,
    };
  } catch (error) {
    logError(error, {
      operation: "getLeague",
      identifier,
      withTeams,
    });

    // Fallback: נסיון להחזיר cache ישן גם אם DB נכשל
    const staleCache = leagueCacheService.get(withTeams);
    if (staleCache && staleCache.leagues) {
      const staleLeague = staleCache.leagues.find(
        (l) =>
          l._id?.toString() === identifier?.toString() ||
          l.id?.toString() === identifier?.toString() ||
          l.slug === identifier
      );

      if (staleLeague) {
        logWithCheckpoint(
          "warn",
          "Database failed, returning stale league from cache as fallback",
          "LEAGUE_QUERY_FALLBACK",
          {
            identifier,
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

// Alias functions for backward compatibility
export const getLeagueById = (leagueId, withTeams = false) =>
  getLeague(leagueId, withTeams);

export const getLeagueBySlug = (slug, withTeams = false) =>
  getLeague(slug, withTeams);
