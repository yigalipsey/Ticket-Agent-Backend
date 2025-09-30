import Team from "../models/Team.js";
import teamJsonService from "../services/team/TeamJsonService.js";
import errorHandler from "../services/ErrorHandlerService.js";

/**
 * Smart Team Repository with fallback strategy between Redis, JSON, and MongoDB
 *
 * Strategy:
 * 1. Try Redis cache (fastest)
 * 2. Fallback to JSON (fast, no DB connection needed)
 * 3. Fallback to MongoDB (source of truth)
 * 4. Update cache for next time
 */
class TeamRepository {
  constructor() {
    this.cachePrefix = "teams";
    this.cacheExpiry = 604800; // 7 days in seconds
    this.redis = null; // Will be injected when Redis is available
  }

  /**
   * Set Redis client (injected from main app)
   * @param {Redis} redisClient - Redis client instance
   */
  setRedisClient(redisClient) {
    this.redis = redisClient;
  }

  /**
   * Get cache key for teams
   * @param {string} suffix - Cache key suffix
   * @returns {string} Cache key
   */
  getCacheKey(suffix = "all") {
    return `${this.cachePrefix}:${suffix}`;
  }

  /**
   * Try to get data from Redis cache
   * @param {string} key - Cache key
   * @returns {Promise<object|null>} Cached data or null
   */
  async getFromCache(key) {
    if (!this.redis) return null;

    try {
      const cached = await this.redis.get(key);
      if (cached) {
        errorHandler.logSuccess(
          "Data retrieved from Redis cache",
          "CACHE_HIT",
          { key }
        );
        return JSON.parse(cached);
      }
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "getFromCache",
        severity: "warning",
        retryable: true,
      });
    }

    return null;
  }

  /**
   * Set data in Redis cache
   * @param {string} key - Cache key
   * @param {object} data - Data to cache
   * @param {number} expiry - Expiry time in seconds
   */
  async setCache(key, data, expiry = this.cacheExpiry) {
    if (!this.redis) return;

    try {
      await this.redis.setex(key, expiry, JSON.stringify(data));
      errorHandler.logSuccess("Data cached in Redis", "CACHE_SET", {
        key,
        expiry,
      });
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "setCache",
        severity: "warning",
        retryable: true,
      });
    }
  }

  /**
   * Get all teams with smart fallback strategy
   * @param {object} query - Query parameters
   * @returns {Promise<object>} Teams with pagination
   */
  async getAllTeams(query = {}) {
    const cacheKey = this.getCacheKey(`all:${JSON.stringify(query)}`);

    try {
      // 1. Try Redis cache first
      const cached = await this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      // 2. Try JSON (fast, no DB connection needed)
      try {
        const jsonResult = await teamJsonService.getAllTeams(query);
        // Cache the result for next time
        await this.setCache(cacheKey, jsonResult);
        return jsonResult;
      } catch (jsonError) {
        errorHandler.logWarning(
          "JSON fallback failed, trying MongoDB",
          "JSON_FALLBACK",
          {
            error: jsonError.message,
          }
        );
      }

      // 3. Fallback to MongoDB (source of truth)
      const dbResult = await this.getAllTeamsFromDB(query);
      // Cache the result for next time
      await this.setCache(cacheKey, dbResult);
      return dbResult;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "getAllTeams",
        severity: "error",
        retryable: true,
      });
      throw error;
    }
  }

  /**
   * Get team by ID with smart fallback strategy
   * @param {string} id - Team ID
   * @returns {Promise<object|null>} Team data
   */
  async getTeamById(id) {
    const cacheKey = this.getCacheKey(`id:${id}`);

    try {
      // 1. Try Redis cache first
      const cached = await this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      // 2. Try JSON (fast lookup)
      try {
        const jsonTeam = await teamJsonService.getTeamById(id);
        if (jsonTeam) {
          await this.setCache(cacheKey, jsonTeam);
          return jsonTeam;
        }
      } catch (jsonError) {
        errorHandler.logWarning(
          "JSON fallback failed for getTeamById",
          "JSON_FALLBACK",
          {
            id,
            error: jsonError.message,
          }
        );
      }

      // 3. Fallback to MongoDB
      const dbTeam = await this.getTeamByIdFromDB(id);
      if (dbTeam) {
        await this.setCache(cacheKey, dbTeam);
      }
      return dbTeam;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "getTeamById",
        severity: "error",
        retryable: true,
      });
      throw error;
    }
  }

  /**
   * Get team by teamId with smart fallback strategy
   * @param {number} teamId - Team ID
   * @returns {Promise<object|null>} Team data
   */
  async getTeamByTeamId(teamId) {
    const cacheKey = this.getCacheKey(`teamId:${teamId}`);

    try {
      // 1. Try Redis cache first
      const cached = await this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      // 2. Try JSON (fast lookup)
      try {
        const jsonTeam = await teamJsonService.getTeamByTeamId(teamId);
        if (jsonTeam) {
          await this.setCache(cacheKey, jsonTeam);
          return jsonTeam;
        }
      } catch (jsonError) {
        errorHandler.logWarning(
          "JSON fallback failed for getTeamByTeamId",
          "JSON_FALLBACK",
          {
            teamId,
            error: jsonError.message,
          }
        );
      }

      // 3. Fallback to MongoDB
      const dbTeam = await this.getTeamByTeamIdFromDB(teamId);
      if (dbTeam) {
        await this.setCache(cacheKey, dbTeam);
      }
      return dbTeam;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "getTeamByTeamId",
        severity: "error",
        retryable: true,
      });
      throw error;
    }
  }

  /**
   * Find team by external ID with smart fallback strategy
   * @param {string} provider - Provider name
   * @param {string|number} externalId - External ID
   * @returns {Promise<object|null>} Team data
   */
  async findTeamByExternalId(provider, externalId) {
    const cacheKey = this.getCacheKey(`external:${provider}:${externalId}`);

    try {
      // 1. Try Redis cache first
      const cached = await this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      // 2. Try JSON (fast lookup)
      try {
        const jsonTeam = await teamJsonService.findTeamByExternalId(
          provider,
          externalId
        );
        if (jsonTeam) {
          await this.setCache(cacheKey, jsonTeam);
          return jsonTeam;
        }
      } catch (jsonError) {
        errorHandler.logWarning(
          "JSON fallback failed for findTeamByExternalId",
          "JSON_FALLBACK",
          {
            provider,
            externalId,
            error: jsonError.message,
          }
        );
      }

      // 3. Fallback to MongoDB
      const dbTeam = await this.findTeamByExternalIdFromDB(
        provider,
        externalId
      );
      if (dbTeam) {
        await this.setCache(cacheKey, dbTeam);
      }
      return dbTeam;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "findTeamByExternalId",
        severity: "error",
        retryable: true,
      });
      throw error;
    }
  }

  // MongoDB fallback methods
  async getAllTeamsFromDB(query = {}) {
    const {
      page = 1,
      limit = 20,
      country,
      search,
      sortBy = "name",
      sortOrder = "asc",
    } = query;

    const filter = {};
    if (country) filter.country = country;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
      ];
    }

    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;
    const skip = (page - 1) * limit;

    const [teams, total] = await Promise.all([
      Team.find(filter)
        .populate("venueId", "name city capacity")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Team.countDocuments(filter),
    ]);

    return {
      teams,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getTeamByIdFromDB(id) {
    return await Team.findById(id)
      .populate("venueId", "name city capacity")
      .lean();
  }

  async getTeamByTeamIdFromDB(teamId) {
    return await Team.findOne({ teamId })
      .populate("venueId", "name city capacity")
      .lean();
  }

  async findTeamByExternalIdFromDB(provider, externalId) {
    const filter = {};
    filter[`externalIds.${provider}`] = externalId;

    return await Team.findOne(filter)
      .populate("venueId", "name city capacity")
      .lean();
  }

  async getTeamsByLeague(leagueSlug) {
    // Find teams that belong to the specified league
    // We need to find teams that have fixtures in this league
    const pipeline = [
      {
        $lookup: {
          from: "footballevents",
          localField: "_id",
          foreignField: "homeTeam",
          as: "homeFixtures",
        },
      },
      {
        $lookup: {
          from: "footballevents",
          localField: "_id",
          foreignField: "awayTeam",
          as: "awayFixtures",
        },
      },
      {
        $lookup: {
          from: "leagues",
          localField: "homeFixtures.league",
          foreignField: "_id",
          as: "homeLeague",
        },
      },
      {
        $lookup: {
          from: "leagues",
          localField: "awayFixtures.league",
          foreignField: "_id",
          as: "awayLeague",
        },
      },
      {
        $match: {
          $or: [
            { "homeLeague.slug": leagueSlug },
            { "awayLeague.slug": leagueSlug },
          ],
        },
      },
      {
        $project: {
          name_en: 1,
          name_he: 1,
          code: 1,
          slug: 1,
          logoUrl: 1,
          country_en: 1,
          country_he: 1,
          founded: 1,
          city: 1,
          venueId: 1,
        },
      },
      {
        $sort: { name_en: 1 },
      },
    ];

    return await Team.aggregate(pipeline);
  }

  async getTeamsByLeagueId(leagueId) {
    // First get the league to find its country
    const league = await Team.db
      .collection("leagues")
      .findOne({ _id: new Team.base.Types.ObjectId(leagueId) });

    if (!league) {
      return [];
    }

    // Find teams that belong to the same country as the league
    const teams = await Team.find({
      $or: [
        { country_en: league.country },
        { country_he: league.country },
        { country: league.country },
      ],
    })
      .select(
        "name_en name_he code slug logoUrl country_en country_he founded city"
      )
      .sort({ name_en: 1 })
      .limit(20) // Limit to 20 teams for carousel
      .lean();

    return teams;
  }

  /**
   * Clear cache for specific team or all teams
   * @param {string} teamId - Optional team ID to clear specific cache
   */
  async clearCache(teamId = null) {
    if (!this.redis) return;

    try {
      if (teamId) {
        // Clear specific team cache
        const keys = [
          this.getCacheKey(`id:${teamId}`),
          this.getCacheKey(`teamId:${teamId}`),
          this.getCacheKey(`slug:*`), // This would need pattern matching
        ];
        await Promise.all(keys.map((key) => this.redis.del(key)));
      } else {
        // Clear all teams cache
        const pattern = `${this.cachePrefix}:*`;
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }

      errorHandler.logSuccess("Cache cleared", "CACHE_CLEAR", { teamId });
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "clearCache",
        severity: "warning",
        retryable: true,
      });
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<object>} Cache stats
   */
  async getCacheStats() {
    if (!this.redis) return { redis: false };

    try {
      const pattern = `${this.cachePrefix}:*`;
      const keys = await this.redis.keys(pattern);

      return {
        redis: true,
        totalKeys: keys.length,
        keys: keys.slice(0, 10), // First 10 keys as sample
      };
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "getCacheStats",
        severity: "warning",
        retryable: true,
      });
      return { redis: true, error: error.message };
    }
  }
}

// Create singleton instance
const teamRepository = new TeamRepository();

export default teamRepository;
