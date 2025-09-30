import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Import models
import FootballEvent from "../src/models/FootballEvent.js";
import League from "../src/models/League.js";
import Team from "../src/models/Team.js";
import Venue from "../src/models/Venue.js";

// Premier League Round 20 fixtures data from API response
const round20Fixtures = [
  {
    fixtureId: 1379166,
    date: "2026-01-03T15:00:00+00:00",
    status: "Not Started",
    homeTeamId: 34, // Newcastle
    awayTeamId: 52, // Crystal Palace
    venueId: 562, // St. James' Park
    round: "Regular Season - 20",
    roundNumber: 20,
  },
  {
    fixtureId: 1379160,
    date: "2026-01-03T15:00:00+00:00",
    status: "Not Started",
    homeTeamId: 35, // Bournemouth
    awayTeamId: 42, // Arsenal
    venueId: 504, // Vitality Stadium
    round: "Regular Season - 20",
    roundNumber: 20,
  },
  {
    fixtureId: 1379163,
    date: "2026-01-03T15:00:00+00:00",
    status: "Not Started",
    homeTeamId: 36, // Fulham
    awayTeamId: 40, // Liverpool
    venueId: 535, // Craven Cottage
    round: "Regular Season - 20",
    roundNumber: 20,
  },
  {
    fixtureId: 1379168,
    date: "2026-01-03T15:00:00+00:00",
    status: "Not Started",
    homeTeamId: 39, // Wolves
    awayTeamId: 48, // West Ham
    venueId: 600, // Molineux Stadium
    round: "Regular Season - 20",
    roundNumber: 20,
  },
  {
    fixtureId: 1379162,
    date: "2026-01-03T15:00:00+00:00",
    status: "Not Started",
    homeTeamId: 45, // Everton
    awayTeamId: 55, // Brentford
    venueId: 22033, // Hill Dickinson Stadium
    round: "Regular Season - 20",
    roundNumber: 20,
  },
  {
    fixtureId: 1379167,
    date: "2026-01-03T15:00:00+00:00",
    status: "Not Started",
    homeTeamId: 47, // Tottenham
    awayTeamId: 746, // Sunderland
    venueId: 593, // Tottenham Hotspur Stadium
    round: "Regular Season - 20",
    roundNumber: 20,
  },
  {
    fixtureId: 1379165,
    date: "2026-01-03T15:00:00+00:00",
    status: "Not Started",
    homeTeamId: 50, // Manchester City
    awayTeamId: 49, // Chelsea
    venueId: 555, // Etihad Stadium
    round: "Regular Season - 20",
    roundNumber: 20,
  },
  {
    fixtureId: 1379161,
    date: "2026-01-03T15:00:00+00:00",
    status: "Not Started",
    homeTeamId: 51, // Brighton
    awayTeamId: 44, // Burnley
    venueId: 508, // American Express Stadium
    round: "Regular Season - 20",
    roundNumber: 20,
  },
  {
    fixtureId: 1379164,
    date: "2026-01-03T15:00:00+00:00",
    status: "Not Started",
    homeTeamId: 63, // Leeds
    awayTeamId: 33, // Manchester United
    venueId: 546, // Elland Road
    round: "Regular Season - 20",
    roundNumber: 20,
  },
  {
    fixtureId: 1379159,
    date: "2026-01-03T15:00:00+00:00",
    status: "Not Started",
    homeTeamId: 66, // Aston Villa
    awayTeamId: 65, // Nottingham Forest
    venueId: 495, // Villa Park
    round: "Regular Season - 20",
    roundNumber: 20,
  },
];

async function importPremierLeagueRound20() {
  try {
    console.log("🔄 Connecting to MongoDB...");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    console.log("🔄 Importing Premier League Round 20 fixtures...");

    // First, ensure Premier League exists
    let premierLeague = await League.findOne({
      "externalIds.apiFootball": 39,
    });

    if (!premierLeague) {
      console.log("🔄 Creating Premier League...");
      premierLeague = new League({
        leagueId: 39,
        name: "Premier League",
        slug: "epl",
        country: "England",
        logoUrl: "https://media.api-sports.io/football/leagues/39.png",
        type: "League",
        externalIds: { apiFootball: 39 },
      });
      await premierLeague.save();
      console.log("✅ Created Premier League");
    } else {
      console.log("✅ Premier League already exists");
    }

    const importedFixtures = [];
    const skippedFixtures = [];

    for (const fixtureData of round20Fixtures) {
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
          tags: ["Premier League", "Round 20", "2025"],
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

    // Show fixtures by league
    const fixturesByLeague = await FootballEvent.aggregate([
      {
        $lookup: {
          from: "leagues",
          localField: "league",
          foreignField: "_id",
          as: "leagueInfo",
        },
      },
      {
        $unwind: "$leagueInfo",
      },
      {
        $group: {
          _id: "$leagueInfo.name",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    console.log("\n🏆 Fixtures by League:");
    fixturesByLeague.forEach((league) => {
      console.log(`  - ${league._id}: ${league.count} fixtures`);
    });

    // Show some examples
    const sampleFixtures = await FootballEvent.find({})
      .populate("homeTeam", "name code")
      .populate("awayTeam", "name code")
      .populate("venue", "name city")
      .populate("league", "name")
      .limit(5)
      .sort({ date: 1 });
    console.log("\n📋 Sample fixtures:");
    sampleFixtures.forEach((fixture) => {
      console.log(
        `  - ${fixture.homeTeam.name} vs ${fixture.awayTeam.name} - ${
          fixture.venue.name
        } (${fixture.date.toISOString().split("T")[0]})`
      );
    });

    // Show fixtures for this round
    const round20FixturesInDb = await FootballEvent.find({ roundNumber: 20 })
      .populate("homeTeam", "name code")
      .populate("awayTeam", "name code")
      .populate("venue", "name city")
      .sort({ date: 1 });

    console.log("\n⚽ Round 20 Fixtures:");
    round20FixturesInDb.forEach((fixture) => {
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
importPremierLeagueRound20();
