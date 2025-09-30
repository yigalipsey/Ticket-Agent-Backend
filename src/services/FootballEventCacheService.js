import FootballEvent from "../models/FootballEvent.js";
import redisService from "./RedisService.js";
import errorHandler from "./ErrorHandlerService.js";

class FootballEventCacheService {
  constructor() {
    this.redis = null;
    this.cachePrefix = "football_events";
    this.cacheExpiry = 60 * 60 * 24; // 24 hours
  }

  setRedisClient(client) {
    this.redis = client;
  }

  getCacheKey(suffix) {
    return `${this.cachePrefix}:${suffix}`;
  }

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
      errorHandler.logWarning(
        "Failed to retrieve from Redis cache",
        "CACHE_ERROR",
        { key, error: error.message }
      );
    }
    return null;
  }

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
        category: errorHandler.errorCategories.NETWORK,
        severity: "warning",
        context: { key, expiry, error: error.message },
      });
    }
  }

  async getFixturesByTeam(teamId, options = {}) {
    const { limit = 10, upcoming = true, includePast = false } = options;
    const cacheKey = this.getCacheKey(
      `team:${teamId}:${JSON.stringify(options)}`
    );

    try {
      // Try to get from cache first
      const cachedResult = await this.getFromCache(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // Build query
      const query = {
        $or: [{ homeTeam: teamId }, { awayTeam: teamId }],
      };

      // Add date filter
      if (upcoming && !includePast) {
        query.date = { $gte: new Date() };
      } else if (!upcoming && !includePast) {
        query.date = { $lt: new Date() };
      }

      // Execute query
      const fixtures = await FootballEvent.find(query)
        .populate("homeTeam", "name code logoUrl")
        .populate("awayTeam", "name code logoUrl")
        .populate("venue", "name city capacity")
        .populate("league", "name slug")
        .sort({ date: upcoming ? 1 : -1 })
        .limit(limit)
        .lean();

      const result = {
        fixtures,
        total: fixtures.length,
        teamId,
        options,
      };

      // Cache the result
      await this.setCache(cacheKey, result);

      return result;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "getFixturesByTeam",
        category: errorHandler.errorCategories.DATABASE,
        context: { teamId, options },
      });
      throw error;
    }
  }

  async getFixturesByTeamSlug(teamSlug, options = {}) {
    const { limit = 10, upcoming = true, includePast = false } = options;
    const cacheKey = this.getCacheKey(
      `team_slug:${teamSlug}:${JSON.stringify(options)}`
    );

    try {
      // Try to get from cache first
      const cachedResult = await this.getFromCache(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // First, find the team by slug to get its ID
      const Team = (await import("../models/Team.js")).default;
      const team = await Team.findOne({ slug: teamSlug }).select("_id");

      if (!team) {
        return {
          fixtures: [],
          total: 0,
          teamSlug,
          options,
        };
      }

      // Build query using team ID
      const query = {
        $or: [{ homeTeam: team._id }, { awayTeam: team._id }],
      };

      // Add date filter
      if (upcoming && !includePast) {
        query.date = { $gte: new Date() };
      } else if (!upcoming && !includePast) {
        query.date = { $lt: new Date() };
      }

      // Execute query
      const fixtures = await FootballEvent.find(query)
        .populate("homeTeam", "name code logoUrl slug")
        .populate("awayTeam", "name code logoUrl slug")
        .populate("venue", "name city capacity")
        .populate("league", "name slug")
        .sort({ date: upcoming ? 1 : -1 })
        .limit(limit)
        .lean();

      const result = {
        fixtures,
        total: fixtures.length,
        teamSlug,
        options,
      };

      // Cache the result
      await this.setCache(cacheKey, result);

      return result;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "getFixturesByTeamSlug",
        category: errorHandler.errorCategories.DATABASE,
        context: { teamSlug, options },
      });
      throw error;
    }
  }

  async getFixturesByLeague(leagueId, options = {}) {
    const { limit = 20, upcoming = true, includePast = false } = options;
    const cacheKey = this.getCacheKey(
      `league:${leagueId}:${JSON.stringify(options)}`
    );

    try {
      // Try to get from cache first
      const cachedResult = await this.getFromCache(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // Build query
      const query = { league: leagueId };

      // Add date filter
      if (upcoming && !includePast) {
        query.date = { $gte: new Date() };
      } else if (!upcoming && !includePast) {
        query.date = { $lt: new Date() };
      }

      // Execute query
      const fixtures = await FootballEvent.find(query)
        .populate("homeTeam", "name code logoUrl")
        .populate("awayTeam", "name code logoUrl")
        .populate("venue", "name city capacity")
        .populate("league", "name slug")
        .sort({ date: upcoming ? 1 : -1 })
        .limit(limit)
        .lean();

      const result = {
        fixtures,
        total: fixtures.length,
        leagueId,
        options,
      };

      // Cache the result
      await this.setCache(cacheKey, result);

      return result;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "getFixturesByLeague",
        category: errorHandler.errorCategories.DATABASE,
        context: { leagueId, options },
      });
      throw error;
    }
  }

  async getFixtureBySlug(slug) {
    const cacheKey = this.getCacheKey(`slug:${slug}`);

    try {
      // Try to get from cache first
      const cachedResult = await this.getFromCache(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // Execute query
      const fixture = await FootballEvent.findOne({ slug })
        .populate("homeTeam", "name code logoUrl")
        .populate("awayTeam", "name code logoUrl")
        .populate("venue", "name city capacity")
        .populate("league", "name slug")
        .lean();

      if (fixture) {
        // Cache the result
        await this.setCache(cacheKey, fixture);
      }

      return fixture;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "getFixtureBySlug",
        category: errorHandler.errorCategories.DATABASE,
        context: { slug },
      });
      throw error;
    }
  }

  async clearTeamCache(teamId) {
    if (!this.redis) return;

    try {
      const pattern = this.getCacheKey(`team:${teamId}:*`);
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(keys);
        errorHandler.logSuccess("Cleared team cache", "CACHE_CLEAR", {
          teamId,
          keysCount: keys.length,
        });
      }
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "clearTeamCache",
        category: errorHandler.errorCategories.NETWORK,
        severity: "warning",
        context: { teamId },
      });
    }
  }

  async clearAllCache() {
    if (!this.redis) return;

    try {
      const pattern = this.getCacheKey("*");
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(keys);
        errorHandler.logSuccess(
          "Cleared all football event cache",
          "CACHE_CLEAR_ALL",
          { keysCount: keys.length }
        );
      }
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "clearAllCache",
        category: errorHandler.errorCategories.NETWORK,
        severity: "warning",
      });
    }
  }
}

const footballEventCacheService = new FootballEventCacheService();
export default footballEventCacheService;
