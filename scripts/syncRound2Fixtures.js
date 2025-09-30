import dotenv from "dotenv";
import mongoose from "mongoose";
import axios from "axios";
import FootballEvent from "../src/models/FootballEvent.js";
import League from "../src/models/League.js";
import Team from "../src/models/Team.js";
import Venue from "../src/models/Venue.js";
import { logWithCheckpoint, logError } from "../src/utils/logger.js";

dotenv.config();

const API_KEY = "dbce3565f0f15507e9814804eed43fe2";
const API_BASE_URL = "https://v3.football.api-sports.io";

async function findOrCreateLeague(leagueData) {
  try {
    let league = await League.findOne({ leagueId: leagueData.id });

    if (!league) {
      league = new League({
        leagueId: leagueData.id,
        name: leagueData.name,
        country: leagueData.country,
        logoUrl: leagueData.logo,
        type: "League",
        externalIds: {
          apiFootball: leagueData.id,
        },
      });
      await league.save();
      logWithCheckpoint("info", "Created new league", "SYNC_001", {
        leagueId: league.id,
      });
    }

    return league;
  } catch (error) {
    logError(error, { operation: "findOrCreateLeague", leagueData });
    throw error;
  }
}

async function findOrCreateTeam(teamData) {
  try {
    let team = await Team.findOne({ teamId: teamData.id });

    if (!team) {
      // Find or create venue first
      const venue = await findOrCreateVenue({
        id: teamData.venue?.id || 0,
        name: teamData.venue?.name || "Unknown Venue",
        city: teamData.venue?.city || "Unknown City",
      });

      team = new Team({
        name: teamData.name,
        code: teamData.name.substring(0, 3).toUpperCase(), // Simple code generation
        country: "England", // Default for Premier League
        logoUrl: teamData.logo,
        teamId: teamData.id,
        venueId: venue._id,
        externalIds: {
          apiFootball: teamData.id,
        },
      });
      await team.save();
      logWithCheckpoint("info", "Created new team", "SYNC_002", {
        teamId: team._id,
      });
    }

    return team;
  } catch (error) {
    logError(error, { operation: "findOrCreateTeam", teamData });
    throw error;
  }
}

async function findOrCreateVenue(venueData) {
  try {
    let venue = await Venue.findOne({ venueId: venueData.id });

    if (!venue) {
      venue = new Venue({
        name: venueData.name,
        city: venueData.city,
        country: "England",
        capacity: 50000, // Default capacity
        venueId: venueData.id,
        externalIds: {
          apiFootball: venueData.id,
        },
      });
      await venue.save();
      logWithCheckpoint("info", "Created new venue", "SYNC_003", {
        venueId: venue._id,
      });
    }

    return venue;
  } catch (error) {
    logError(error, { operation: "findOrCreateVenue", venueData });
    throw error;
  }
}

async function syncRound2Fixtures() {
  try {
    logWithCheckpoint("info", "Starting round 2 fixture sync", "SYNC_004");
    await mongoose.connect(process.env.MONGODB_URI);
    logWithCheckpoint("info", "Connected to MongoDB", "SYNC_005");

    // Fetch fixtures from API
    const response = await axios.get(`${API_BASE_URL}/fixtures`, {
      params: {
        league: 39,
        season: 2022,
        round: "Regular Season - 2",
      },
      headers: {
        "x-apisports-key": API_KEY,
        accept: "application/json",
      },
    });

    const fixtures = response.data.response.slice(0, 2); // Take only first 2 fixtures
    logWithCheckpoint("info", "Fetched fixtures from API", "SYNC_006", {
      count: fixtures.length,
    });

    for (const fixtureData of fixtures) {
      try {
        // Find or create league
        const league = await findOrCreateLeague(fixtureData.league);

        // Find or create teams
        const homeTeam = await findOrCreateTeam(fixtureData.teams.home);
        const awayTeam = await findOrCreateTeam(fixtureData.teams.away);

        // Find or create venue
        const venue = await findOrCreateVenue(fixtureData.fixture.venue);

        // Check if fixture already exists
        const existingFixture = await FootballEvent.findOne({
          fixtureId: fixtureData.fixture.id,
        });

        if (existingFixture) {
          logWithCheckpoint("info", "Fixture already exists", "SYNC_007", {
            fixtureId: fixtureData.fixture.id,
          });
          continue;
        }

        // Create new fixture
        const fixture = new FootballEvent({
          fixtureId: fixtureData.fixture.id,
          date: new Date(fixtureData.fixture.date),
          status: fixtureData.fixture.status.short,
          league: league._id,
          homeTeam: homeTeam._id,
          awayTeam: awayTeam._id,
          venue: venue._id,
          round: fixtureData.league.round,
          roundNumber: 2,
          tags: ["Premier League", "2022", "Regular Season"],
          externalIds: {
            apiFootball: fixtureData.fixture.id,
          },
        });

        await fixture.save();
        logWithCheckpoint("info", "Created new fixture", "SYNC_008", {
          fixtureId: fixture._id,
          match: `${homeTeam.name} vs ${awayTeam.name}`,
        });
      } catch (error) {
        logError(error, {
          operation: "processFixture",
          fixtureId: fixtureData.fixture.id,
        });
      }
    }

    logWithCheckpoint("info", "Round 2 fixture sync completed", "SYNC_009");

    // Show results
    const totalFixtures = await FootballEvent.countDocuments();
    logWithCheckpoint("info", "Total fixtures in database", "SYNC_010", {
      count: totalFixtures,
    });
  } catch (error) {
    logError(error, { operation: "syncRound2Fixtures" });
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

syncRound2Fixtures();
