import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import errorHandler from "../ErrorHandlerService.js";

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Service for reading teams data from JSON files
 */
class TeamJsonService {
  constructor() {
    this.dataDir = path.join(__dirname, "../../data");
    this.teamsFilePath = path.join(this.dataDir, "teams.json");
    this.indexFilePath = path.join(this.dataDir, "teams-index.json");
    this.teamsData = null;
    this.indexData = null;
    this.lastLoadTime = null;
  }

  /**
   * Load teams data from JSON files
   * @param {boolean} forceReload - Force reload from files
   * @returns {Promise<object>} Teams data
   */
  async loadTeamsData(forceReload = false) {
    try {
      // Check if data is already loaded and not stale
      if (!forceReload && this.teamsData && this.isDataFresh()) {
        return this.teamsData;
      }

      errorHandler.logSuccess("Loading teams data from JSON", "TEAM_JSON_001");

      // Read teams data
      const teamsFileContent = await fs.readFile(this.teamsFilePath, "utf8");
      this.teamsData = JSON.parse(teamsFileContent);

      // Read index data
      const indexFileContent = await fs.readFile(this.indexFilePath, "utf8");
      this.indexData = JSON.parse(indexFileContent);

      this.lastLoadTime = Date.now();

      errorHandler.logSuccess(
        "Teams data loaded successfully",
        "TEAM_JSON_002",
        {
          totalTeams: this.teamsData.teams.length,
          exportedAt: this.teamsData.metadata.exportedAt,
        }
      );

      return this.teamsData;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "loadTeamsData",
        severity: "critical",
        retryable: true,
      });
      throw error;
    }
  }

  /**
   * Check if loaded data is fresh (less than 1 hour old)
   * @returns {boolean}
   */
  isDataFresh() {
    if (!this.lastLoadTime) return false;
    const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
    return Date.now() - this.lastLoadTime < oneHour;
  }

  /**
   * Get all teams with pagination and filtering
   * @param {object} query - Query parameters
   * @returns {Promise<object>} Teams with pagination
   */
  async getAllTeams(query = {}) {
    try {
      await this.loadTeamsData();

      const {
        page = 1,
        limit = 20,
        country,
        search,
        sortBy = "name",
        sortOrder = "asc",
      } = query;

      let teams = [...this.teamsData.teams];

      // Apply filters
      if (country) {
        teams = teams.filter(
          (team) => team.country.toLowerCase() === country.toLowerCase()
        );
      }

      if (search) {
        const searchLower = search.toLowerCase();
        teams = teams.filter(
          (team) =>
            team.name.toLowerCase().includes(searchLower) ||
            team.code.toLowerCase().includes(searchLower)
        );
      }

      // Apply sorting
      teams.sort((a, b) => {
        let aValue = a[sortBy];
        let bValue = b[sortBy];

        // Handle nested properties
        if (sortBy === "venueId" && aValue && bValue) {
          aValue = aValue.name;
          bValue = bValue.name;
        }

        if (typeof aValue === "string") {
          aValue = aValue.toLowerCase();
          bValue = bValue.toLowerCase();
        }

        if (sortOrder === "desc") {
          return bValue > aValue ? 1 : -1;
        } else {
          return aValue > bValue ? 1 : -1;
        }
      });

      // Apply pagination
      const total = teams.length;
      const skip = (page - 1) * limit;
      const paginatedTeams = teams.slice(skip, skip + parseInt(limit));

      errorHandler.logSuccess("Teams fetched from JSON", "TEAM_JSON_003", {
        count: paginatedTeams.length,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
      });

      return {
        teams: paginatedTeams,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      };
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
   * Get team by ID
   * @param {string} id - Team ID
   * @returns {Promise<object|null>} Team data
   */
  async getTeamById(id) {
    try {
      await this.loadTeamsData();

      const team = this.indexData.byId[id] || null;

      if (team) {
        errorHandler.logSuccess("Team found by ID", "TEAM_JSON_004", { id });
      } else {
        errorHandler.logWarning("Team not found by ID", "TEAM_JSON_005", {
          id,
        });
      }

      return team;
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
   * Get team by teamId
   * @param {number} teamId - Team ID
   * @returns {Promise<object|null>} Team data
   */
  async getTeamByTeamId(teamId) {
    try {
      await this.loadTeamsData();

      const team = this.indexData.byTeamId[teamId] || null;

      if (team) {
        errorHandler.logSuccess("Team found by teamId", "TEAM_JSON_006", {
          teamId,
        });
      } else {
        errorHandler.logWarning("Team not found by teamId", "TEAM_JSON_007", {
          teamId,
        });
      }

      return team;
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
   * Find team by external ID
   * @param {string} provider - Provider name
   * @param {string|number} externalId - External ID
   * @returns {Promise<object|null>} Team data
   */
  async findTeamByExternalId(provider, externalId) {
    try {
      await this.loadTeamsData();

      const team =
        this.teamsData.teams.find(
          (t) => t.externalIds && t.externalIds[provider] === externalId
        ) || null;

      if (team) {
        errorHandler.logSuccess("Team found by external ID", "TEAM_JSON_010", {
          provider,
          externalId,
        });
      } else {
        errorHandler.logWarning(
          "Team not found by external ID",
          "TEAM_JSON_011",
          {
            provider,
            externalId,
          }
        );
      }

      return team;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "findTeamByExternalId",
        severity: "error",
        retryable: true,
      });
      throw error;
    }
  }

  /**
   * Get teams by country
   * @param {string} country - Country name
   * @returns {Promise<array>} Teams array
   */
  async getTeamsByCountry(country) {
    try {
      await this.loadTeamsData();

      const teams = this.indexData.byCountry[country] || [];

      errorHandler.logSuccess("Teams fetched by country", "TEAM_JSON_012", {
        country,
        count: teams.length,
      });

      return teams;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "getTeamsByCountry",
        severity: "error",
        retryable: true,
      });
      throw error;
    }
  }

  /**
   * Get all countries
   * @returns {Promise<array>} Countries array
   */
  async getAllCountries() {
    try {
      await this.loadTeamsData();

      const countries = Object.keys(this.indexData.byCountry);

      errorHandler.logSuccess("Countries fetched", "TEAM_JSON_013", {
        count: countries.length,
      });

      return countries;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "getAllCountries",
        severity: "error",
        retryable: true,
      });
      throw error;
    }
  }

  /**
   * Get metadata about the teams data
   * @returns {Promise<object>} Metadata
   */
  async getMetadata() {
    try {
      await this.loadTeamsData();

      return {
        ...this.teamsData.metadata,
        lastLoaded: new Date(this.lastLoadTime).toISOString(),
        dataFresh: this.isDataFresh(),
      };
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "getMetadata",
        severity: "error",
        retryable: true,
      });
      throw error;
    }
  }

  /**
   * Force reload data from files
   * @returns {Promise<void>}
   */
  async reloadData() {
    await this.loadTeamsData(true);
  }
}

// Create singleton instance
const teamJsonService = new TeamJsonService();

export default teamJsonService;
