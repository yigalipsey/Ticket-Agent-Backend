import "dotenv/config";
import axios from "axios";
import mongoose from "mongoose";
import FootballEvent from "../src/models/FootballEvent.js";
import Team from "../src/models/Team.js";

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

// Fixtures to fix with their API IDs
const fixturesToFix = [
  {
    dbFixtureId: "6926e33fa3a933930dad478e",
    apiId: 1388533,
    p1Home: "Bayer 04 Leverkusen",
    p1Away: "FC Bayern München",
  },
  {
    dbFixtureId: "6926e33ca3a933930dad4746",
    apiId: 1388516,
    p1Home: "Bayer 04 Leverkusen",
    p1Away: "1. FSV Mainz 05",
  },
  {
    dbFixtureId: "6926e345a3a933930dad4856",
    apiId: 1388587,
    p1Home: "Bayer 04 Leverkusen",
    p1Away: "RB Leipzig",
  },
  {
    dbFixtureId: "6926e330a3a933930dad45d2",
    apiId: 1388425,
    p1Home: "Bayer 04 Leverkusen",
    p1Away: "FC Köln",
  },
  {
    dbFixtureId: "6926e335a3a933930dad4676",
    apiId: 1388462,
    p1Home: "Borussia Dortmund",
    p1Away: "FC St. Pauli",
  },
  {
    dbFixtureId: "6926e33aa3a933930dad470a",
    apiId: 1388499,
    p1Home: "Borussia Dortmund",
    p1Away: "1. FSV Mainz 05",
  },
  {
    dbFixtureId: "6926e33ca3a933930dad474a",
    apiId: 1388518,
    p1Home: "Borussia Dortmund",
    p1Away: "FC Bayern München",
  },
  {
    dbFixtureId: "6926e33ea3a933930dad4782",
    apiId: 1388535,
    p1Home: "Borussia Dortmund",
    p1Away: "FC Augsburg",
  },
  {
    dbFixtureId: "6926e342a3a933930dad47fa",
    apiId: 1388561,
    p1Home: "Borussia Dortmund",
    p1Away: "Bayer 04 Leverkusen",
  },
  {
    dbFixtureId: "6926e347a3a933930dad4886",
    apiId: 1388597,
    p1Home: "Borussia Dortmund",
    p1Away: "Eintracht Frankfurt",
  },
];

async function findTeamByName(teamName) {
  // Try to find team by various name variations
  const variations = [
    teamName,
    teamName.replace("FC ", ""),
    teamName.replace("1. ", ""),
    teamName.replace("TSG ", ""),
  ];

  for (const variation of variations) {
    let team = await Team.findOne({
      $or: [
        { name_en: new RegExp(`^${variation}$`, "i") },
        { name: new RegExp(`^${variation}$`, "i") },
        { "suppliersInfo.supplierTeamName": variation },
      ],
    });

    if (team) return team;
  }

  return null;
}

async function fetchFixtureFromAPI(apiId) {
  try {
    const response = await apiClient.get("/fixtures", {
      params: {
        id: apiId,
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
    console.error(`Error fetching fixture ${apiId}:`, error.message);
    return null;
  }
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");

  try {
    console.log("Fixing reversed fixtures...\n");
    console.log("=".repeat(80));

    let fixed = 0;
    let errors = 0;

    for (const fixtureInfo of fixturesToFix) {
      try {
        // Get fixture from DB
        const dbFixture = await FootballEvent.findById(fixtureInfo.dbFixtureId);
        if (!dbFixture) {
          console.log(`❌ Fixture not found in DB: ${fixtureInfo.dbFixtureId}`);
          errors++;
          continue;
        }

        // Get fixture from API
        const apiFixture = await fetchFixtureFromAPI(fixtureInfo.apiId);
        if (!apiFixture) {
          console.log(`❌ Fixture not found in API: ${fixtureInfo.apiId}`);
          errors++;
          continue;
        }

        const apiHomeName = apiFixture.teams.home.name;
        const apiAwayName = apiFixture.teams.away.name;
        const apiDate = new Date(apiFixture.fixture.date);

        // Find teams in DB
        const homeTeam = await findTeamByName(apiHomeName);
        const awayTeam = await findTeamByName(apiAwayName);

        if (!homeTeam || !awayTeam) {
          console.log(`❌ Teams not found: ${apiHomeName} or ${apiAwayName}`);
          errors++;
          continue;
        }

        // Check if already correct
        if (
          dbFixture.homeTeam.toString() === homeTeam._id.toString() &&
          dbFixture.awayTeam.toString() === awayTeam._id.toString()
        ) {
          console.log(`⏭️  Already correct: ${apiHomeName} vs ${apiAwayName}`);
          continue;
        }

        // Update fixture
        const oldHome = await Team.findById(dbFixture.homeTeam).lean();
        const oldAway = await Team.findById(dbFixture.awayTeam).lean();

        dbFixture.homeTeam = homeTeam._id;
        dbFixture.awayTeam = awayTeam._id;
        dbFixture.date = apiDate;
        if (!dbFixture.externalIds) {
          dbFixture.externalIds = {};
        }
        dbFixture.externalIds.apiFootball = fixtureInfo.apiId;

        await dbFixture.save();

        console.log(
          `✅ Fixed: ${apiHomeName} vs ${apiAwayName} (${
            apiDate.toISOString().split("T")[0]
          })`
        );
        console.log(`   Was: ${oldHome.name_en} vs ${oldAway.name_en}`);
        console.log(`   Now: ${homeTeam.name_en} vs ${awayTeam.name_en}`);
        console.log(`   API ID: ${fixtureInfo.apiId}\n`);

        fixed++;
      } catch (error) {
        console.error(
          `❌ Error fixing fixture ${fixtureInfo.dbFixtureId}:`,
          error.message
        );
        errors++;
      }
    }

    console.log("=".repeat(80));
    console.log(`✅ Fixed: ${fixed} fixtures`);
    console.log(`❌ Errors: ${errors}`);
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



