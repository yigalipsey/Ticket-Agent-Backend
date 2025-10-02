// Core queries - basic CRUD operations
export {
  getAllFootballEvents,
  getFootballEventById,
  findFootballEventByExternalId,
} from "./core.js";

// Team-related queries
export { getFootballEventsByTeamId } from "./byTeam.js";

// League-related queries
export { getFootballEventsByLeagueId } from "./byLeague.js";
