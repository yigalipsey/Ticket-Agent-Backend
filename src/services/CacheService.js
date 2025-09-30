import { LRUCache } from "lru-cache";

class CacheService {
  constructor() {
    // Cache with 1 week TTL (7 days * 24 hours * 60 minutes * 60 seconds * 1000 milliseconds)
    this.teamsCache = new LRUCache({
      max: 500, // Maximum number of items
      ttl: 7 * 24 * 60 * 60 * 1000, // 1 week in milliseconds
    });

    this.fixturesCache = new LRUCache({
      max: 1000,
      ttl: 60 * 60 * 1000, // 1 hour for fixtures (they change more often)
    });

    this.leaguesCache = new LRUCache({
      max: 100,
      ttl: 7 * 24 * 60 * 60 * 1000, // 1 week for leagues
    });
  }

  // Teams cache methods
  getTeamsByLeague(leagueSlug, locale) {
    const key = `teams:${leagueSlug}:${locale}`;
    return this.teamsCache.get(key);
  }

  setTeamsByLeague(leagueSlug, locale, data) {
    const key = `teams:${leagueSlug}:${locale}`;
    this.teamsCache.set(key, data);
    console.log(`📦 Cached teams for league ${leagueSlug} (${locale})`);
  }

  // Fixtures cache methods
  getFixturesByLeague(leagueSlug, query, locale) {
    const key = `fixtures:${leagueSlug}:${JSON.stringify(query)}:${locale}`;
    return this.fixturesCache.get(key);
  }

  setFixturesByLeague(leagueSlug, query, locale, data) {
    const key = `fixtures:${leagueSlug}:${JSON.stringify(query)}:${locale}`;
    this.fixturesCache.set(key, data);
    console.log(`📦 Cached fixtures for league ${leagueSlug} (${locale})`);
  }

  // Leagues cache methods
  getLeagues(locale) {
    const key = `leagues:${locale}`;
    return this.leaguesCache.get(key);
  }

  setLeagues(locale, data) {
    const key = `leagues:${locale}`;
    this.leaguesCache.set(key, data);
    console.log(`📦 Cached leagues (${locale})`);
  }

  // Cache statistics
  getStats() {
    return {
      teams: {
        size: this.teamsCache.size,
        max: this.teamsCache.max,
        ttl: this.teamsCache.ttl,
      },
      fixtures: {
        size: this.fixturesCache.size,
        max: this.fixturesCache.max,
        ttl: this.fixturesCache.ttl,
      },
      leagues: {
        size: this.leaguesCache.size,
        max: this.leaguesCache.max,
        ttl: this.leaguesCache.ttl,
      },
    };
  }

  // Clear specific cache
  clearTeamsCache() {
    this.teamsCache.clear();
    console.log("🗑️ Cleared teams cache");
  }

  clearFixturesCache() {
    this.fixturesCache.clear();
    console.log("🗑️ Cleared fixtures cache");
  }

  clearLeaguesCache() {
    this.leaguesCache.clear();
    console.log("🗑️ Cleared leagues cache");
  }

  // Clear all caches
  clearAll() {
    this.teamsCache.clear();
    this.fixturesCache.clear();
    this.leaguesCache.clear();
    console.log("🗑️ Cleared all caches");
  }
}

export default new CacheService();
