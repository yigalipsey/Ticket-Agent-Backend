import FootballEvent from "../../../models/FootballEvent.js";
import { normalizeMongoData } from "../../../utils/immutable.js";

/**
 * שירות לשליפת משחקים חמים
 * מביא ישירות מה-DB ללא cache
 */
class HotFixturesService {
  /**
   * שליפת משחקים חמים
   * @param {Object} options - אפשרויות סינון
   * @param {number} options.limit - מספר משחקים מקסימלי
   * @param {string} options.sortBy - שדה למיון
   * @param {string} options.sortOrder - כיוון מיון
   * @param {Date} options.fromDate - תאריך התחלה
   * @param {Date} options.toDate - תאריך סיום
   * @returns {Promise<Object>} תוצאה עם משחקים חמים
   */
  static async getHotFixtures(options = {}) {
    const {
      limit = 10,
      sortBy = "date",
      sortOrder = "asc",
      fromDate,
      toDate,
    } = options;

    // בניית query - רק משחקים חמים
    const query = { isHot: true };

    // הוספת סינון לפי תאריכים
    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = new Date(fromDate);
      if (toDate) query.date.$lte = new Date(toDate);
    }

    // בניית sort
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // שליפת משחקים חמים ישירות מה-DB
    const hotFixturesRaw = await FootballEvent.find(query)
      .populate("league", "name slug country nameHe")
      .populate("homeTeam", "name name_en slug logoUrl")
      .populate("awayTeam", "name name_en slug logoUrl")
      .populate("venue", "name city_en capacity city_he")
      .select("+minPrice") // Include minPrice (hidden field)
      .sort(sort)
      .limit(limit)
      .lean();

    // Remove unnecessary fields from response and set Hebrew name as default
    const hotFixtures = hotFixturesRaw.map((fixture) => {
      const {
        status,
        round,
        externalIds,
        createdAt,
        updatedAt,
        __v,
        supplierExternalIds,
        ...rest
      } = fixture;

      // Set Hebrew name as default name for league
      if (rest.league && rest.league.nameHe) {
        rest.league.name = rest.league.nameHe;
      }

      return rest;
    });

    // נרמול ObjectIds
    const normalizedFixtures = normalizeMongoData(hotFixtures);

    return {
      success: true,
      data: normalizedFixtures,
      count: normalizedFixtures.length,
      message: `נמצאו ${normalizedFixtures.length} משחקים חמים`,
      fromCache: false,
    };
  }

  /**
   * שליפת משחקים חמים עתידיים (מהתאריך הנוכחי ואילך)
   * מביא ישירות מה-DB ללא cache
   * @param {number} limit - מספר משחקים מקסימלי
   * @returns {Promise<Object>} משחקים חמים עתידיים
   */
  static async getUpcomingHotFixtures(limit = 5) {
    // תאריך נוכחי
    const now = new Date();

    // שליפה ישירה מה-DB - משחקים חמים עם תאריך עתידי
    return await this.getHotFixtures({
      limit,
      sortBy: "date",
      sortOrder: "asc",
      fromDate: now,
      // ללא toDate - מחזיר את כל המשחקים החמים העתידיים ללא הגבלה
    });
  }
}

export default HotFixturesService;
