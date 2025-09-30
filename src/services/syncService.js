import axios from "axios";
import Event from "../models/Event.js";
import FootballEvent from "../models/FootballEvent.js";
import eventService from "./eventService.js";
import TeamService from "./team/index.js";
import VenueService from "./venue/index.js";
import FootballService from "./football/index.js";
import { logWithCheckpoint, logError } from "../utils/logger.js";

class SyncService {
  constructor() {
    this.apiFootballKey = process.env.API_FOOTBALL_KEY;
    this.apiFootballBaseUrl =
      process.env.API_FOOTBALL_BASE_URL || "https://v3.football.api-sports.io";

    this.apiClient = axios.create({
      baseURL: this.apiFootballBaseUrl,
      headers: {
        "X-RapidAPI-Key": this.apiFootballKey,
        "X-RapidAPI-Host": "v3.football.api-sports.io",
      },
      timeout: 30000,
    });
  }

  // Sync fixtures for a specific league and season
  async syncFixtures(leagueId, season, options = {}) {
    try {
      logWithCheckpoint("info", "Starting fixtures sync", "SYNC_001", {
        leagueId,
        season,
        options,
      });

      const {
        from = new Date().toISOString().split("T")[0],
        to = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
        forceUpdate = false,
      } = options;

      logWithCheckpoint("info", "Fetching fixtures from API", "SYNC_002", {
        leagueId,
        season,
        from,
        to,
      });

      const response = await this.apiClient.get("/fixtures", {
        params: {
          league: leagueId,
          season: season,
          from: from,
          to: to,
        },
      });

      const fixtures = response.data.response;

      logWithCheckpoint("info", "Received fixtures from API", "SYNC_003", {
        count: fixtures.length,
      });

      let processed = 0;
      let created = 0;
      let updated = 0;
      let errors = 0;

      for (const fixture of fixtures) {
        try {
          const result = await this.processFixture(fixture, forceUpdate);
          processed++;

          if (result.created) {
            created++;
          } else if (result.updated) {
            updated++;
          }

          logWithCheckpoint("debug", "Processed fixture", "SYNC_004", {
            fixtureId: fixture.fixture.id,
            result: result.created
              ? "created"
              : result.updated
              ? "updated"
              : "skipped",
          });
        } catch (error) {
          errors++;
          logError(error, {
            operation: "processFixture",
            fixtureId: fixture.fixture.id,
          });
        }
      }

      logWithCheckpoint("info", "Completed fixtures sync", "SYNC_005", {
        processed,
        created,
        updated,
        errors,
      });

      return {
        processed,
        created,
        updated,
        errors,
        total: fixtures.length,
      };
    } catch (error) {
      logError(error, { operation: "syncFixtures", leagueId, season, options });
      throw error;
    }
  }

