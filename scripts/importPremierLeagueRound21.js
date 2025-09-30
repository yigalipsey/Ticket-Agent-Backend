import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Import models
import FootballEvent from "../src/models/FootballEvent.js";
import League from "../src/models/League.js";
import Team from "../src/models/Team.js";
import Venue from "../src/models/Venue.js";

// Premier League Round 21 fixtures data from API response
const round21Fixtures = [
  {
    fixtureId: 1379177,
    date: "2026-01-07T20:00:00+00:00",
    status: "Not Started",
    homeTeamId: 34, // Newcastle
    awayTeamId: 63, // Leeds
    venueId: 562, // St. James' Park
    round: "Regular Season - 21",
    roundNumber: 21,
  },
  {
    fixtureId: 1379170,
    date: "2026-01-07T20:00:00+00:00",
    status: "Not Started",
    homeTeamId: 35, // Bournemouth
    awayTeamId: 47, // Tottenham
    venueId: 504, // Vitality Stadium
    round: "Regular Season - 21",
    roundNumber: 21,
  },
  {
    fixtureId: 1379175,
    date: "2026-01-07T20:00:00+00:00",
    status: "Not Started",
    homeTeamId: 36, // Fulham
    awayTeamId: 49, // Chelsea
    venueId: 535, // Craven Cottage
    round: "Regular Season - 21",
    roundNumber: 21,
  },
  {
    fixtureId: 1379169,
    date: "2026-01-07T20:00:00+00:00",
    status: "Not Started",
    homeTeamId: 42, // Arsenal
    awayTeamId: 40, // Liverpool
    venueId: 494, // Emirates Stadium
    round: "Regular Season - 21",
    roundNumber: 21,
  },
  {
    fixtureId: 1379172,
    date: "2026-01-07T20:00:00+00:00",
    status: "Not Started",
    homeTeamId: 44, // Burnley
    awayTeamId: 33, // Manchester United
    venueId: 512, // Turf Moor
    round: "Regular Season - 21",
    roundNumber: 21,
  },
  {
    fixtureId: 1379174,
    date: "2026-01-07T20:00:00+00:00",
    status: "Not Started",
    homeTeamId: 45, // Everton
    awayTeamId: 39, // Wolves
    venueId: 22033, // Hill Dickinson Stadium
    round: "Regular Season - 21",
    roundNumber: 21,
  },
  {
    fixtureId: 1379178,
    date: "2026-01-07T20:00:00+00:00",
    status: "Not Started",
    homeTeamId: 48, // West Ham
    awayTeamId: 65, // Nottingham Forest
    venueId: 598, // London Stadium
    round: "Regular Season - 21",
    roundNumber: 21,
  },
  {
    fixtureId: 1379176,
    date: "2026-01-07T20:00:00+00:00",
    status: "Not Started",
    homeTeamId: 50, // Manchester City
    awayTeamId: 51, // Brighton
    venueId: 555, // Etihad Stadium
    round: "Regular Season - 21",
    roundNumber: 21,
  },
  {
    fixtureId: 1379173,
    date: "2026-01-07T20:00:00+00:00",
    status: "Not Started",
    homeTeamId: 52, // Crystal Palace
    awayTeamId: 66, // Aston Villa
    venueId: 525, // Selhurst Park
    round: "Regular Season - 21",
    roundNumber: 21,
  },
  {
    fixtureId: 1379171,
    date: "2026-01-07T20:00:00+00:00",
    status: "Not Started",
    homeTeamId: 55, // Brentford
    awayTeamId: 746, // Sunderland
    venueId: 10503, // Gtech Community Stadium
    round: "Regular Season - 21",
    roundNumber: 21,
  },
];

async function importPremierLeagueRound21() {
  try {
    console.log("🔄 Connecting to MongoDB...");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    console.log("🔄 Importing Premier League Round 21 fixtures...");

    // Get Premier League
    const premierLeague = await League.findOne({
      "externalIds.apiFootball": 39,
    });

    if (!premierLeague) {
      console.log(
        "❌ Premier League not found. Please run the Round 20 import first."
      );
      return;
    }

    const importedFixtures = [];
    const skippedFixtures = [];

    for (const fixtureData of round21Fixtures) {
      try {
        // Check if fixture already exists
        const existingFixture = await FootballEvent.findOne({
          "externalIds.apiFootball": fixtureData.fixtureId,
        });

        if (existingFixture) {
          console.log(`⚠️  Fixture already exists: ${fixtureData.fixtureId}`);
          skippedFixtures.push(fixtureData.fixtureId);
          continue;
        }

        // Find home team
        const homeTeam = await Team.findOne({
          "externalIds.apiFootball": fixtureData.homeTeamId,
        });

        if (!homeTeam) {
          console.log(
            `❌ Home team not found for fixture ${fixtureData.fixtureId} (teamId: ${fixtureData.homeTeamId})`
          );
          continue;
        }

        // Find away team
        const awayTeam = await Team.findOne({
          "externalIds.apiFootball": fixtureData.awayTeamId,
        });

        if (!awayTeam) {
          console.log(
            `❌ Away team not found for fixture ${fixtureData.fixtureId} (teamId: ${fixtureData.awayTeamId})`
          );
          continue;
        }

        // Find venue
        const venue = await Venue.findOne({
          "externalIds.apiFootball": fixtureData.venueId,
        });

        if (!venue) {
          console.log(
            `❌ Venue not found for fixture ${fixtureData.fixtureId} (venueId: ${fixtureData.venueId})`
          );
          continue;
        }

        // Create slug with league prefix
        const leagueSlug = "epl"; // Premier League slug
        const slug = `${leagueSlug}-${homeTeam.slug}-vs-${awayTeam.slug}-${fixtureData.roundNumber}`;

        // Create fixture document
        const fixture = new FootballEvent({
          date: new Date(fixtureData.date),
          status: fixtureData.status,
          league: premierLeague._id,
          homeTeam: homeTeam._id,
          awayTeam: awayTeam._id,
          venue: venue._id,
          round: fixtureData.round,
          roundNumber: fixtureData.roundNumber,
          slug: slug,
          tags: ["Premier League", "Round 21", "2025"],
          externalIds: { apiFootball: fixtureData.fixtureId },
        });

        await fixture.save();
        importedFixtures.push(fixture);

        console.log(
          `✅ Imported: ${homeTeam.name} vs ${awayTeam.name} - ${venue.name} (${fixtureData.date})`
        );
      } catch (error) {
        console.error(
          `❌ Failed to import fixture ${fixtureData.fixtureId}:`,
          error.message
        );
      }
    }

    console.log(`🎉 Successfully imported ${importedFixtures.length} fixtures`);
    console.log(`⚠️  Skipped ${skippedFixtures.length} existing fixtures`);

    // Show statistics
    const totalFixtures = await FootballEvent.countDocuments();
    console.log(`📈 Total fixtures in database: ${totalFixtures}`);

    // Show fixtures for this round
    const round21FixturesInDb = await FootballEvent.find({ roundNumber: 21 })
      .populate("homeTeam", "name code")
      .populate("awayTeam", "name code")
      .populate("venue", "name city")
      .sort({ date: 1 });

    console.log("\n⚽ Round 21 Fixtures:");
    round21FixturesInDb.forEach((fixture) => {
      const date = new Date(fixture.date).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      console.log(
        `  - ${fixture.homeTeam.name} vs ${fixture.awayTeam.name} - ${fixture.venue.name} (${date})`
      );
    });
  } catch (error) {
    console.error("❌ Error importing fixtures:", error);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

// Run the import
importPremierLeagueRound21();
