// Import all query functions from modular structure
import {
  getAllFootballEvents,
  getFootballEventById,
  getFootballEventBySlug,
  findFootballEventByExternalId,
  getFootballEventsByTeam,
  getFootballEventsByTeamSlug,
  getFootballEventsByTeamLocalized,
  getFootballEventsByLeague,
  getFootballEventsByLeagueSlug,
  getFootballEventsByLeagueSlugLocalized,
} from "./queries/index.js";

class FootballQueryService {
  // Delegate all methods to imported functions
  async getAllFootballEvents(query = {}) {
    return getAllFootballEvents(query);
  }

  async getFootballEventById(id) {
    return getFootballEventById(id);
  }

  async getFootballEventBySlug(slug) {
    return getFootballEventBySlug(slug);
  }

  async findFootballEventByExternalId(externalId, provider = "apiFootball") {
    return findFootballEventByExternalId(externalId, provider);
  }

  async getFootballEventsByTeam(teamId, query = {}) {
    return getFootballEventsByTeam(teamId, query);
  }

  async getFootballEventsByTeamSlug(teamSlug, query = {}) {
    return getFootballEventsByTeamSlug(teamSlug, query);
  }

  async getFootballEventsByTeamLocalized(teamSlug, query = {}) {
    return getFootballEventsByTeamLocalized(teamSlug, query);
  }

  async getFootballEventsByLeague(leagueId, query = {}) {
    return getFootballEventsByLeague(leagueId, query);
  }

  async getFootballEventsByLeagueSlug(leagueSlug, query = {}) {
    return getFootballEventsByLeagueSlug(leagueSlug, query);
  }

  async getFootballEventsByLeagueSlugLocalized(leagueSlug, query = {}) {
    return getFootballEventsByLeagueSlugLocalized(leagueSlug, query);
  }
}

export default new FootballQueryService();
