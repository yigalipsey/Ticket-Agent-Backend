// Core queries - basic CRUD operations
export {
  getAllFootballEvents,
  getFootballEventById,
  getFootballEventBySlug,
  findFootballEventByExternalId,
} from "./core.js";

// Team-related queries
export {
  getFootballEventsByTeam,
  getFootballEventsByTeamSlug,
  getFootballEventsByTeamLocalized,
} from "./byTeam.js";

// League-related queries
export {
  getFootballEventsByLeague,
  getFootballEventsByLeagueSlug,
  getFootballEventsByLeagueSlugLocalized,
} from "./byLeague.js";
