import { getLeagueFixturesWithCache } from "./byLeague.js";

/**
 * שירות לשליפת משחקי ליגה
 */
class LeagueFixturesService {
  /**
   * שליפת משחקי ליגה עם ולידציה ופילטרים
   * @param {string} leagueId - מזהה הליגה
   * @param {Object} queryParams - פרמטרי הבקשה
   * @returns {Promise<Object>} תוצאה עם משחקים
   */
  static async getLeagueFixtures(leagueId, queryParams = {}) {
    // ולידציה של leagueId
    if (!leagueId) {
      return {
        success: false,
        error: "leagueId parameter is required",
        statusCode: 400,
      };
    }

    if (!leagueId.match(/^[0-9a-fA-F]{24}$/)) {
      return {
        success: false,
        error: "Invalid leagueId format",
        statusCode: 400,
      };
    }

    // Parsing של months parameter
    let monthsArray = null;
    if (queryParams.months) {
      try {
        monthsArray = Array.isArray(queryParams.months)
          ? queryParams.months
          : queryParams.months.split(",");

        // ולידציה של פורמט החודשים
        for (const m of monthsArray) {
          if (!m.match(/^\d{4}-\d{2}$/)) {
            return {
              success: false,
              error: `Invalid month format in months parameter: ${m}. Use YYYY-MM format`,
              statusCode: 400,
            };
          }
        }
      } catch (error) {
        return {
          success: false,
          error:
            "Invalid months parameter format. Use comma-separated months (e.g., '2025-10,2025-11')",
          statusCode: 400,
        };
      }
    }

    // בניית פילטרים
    const filters = this.buildFilters(queryParams);

    try {
      // קבלת נתונים עם cache
      const result = await getLeagueFixturesWithCache(leagueId, filters);

      if (!result) {
        return {
          success: false,
          error: "No fixtures found for this league and month",
          statusCode: 404,
        };
      }

      return {
        success: true,
        data: result.data || [],
        pagination: result.pagination || {},
        meta: {
          fromCache: result.fromCache || false,
          cachedAt: result.cachedAt,
          leagueId,
          month: queryParams.month,
          filters: filters,
          ...result.meta,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: "Failed to fetch league fixtures",
        message: error.message,
        statusCode: 500,
      };
    }
  }

  /**
   * בניית פילטרים מפרמטרי הבקשה
   * @param {Object} queryParams - פרמטרי הבקשה
   * @returns {Object} פילטרים מוכנים
   */
  static buildFilters(queryParams) {
    const {
      month,
      city,
      hasOffers,
      page = 1,
      limit = 20,
      upcoming = "true",
      sortBy = "date",
      sortOrder = "asc",
    } = queryParams;

    const filters = {
      page: parseInt(page),
      limit: parseInt(limit),
      month,
      upcoming: upcoming === "true",
      sortBy,
      sortOrder,
    };

    // הוספת פילטרים אופציונליים
    if (city) filters.city = city;
    if (hasOffers === "true") filters.hasOffers = true;

    return filters;
  }
}

export default LeagueFixturesService;
