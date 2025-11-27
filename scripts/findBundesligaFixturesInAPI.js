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
  console.error("❌ API_FOOTBALL_KEY not found");
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

const BUNDESLIGA_LEAGUE_ID = 78;
const SEASON = 2025;

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

    console.log("Fetching all Bundesliga fixtures from API...\n");
    const response = await apiClient.get("/fixtures", {
      params: {
        league: BUNDESLIGA_LEAGUE_ID,
        season: SEASON,
      },
    });

    if (
      !response.data ||
      !response.data.response ||
      response.data.response.length === 0
    ) {
      console.log("❌ No fixtures found in API");
      return;
    }

    console.log(
      `✅ Found ${response.data.response.length} fixtures in API\n`
    );
    console.log("=".repeat(80));

    for (const match of matchesToCheck) {
      const dbFixture = await FootballEvent.findById(match.dbFixtureId)
        .populate("homeTeam", "name_en")
        .populate("awayTeam", "name_en")
        .lean();

      if (!dbFixture) {
        console.log(`❌ Fixture not found in DB: ${match.dbFixtureId}`);
        continue;
      }

      // Find matching fixture in API response
      const matchDate = new Date(match.date + "T00:00:00Z");
      const apiFixtures = response.data.response.filter((f) => {
        const fixtureDate = new Date(f.fixture.date);
        const dateDiff = Math.abs(fixtureDate - matchDate);
        return dateDiff < 24 * 60 * 60 * 1000; // Within 24 hours
      });

      let foundFixture = null;
      for (const apiFixture of apiFixtures) {
        const apiHome = apiFixture.teams.home.name.toLowerCase();
        const apiAway = apiFixture.teams.away.name.toLowerCase();
        const p1Home = match.p1Home.toLowerCase();
        const p1Away = match.p1Away.toLowerCase();

        // Check if teams match (either order)
        const homeMatches =
          apiHome.includes(p1Home) ||
          p1Home.includes(apiHome) ||
          apiHome.includes("leverkusen") && p1Home.includes("leverkusen") ||
          apiHome.includes("bayern") && p1Home.includes("bayern") ||
          apiHome.includes("dortmund") && p1Home.includes("dortmund");

        const awayMatches =
          apiAway.includes(p1Away) ||
          p1Away.includes(apiAway) ||
          apiAway.includes("leverkusen") && p1Away.includes("leverkusen") ||
          apiAway.includes("bayern") && p1Away.includes("bayern") ||
          apiAway.includes("dortmund") && p1Away.includes("dortmund");

        if (homeMatches && awayMatches) {
          foundFixture = apiFixture;
          break;
        }
      }

      console.log(`\n📅 ${match.date} - ${match.p1Home} vs ${match.p1Away}`);
      console.log(`   P1 CSV: ${match.p1Home} (home) vs ${match.p1Away} (away)`);
      console.log(
        `   DB: ${dbFixture.homeTeam.name_en} (home) vs ${dbFixture.awayTeam.name_en} (away)`
      );

      if (foundFixture) {
        const apiHome = foundFixture.teams.home.name;
        const apiAway = foundFixture.teams.away.name;
        const apiVenue = foundFixture.fixture.venue.name;
        const apiDate = foundFixture.fixture.date;
        const apiId = foundFixture.fixture.id;

        console.log(`   ✅ API Found: ${apiHome} (home) vs ${apiAway} (away)`);
        console.log(`   API ID: ${apiId}`);
        console.log(`   API Venue: ${apiVenue}`);
        console.log(`   API Date: ${apiDate}`);

        // Check if order matches P1 CSV
        const p1HomeMatches =
          apiHome.toLowerCase().includes(match.p1Home.toLowerCase()) ||
          match.p1Home.toLowerCase().includes(apiHome.toLowerCase());
        const p1AwayMatches =
          apiAway.toLowerCase().includes(match.p1Away.toLowerCase()) ||
          match.p1Away.toLowerCase().includes(apiAway.toLowerCase());

        if (p1HomeMatches && p1AwayMatches) {
          console.log(`   ✅ Teams order matches P1 CSV (correct)`);
          if (
            dbFixture.homeTeam.name_en !== match.p1Home ||
            dbFixture.awayTeam.name_en !== match.p1Away
          ) {
            console.log(`   ⚠️  DB teams are REVERSED - needs fixing!`);
          }
        } else {
          console.log(`   ⚠️  Teams are reversed in API compared to P1 CSV`);
        }
      } else {
        console.log(`   ❌ Not found in API`);
      }
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    if (error.response) {
      console.error("API Response:", error.response.data);
    }
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
}

run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

