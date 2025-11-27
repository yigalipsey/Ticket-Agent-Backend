import "dotenv/config";
import axios from "axios";
import mongoose from "mongoose";
import FootballEvent from "../src/models/FootballEvent.js";
import Team from "../src/models/Team.js";
import League from "../src/models/League.js";
import Venue from "../src/models/Venue.js";

const API_FOOTBALL_BASE_URL =
  process.env.API_FOOTBALL_BASE_URL || "https://v3.football.api-sports.io";
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;

if (!API_FOOTBALL_KEY) {
  console.error("❌ API_FOOTBALL_KEY not found in environment variables");
  process.exit(1);
}

const apiClient = axios.create({
  baseURL: API_FOOTBALL_BASE_URL,
  headers: {
    "x-rapidapi-key": API_FOOTBALL_KEY,
    "x-rapidapi-host": "v3.football.api-sports.io",
  },
  timeout: 30000,
});

const BUNDESLIGA_LEAGUE_ID = 78; // Bundesliga league ID in API Football
const SEASON = 2025;

async function findTeamInAPI(teamName) {
  // Try to find team by name
  try {
    const response = await apiClient.get("/teams", {
      params: {
        search: teamName,
        league: BUNDESLIGA_LEAGUE_ID,
      },
    });

    if (
      response.data &&
      response.data.response &&
      response.data.response.length > 0
    ) {
      return response.data.response[0].team;
    }
  } catch (error) {
    console.error(`Error finding team ${teamName}:`, error.message);
  }
  return null;
}

async function fetchFixtureFromAPI(fixtureId) {
  try {
    const response = await apiClient.get("/fixtures", {
      params: {
        id: fixtureId,
      },
    });

    if (
      !response.data ||
      !response.data.response ||
      response.data.response.length === 0
    ) {
      return null;
    }

    return response.data.response[0];
  } catch (error) {
    console.error(`Error fetching fixture ${fixtureId}:`, error.message);
    return null;
  }
}

