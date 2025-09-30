import League from "../../models/League.js";
import { logWithCheckpoint, logError } from "../../utils/logger.js";

class LeagueQueryService {
  // Get all leagues with pagination and filtering
  async getAllLeagues(query = {}) {
    try {
      logWithCheckpoint("info", "Starting to fetch all leagues", "LEAGUE_001", {
        query,
      });

      const {
        page = 1,
        limit = 20,
        country,
        type,
        search,
        sortBy = "name",
        sortOrder = "asc",
      } = query;

      // Build filter object
      const filter = {};

      if (country) {
        filter.country = country;
        logWithCheckpoint("debug", "Added country filter", "LEAGUE_002", {
          country,
        });
      }

      if (type) {
        filter.type = type;
        logWithCheckpoint("debug", "Added type filter", "LEAGUE_003", {
          type,
        });
      }

      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: "i" } },
          { country: { $regex: search, $options: "i" } },
        ];
        logWithCheckpoint("debug", "Added search filter", "LEAGUE_004", {
          search,
        });
      }

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === "desc" ? -1 : 1;

      const skip = (page - 1) * limit;

      logWithCheckpoint("info", "Executing database query", "LEAGUE_005", {
        filter,
        sort,
        skip,
        limit,
      });

      const [leagues, total] = await Promise.all([
        League.find(filter).sort(sort).skip(skip).limit(parseInt(limit)).lean(),
        League.countDocuments(filter),
      ]);

      logWithCheckpoint("info", "Successfully fetched leagues", "LEAGUE_006", {
        count: leagues.length,
        total,
      });

      return {
        leagues,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logError(error, { operation: "getAllLeagues", query });
      throw error;
    }
  }

  // Get league by ID
  async getLeagueById(id) {
    try {
      logWithCheckpoint(
        "info",
        "Starting to fetch league by ID",
        "LEAGUE_007",
        {
          id,
        }
      );

      const league = await League.findById(id).lean();

      if (!league) {
        logWithCheckpoint("warn", "League not found", "LEAGUE_008", { id });
        return null;
      }

      logWithCheckpoint("info", "Successfully fetched league", "LEAGUE_009", {
        id,
      });
      return league;
    } catch (error) {
      logError(error, { operation: "getLeagueById", id });
      throw error;
    }
  }

  // Get league by leagueId
  async getLeagueByLeagueId(leagueId) {
    try {
      logWithCheckpoint(
        "info",
        "Starting to fetch league by leagueId",
        "LEAGUE_010",
        {
          leagueId,
        }
      );

      const league = await League.findOne({ leagueId }).lean();

      if (!league) {
        logWithCheckpoint(
          "warn",
          "League not found by leagueId",
          "LEAGUE_011",
          { leagueId }
        );
        return null;
      }

      logWithCheckpoint(
        "info",
        "Successfully fetched league by leagueId",
        "LEAGUE_012",
        {
          leagueId,
        }
      );
      return league;
    } catch (error) {
      logError(error, { operation: "getLeagueByLeagueId", leagueId });
      throw error;
    }
  }

  // Find league by external ID
  async findLeagueByExternalId(provider, externalId) {
    try {
      logWithCheckpoint(
        "info",
        "Starting to find league by external ID",
        "LEAGUE_013",
        {
          provider,
          externalId,
        }
      );

      const filter = {};
      filter[`externalIds.${provider}`] = externalId;

      const league = await League.findOne(filter).lean();

      logWithCheckpoint("info", "Completed external ID lookup", "LEAGUE_014", {
        provider,
        externalId,
        found: !!league,
      });

      return league;
    } catch (error) {
      logError(error, {
        operation: "findLeagueByExternalId",
        provider,
        externalId,
      });
      throw error;
    }
  }

  // Get league by slug
  async getLeagueBySlug(slug) {
    try {
      logWithCheckpoint(
        "info",
        "Starting to fetch league by slug",
        "LEAGUE_007",
        {
          slug,
        }
      );

      const league = await League.findOne({ slug }).lean();

      if (!league) {
        logWithCheckpoint("warn", "League not found by slug", "LEAGUE_008", {
          slug,
        });
        return null;
      }

      logWithCheckpoint(
        "info",
        "Successfully fetched league by slug",
        "LEAGUE_009",
        {
          slug,
        }
      );
      return league;
    } catch (error) {
      logError(error, { operation: "getLeagueBySlug", slug });
      throw error;
    }
  }

  // Get popular leagues only
  async getPopularLeagues(limit = 10) {
    try {
      logWithCheckpoint(
        "info",
        "Starting to fetch popular leagues",
        "LEAGUE_015",
        {}
      );

      const leagues = await League.find({ isPopular: true })
        .select(
          "_id leagueId name nameHe slug country countryHe logoUrl type isPopular"
        )
        .sort({ name: 1 })
        .limit(limit)
        .lean();

      logWithCheckpoint(
        "info",
        "Successfully fetched popular leagues",
        "LEAGUE_016",
        {
          count: leagues.length,
        }
      );

      return {
        leagues,
        count: leagues.length,
      };
    } catch (error) {
      logError(error, { operation: "getPopularLeagues" });
      throw error;
    }
  }
}

export default new LeagueQueryService();
