// Import all query functions from modular structure
import {
  getAllFootballEvents,
  getFootballEventById,
  findFootballEventByExternalId,
  getFootballEventsByTeamId,
  getFootballEventsByLeagueId,
} from "./queries/index.js";

class FootballQueryService {
  // Delegate all methods to imported functions
  async getAllFootballEvents(query = {}) {
    return getAllFootballEvents(query);
  }

  async getFootballEventById(id) {
    return getFootballEventById(id);
  }

  async findFootballEventByExternalId(externalId, provider = "apiFootball") {
    return findFootballEventByExternalId(externalId, provider);
  }

  async getFootballEventsByTeamId(teamId, query = {}) {
    return getFootballEventsByTeamId(teamId, query);
  }

  async getFootballEventsByLeagueId(leagueId, query = {}) {
    return getFootballEventsByLeagueId(leagueId, query);
  }
}

export default new FootballQueryService();