async function findFixtureByTeamsAndDate(homeTeamName, awayTeamName, date) {
  try {
    // Find teams
    const homeTeam = await findTeamInAPI(homeTeamName);
    const awayTeam = await findTeamInAPI(awayTeamName);

    if (!homeTeam || !awayTeam) {
      return null;
    }

    // Search fixtures for the date range
    const searchDate = new Date(date);
    const fromDate = new Date(searchDate);
    fromDate.setDate(fromDate.getDate() - 1);
    const toDate = new Date(searchDate);
    toDate.setDate(toDate.getDate() + 1);

    const response = await apiClient.get("/fixtures", {
      params: {
        league: BUNDESLIGA_LEAGUE_ID,
        season: SEASON,
        team: homeTeam.id,
        from: fromDate.toISOString().split("T")[0],
        to: toDate.toISOString().split("T")[0],
      },
    });

    if (
      response.data &&
      response.data.response &&
      response.data.response.length > 0
    ) {
      // Find the fixture with matching teams
      const fixture = response.data.response.find((f) => {
        const fixtureHomeId = f.teams.home.id;
        const fixtureAwayId = f.teams.away.id;
        return (
          (fixtureHomeId === homeTeam.id && fixtureAwayId === awayTeam.id) ||
          (fixtureHomeId === awayTeam.id && fixtureAwayId === homeTeam.id)
        );
      });

      return fixture;
    }
  } catch (error) {
    console.error(
      `Error finding fixture ${homeTeamName} vs ${awayTeamName}:`,
      error.message
    );
  }
  return null;
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");

  try {
    const bundesliga = await League.findOne({
      $or: [{ slug: "bundesliga" }, { name: /bundesliga/i }],
    });

    const matchesToCheck = [
      {
        p1Home: "Bayer 04 Leverkusen",
        p1Away: "FC Bayern München",
        date: "2026-03-14",
        dbFixtureId: "6926e33fa3a933930dad478e",
      },
      {
        p1Home: "Bayer 04 Leverkusen",
        p1Away: "1. FSV Mainz 05",
        date: "2026-02-28",
        dbFixtureId: "6926e33ca3a933930dad4746",
      },
      {
        p1Home: "Bayer 04 Leverkusen",
        p1Away: "RB Leipzig",
        date: "2026-05-02",
        dbFixtureId: "6926e345a3a933930dad4856",
      },
      {
        p1Home: "Bayer 04 Leverkusen",
        p1Away: "FC Köln",
        date: "2025-12-13",
        dbFixtureId: "6926e330a3a933930dad45d2",
      },
      {
        p1Home: "Borussia Dortmund",
        p1Away: "FC St. Pauli",
        date: "2026-01-17",
        dbFixtureId: "6926e335a3a933930dad4676",
      },
      {
        p1Home: "Borussia Dortmund",
        p1Away: "1. FSV Mainz 05",
        date: "2026-02-14",
        dbFixtureId: "6926e33aa3a933930dad470a",
      },
      {
        p1Home: "Borussia Dortmund",
        p1Away: "FC Bayern München",
        date: "2026-02-28",
        dbFixtureId: "6926e33ca3a933930dad474a",
      },
      {
        p1Home: "Borussia Dortmund",
        p1Away: "FC Augsburg",
        date: "2026-03-14",
        dbFixtureId: "6926e33ea3a933930dad4782",
      },
      {
        p1Home: "Borussia Dortmund",
        p1Away: "Bayer 04 Leverkusen",
        date: "2026-04-11",
        dbFixtureId: "6926e342a3a933930dad47fa",
      },
      {
        p1Home: "Borussia Dortmund",
        p1Away: "Sport-Club Freiburg",
        date: "2026-04-25",
        dbFixtureId: "6926e345a3a933930dad4842",
      },
      {
        p1Home: "Borussia Dortmund",
        p1Away: "Eintracht Frankfurt",
        date: "2026-05-09",
        dbFixtureId: "6926e347a3a933930dad4886",
      },
    ];

    console.log("Checking fixtures from API Football...\n");
    console.log("=".repeat(80));

    for (const match of matchesToCheck) {
      const dbFixture = await FootballEvent.findById(match.dbFixtureId)
        .populate("homeTeam", "name_en")
        .populate("awayTeam", "name_en")
        .populate("venue", "name_en")
        .lean();

      if (!dbFixture) {
        console.log(`❌ Fixture not found in DB: ${match.dbFixtureId}`);
        continue;
      }

      console.log(`\n📅 ${match.date} - ${match.p1Home} vs ${match.p1Away}`);
      console.log(`   P1 CSV: ${match.p1Home} (home) vs ${match.p1Away} (away)`);
      console.log(
        `   DB: ${dbFixture.homeTeam.name_en} (home) vs ${dbFixture.awayTeam.name_en} (away)`
      );
      console.log(`   DB Venue: ${dbFixture.venue?.name_en || "N/A"}`);

      // Try to find in API
      const apiFixture = await findFixtureByTeamsAndDate(
        match.p1Home,
        match.p1Away,
        match.date
      );

      if (apiFixture) {
        const apiHome = apiFixture.teams.home.name;
        const apiAway = apiFixture.teams.away.name;
        const apiVenue = apiFixture.fixture.venue.name;
        const apiDate = apiFixture.fixture.date;

        console.log(`   ✅ API Found: ${apiHome} (home) vs ${apiAway} (away)`);
        console.log(`   API Venue: ${apiVenue}`);
        console.log(`   API Date: ${apiDate}`);
        console.log(`   API Fixture ID: ${apiFixture.fixture.id}`);

        // Check if teams are reversed
        const p1HomeMatchesAPI =
          apiHome.toLowerCase().includes(match.p1Home.toLowerCase()) ||
          match.p1Home.toLowerCase().includes(apiHome.toLowerCase());
        const p1AwayMatchesAPI =
          apiAway.toLowerCase().includes(match.p1Away.toLowerCase()) ||
          match.p1Away.toLowerCase().includes(apiAway.toLowerCase());

        if (p1HomeMatchesAPI && p1AwayMatchesAPI) {
          console.log(`   ✅ Teams match P1 CSV (correct order)`);
        } else {
          console.log(`   ⚠️  Teams might be reversed in DB`);
        }
      } else {
        console.log(`   ❌ Not found in API`);
      }
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
}

run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});


