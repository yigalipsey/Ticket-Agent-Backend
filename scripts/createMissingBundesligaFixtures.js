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

const fixturesToCreate = [
  {
    apiId: 1388407,
    p1Home: "Bayer 04 Leverkusen",
    p1Away: "Borussia Dortmund",
    date: "2025-11-29",
  },
  {
    apiId: 1388400,
    p1Home: "Borussia Dortmund",
    p1Away: "Stuttgart",
    date: "2025-11-22",
  },
];

async function findTeamByName(teamName) {
  // Try to find team by various name variations
  const variations = [
    teamName,
    teamName.replace("FC ", ""),
    teamName.replace("1. ", ""),
    teamName.replace("TSG ", ""),
    teamName.replace("VfB ", ""),
    teamName.replace("SC ", ""),
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

async function findVenueByName(venueName) {
  // Try to find venue by name
  const venue = await Venue.findOne({
    $or: [
      { name_en: new RegExp(venueName, "i") },
      { name_en: new RegExp(venueName, "i") },
    ],
  });

  return venue;
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

function generateSlug(homeTeamSlug, awayTeamSlug, date) {
  const dateStr = date.split("T")[0].replace(/-/g, "-");
  return `${homeTeamSlug}-vs-${awayTeamSlug}-${dateStr}`;
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");

  try {
    const bundesliga = await League.findOne({
      $or: [{ slug: "bundesliga" }, { name: /bundesliga/i }],
    });

    if (!bundesliga) {
      throw new Error("Bundesliga league not found");
    }

    console.log("Creating missing fixtures...\n");
    console.log("=".repeat(80));

    let created = 0;
    let errors = 0;

    for (const fixtureInfo of fixturesToCreate) {
      try {
        // Check if fixture already exists
        const homeTeam = await findTeamByName(fixtureInfo.p1Home);
        const awayTeam = await findTeamByName(fixtureInfo.p1Away);

        if (!homeTeam || !awayTeam) {
          console.log(
            `❌ Teams not found: ${fixtureInfo.p1Home} or ${fixtureInfo.p1Away}`
          );
          errors++;
          continue;
        }

        const matchDate = new Date(fixtureInfo.date + "T00:00:00Z");
        const startDate = new Date(matchDate);
        startDate.setDate(startDate.getDate() - 3);
        const endDate = new Date(matchDate);
        endDate.setDate(endDate.getDate() + 3);

        const existing = await FootballEvent.findOne({
          league: bundesliga._id,
          $or: [
            { homeTeam: homeTeam._id, awayTeam: awayTeam._id },
            { homeTeam: awayTeam._id, awayTeam: homeTeam._id },
          ],
          date: { $gte: startDate, $lte: endDate },
        });

        if (existing) {
          console.log(
            `⏭️  Already exists: ${homeTeam.name_en} vs ${awayTeam.name_en}`
          );
          continue;
        }

        // Fetch from API
        const apiFixture = await fetchFixtureFromAPI(fixtureInfo.apiId);
        if (!apiFixture) {
          console.log(`❌ Fixture not found in API: ${fixtureInfo.apiId}`);
          errors++;
          continue;
        }

        const apiHomeName = apiFixture.teams.home.name;
        const apiAwayName = apiFixture.teams.away.name;
        const apiDate = new Date(apiFixture.fixture.date);
        const apiVenueName = apiFixture.fixture.venue.name;

        // Find venue
        let venue = await findVenueByName(apiVenueName);
        if (!venue) {
          // Try alternative names
          if (apiVenueName.includes("Signal Iduna")) {
            venue = await Venue.findOne({
              $or: [
                { name_en: /signal/i },
                { name_en: /iduna/i },
                { name_en: /דורטמונד/i },
              ],
            });
          } else if (apiVenueName.includes("BayArena")) {
            venue = await Venue.findOne({
              $or: [{ name_en: /bayarena/i }, { name_en: /leverkusen/i }],
            });
          }
        }

        if (!venue) {
          console.log(
            `⚠️  Venue not found: ${apiVenueName}, creating without venue`
          );
        }

        // Generate slug
        const homeSlug =
          homeTeam.slug || homeTeam.name_en.toLowerCase().replace(/\s+/g, "-");
        const awaySlug =
          awayTeam.slug || awayTeam.name_en.toLowerCase().replace(/\s+/g, "-");
        const slug = generateSlug(homeSlug, awaySlug, apiDate.toISOString());

        // Create fixture
        const fixtureData = {
          league: bundesliga._id,
          homeTeam: homeTeam._id,
          awayTeam: awayTeam._id,
          date: apiDate,
          status: "scheduled",
          externalIds: {
            apiFootball: fixtureInfo.apiId,
          },
          slug: slug,
          round: apiFixture.league.round || undefined,
        };

        if (venue) {
          fixtureData.venue = venue._id;
        }

        const newFixture = new FootballEvent(fixtureData);

        await newFixture.save();

        console.log(`✅ Created: ${homeTeam.name_en} vs ${awayTeam.name_en}`);
        console.log(`   Date: ${apiDate.toISOString().split("T")[0]}`);
        console.log(`   Venue: ${apiVenueName}`);
        console.log(`   API ID: ${fixtureInfo.apiId}`);
        console.log(`   Slug: ${slug}\n`);

        created++;
      } catch (error) {
        console.error(
          `❌ Error creating fixture ${fixtureInfo.apiId}:`,
          error.message
        );
        errors++;
      }
    }

    console.log("=".repeat(80));
    console.log(`✅ Created: ${created} fixtures`);
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
