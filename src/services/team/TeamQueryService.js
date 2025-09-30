import teamRepository from "../../repositories/TeamRepository.js";
import Team from "../../models/Team.js";
import { logWithCheckpoint, logError } from "../../utils/logger.js";
import CacheService from "../CacheService.js";

class TeamQueryService {
  // Get all teams with pagination and filtering
  async getAllTeams(query = {}) {
    try {
      logWithCheckpoint("info", "Starting to fetch all teams", "TEAM_001", {
        query,
      });

      const result = await teamRepository.getAllTeams(query);

      logWithCheckpoint("info", "Successfully fetched teams", "TEAM_005", {
        count: result.teams.length,
        total: result.pagination.total,
      });

      return result;
    } catch (error) {
      logError(error, { operation: "getAllTeams", query });
      throw error;
    }
  }

  // Get team by ID
  async getTeamById(id) {
    try {
      logWithCheckpoint("info", "Starting to fetch team by ID", "TEAM_006", {
        id,
      });

      const team = await teamRepository.getTeamById(id);

      if (!team) {
        logWithCheckpoint("warn", "Team not found", "TEAM_007", { id });
        return null;
      }

      logWithCheckpoint("info", "Successfully fetched team", "TEAM_008", {
        id,
      });
      return team;
    } catch (error) {
      logError(error, { operation: "getTeamById", id });
      throw error;
    }
  }

  // Get team by teamId
  async getTeamByTeamId(teamId) {
    try {
      logWithCheckpoint(
        "info",
        "Starting to fetch team by teamId",
        "TEAM_009",
        {
          teamId,
        }
      );

      const team = await teamRepository.getTeamByTeamId(teamId);

      if (!team) {
        logWithCheckpoint("warn", "Team not found by teamId", "TEAM_010", {
          teamId,
        });
        return null;
      }

      logWithCheckpoint(
        "info",
        "Successfully fetched team by teamId",
        "TEAM_011",
        {
          teamId,
        }
      );
      return team;
    } catch (error) {
      logError(error, { operation: "getTeamByTeamId", teamId });
      throw error;
    }
  }

  // Get team by slug
  async getTeamBySlug(slug) {
    try {
      logWithCheckpoint("info", "Starting to fetch team by slug", "TEAM_013", {
        slug,
      });

      const team = await teamRepository.getTeamBySlug(slug);

      if (!team) {
        logWithCheckpoint("warn", "Team not found by slug", "TEAM_014", {
          slug,
        });
        return null;
      }

      logWithCheckpoint(
        "info",
        "Successfully fetched team by slug",
        "TEAM_015",
        {
          slug,
        }
      );
      return team;
    } catch (error) {
      logError(error, { operation: "getTeamBySlug", slug });
      throw error;
    }
  }

  // Get team by slug with localization
  async getTeamBySlugLocalized(slug, locale = "en") {
    try {
      logWithCheckpoint(
        "info",
        "Starting to fetch localized team by slug",
        "TEAM_016",
        {
          slug,
          locale,
        }
      );

      const team = await teamRepository.getTeamBySlug(slug);

      if (!team) {
        logWithCheckpoint("warn", "Team not found by slug", "TEAM_017", {
          slug,
        });
        return null;
      }

      const localizedTeam = Team.localizeTeam(team, locale);

      logWithCheckpoint(
        "info",
        "Successfully fetched localized team by slug",
        "TEAM_018",
        {
          slug,
          locale,
        }
      );
      return localizedTeam;
    } catch (error) {
      logError(error, { operation: "getTeamBySlugLocalized", slug, locale });
      throw error;
    }
  }

  // Find team by external ID
  async findTeamByExternalId(provider, externalId) {
    try {
      logWithCheckpoint(
        "info",
        "Starting to find team by external ID",
        "TEAM_012",
        {
          provider,
          externalId,
        }
      );

      const team = await teamRepository.findTeamByExternalId(
        provider,
        externalId
      );

      logWithCheckpoint("info", "Completed external ID lookup", "TEAM_013", {
        provider,
        externalId,
        found: !!team,
      });

      return team;
    } catch (error) {
      logError(error, {
        operation: "findTeamByExternalId",
        provider,
        externalId,
      });
      throw error;
    }
  }

  // Get teams by league with caching
  async getTeamsByLeague(leagueSlug, locale = "he") {
    try {
      logWithCheckpoint(
        "info",
        "Starting to fetch teams by league",
        "TEAM_019",
        {
          leagueSlug,
          locale,
        }
      );

      // Check cache first
      const cachedData = CacheService.getTeamsByLeague(leagueSlug, locale);
      if (cachedData) {
        logWithCheckpoint("info", "Teams found in cache", "TEAM_020", {
          leagueSlug,
          locale,
          count: cachedData.length,
        });
        return cachedData;
      }

      // If not in cache, fetch from database
      const teams = await teamRepository.getTeamsByLeague(leagueSlug);

      if (!teams || teams.length === 0) {
        logWithCheckpoint("warn", "No teams found for league", "TEAM_021", {
          leagueSlug,
        });
        return [];
      }

      // Localize all teams
      const localizedTeams = teams.map((team) =>
        Team.localizeTeam(team, locale)
      );

      // Cache the result
      CacheService.setTeamsByLeague(leagueSlug, locale, localizedTeams);

      logWithCheckpoint(
        "info",
        "Successfully fetched and cached teams by league",
        "TEAM_022",
        {
          leagueSlug,
          locale,
          count: localizedTeams.length,
        }
      );

      return localizedTeams;
    } catch (error) {
      logError(error, { operation: "getTeamsByLeague", leagueSlug, locale });
      throw error;
    }
  }

  // Get teams by league ID with caching
  async getTeamsByLeagueId(leagueId, locale = "he") {
    try {
      logWithCheckpoint(
        "info",
        "Starting to fetch teams by league ID",
        "TEAM_023",
        {
          leagueId,
          locale,
        }
      );

      // Check cache first
      const cachedData = CacheService.getTeamsByLeague(leagueId, locale);
      if (cachedData) {
        logWithCheckpoint("info", "Teams found in cache", "TEAM_024", {
          leagueId,
          locale,
          count: cachedData.length,
        });
        return cachedData;
      }

      // If not in cache, fetch from database
      const teams = await teamRepository.getTeamsByLeagueId(leagueId);

      if (!teams || teams.length === 0) {
        logWithCheckpoint("warn", "No teams found for league ID", "TEAM_025", {
          leagueId,
        });
        return [];
      }

      // Localize all teams
      const localizedTeams = teams.map((team) =>
        Team.localizeTeam(team, locale)
      );

      // Cache the result
      CacheService.setTeamsByLeague(leagueId, locale, localizedTeams);

      logWithCheckpoint(
        "info",
        "Successfully fetched and cached teams by league ID",
        "TEAM_026",
        {
          leagueId,
          locale,
          count: localizedTeams.length,
        }
      );

      return localizedTeams;
    } catch (error) {
      logError(error, { operation: "getTeamsByLeagueId", leagueId, locale });
      throw error;
    }
  }
}

export default new TeamQueryService();