  // Process a single fixture
  async processFixture(fixture, forceUpdate = false) {
    try {
      logWithCheckpoint("debug", "Processing fixture", "SYNC_006", {
        fixtureId: fixture.fixture.id,
      });

      const externalId = fixture.fixture.id.toString();

      // Check if football event already exists
      const existingFootballEvent =
        await FootballService.query.findFootballEventByExternalId(
          externalId,
          "apiFootball"
        );

      if (existingFootballEvent && !forceUpdate) {
        logWithCheckpoint(
          "debug",
          "Fixture already exists, skipping",
          "SYNC_007",
          {
            fixtureId: externalId,
          }
        );
        return { created: false, updated: false, skipped: true };
      }

      // Process teams
      const homeTeam = await TeamService.mutate.upsertTeamFromExternal(
        fixture.teams.home,
        "apiFootball"
      );
      const awayTeam = await TeamService.mutate.upsertTeamFromExternal(
        fixture.teams.away,
        "apiFootball"
      );

      logWithCheckpoint("debug", "Processed teams", "SYNC_008", {
        homeTeamId: homeTeam._id,
        awayTeamId: awayTeam._id,
      });

      // Process venue
      const venue = await VenueService.mutate.upsertVenueFromExternal(
        fixture.venue,
        "apiFootball"
      );

      logWithCheckpoint("debug", "Processed venue", "SYNC_009", {
        venueId: venue._id,
      });

      // Create or update event
      let event;
      if (existingFootballEvent) {
        // Update existing event
        const eventData = {
          title: `${homeTeam.name} vs ${awayTeam.name}`,
          date: new Date(fixture.fixture.date),
          status: this.mapFixtureStatus(fixture.fixture.status.short),
        };

        event = await eventService.updateEvent(
          existingFootballEvent.eventId,
          eventData
        );

        logWithCheckpoint("debug", "Updated existing event", "SYNC_010", {
          eventId: event._id,
        });
      } else {
        // Create new event
        const eventData = {
          title: `${homeTeam.name} vs ${awayTeam.name}`,
          date: new Date(fixture.fixture.date),
          type: "sport",
          status: this.mapFixtureStatus(fixture.fixture.status.short),
          externalIds: {
            apiFootball: externalId,
          },
        };

        event = await eventService.createEvent(eventData);

        logWithCheckpoint("debug", "Created new event", "SYNC_011", {
          eventId: event._id,
        });
      }

      // Create or update football event
      const footballEventData = {
        eventId: event._id,
        league: fixture.league.name,
        season: fixture.league.season.toString(),
        homeTeamId: homeTeam._id,
        awayTeamId: awayTeam._id,
        venueId: venue._id,
        round: fixture.league.round,
        tags: [fixture.league.name, fixture.league.season.toString()],
        externalIds: {
          apiFootball: externalId,
        },
      };

      let footballEvent;
      if (existingFootballEvent) {
        footballEvent = await FootballService.mutate.updateFootballEvent(
          existingFootballEvent._id,
          footballEventData
        );
        logWithCheckpoint("debug", "Updated football event", "SYNC_012", {
          footballEventId: footballEvent._id,
        });
      } else {
        footballEvent = await FootballService.mutate.createFootballEvent(
          footballEventData
        );
        logWithCheckpoint("debug", "Created football event", "SYNC_013", {
          footballEventId: footballEvent._id,
        });
      }

      return {
        created: !existingFootballEvent,
        updated: !!existingFootballEvent,
        eventId: event._id,
        footballEventId: footballEvent._id,
      };
    } catch (error) {
      logError(error, {
        operation: "processFixture",
        fixtureId: fixture.fixture.id,
      });
      throw error;
    }
  }

  // Map API Football status to our status
  mapFixtureStatus(apiStatus) {
    const statusMap = {
      NS: "upcoming", // Not Started
      LIVE: "upcoming", // Live
      HT: "upcoming", // Half Time
      FT: "finished", // Full Time
      AET: "finished", // After Extra Time
      PEN: "finished", // Penalties
      PST: "postponed", // Postponed
      CANC: "cancelled", // Cancelled
      ABD: "cancelled", // Abandoned
      AWD: "finished", // Awarded
      WO: "finished", // Walkover
    };

    return statusMap[apiStatus] || "upcoming";
  }

  // Get available leagues
  async getLeagues() {
    try {
      logWithCheckpoint("info", "Fetching leagues from API", "SYNC_014");

      const response = await this.apiClient.get("/leagues");
      const leagues = response.data.response;

      logWithCheckpoint("info", "Received leagues from API", "SYNC_015", {
        count: leagues.length,
      });

      return leagues;
    } catch (error) {
      logError(error, { operation: "getLeagues" });
      throw error;
    }
  }

  // Get teams for a specific league
  async getTeams(leagueId, season) {
    try {
      logWithCheckpoint("info", "Fetching teams from API", "SYNC_016", {
        leagueId,
        season,
      });

      const response = await this.apiClient.get("/teams", {
        params: {
          league: leagueId,
          season: season,
        },
      });

      const teams = response.data.response;

      logWithCheckpoint("info", "Received teams from API", "SYNC_017", {
        count: teams.length,
      });

      return teams;
    } catch (error) {
      logError(error, { operation: "getTeams", leagueId, season });
      throw error;
    }
  }
}

export default new SyncService();
