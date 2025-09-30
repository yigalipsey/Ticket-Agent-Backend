import mongoose from "mongoose";
import dotenv from "dotenv";
import FootballEvent from "../src/models/FootballEvent.js";
import Team from "../src/models/Team.js";
import Venue from "../src/models/Venue.js";
import League from "../src/models/League.js";

dotenv.config();

const LA_LIGA_ID = 140;
const SEASON = 2025;
const ROUNDS = [20, 21, 22, 23];
const API_KEY = process.env.X_RAPIDAPI_KEY;

async function fetchLaLigaRoundFromApi(leagueId, season, round) {
  const url = `https://v3.football.api-sports.io/fixtures?league=${leagueId}&season=${season}&round=Regular%20Season%20-%20${round}`;
  const headers = {
    "x-rapidapi-key": API_KEY,
    "x-rapidapi-host": "v3.football.api-sports.io",
  };

  try {
    console.log(`🔄 Fetching La Liga Round ${round}...`);
    const response = await fetch(url, { headers });
    const data = await response.json();

    if (data.response && data.response.length > 0) {
      console.log(
        `✅ Found ${data.response.length} fixtures for Round ${round}`
      );
      return data.response;
    }
    return [];
  } catch (error) {
    console.error(`❌ Error fetching Round ${round}:`, error);
    return [];
  }
}

async function importLaLigaRounds20to23() {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    console.log("🔄 Importing La Liga Rounds 20-23...");

    // Ensure La Liga exists
    let laLiga = await League.findOne({
      "externalIds.apiFootball": LA_LIGA_ID,
    });

    if (!laLiga) {
      console.log("❌ La Liga not found. Please create it first.");
      return;
    }

    const allImportedFixtures = [];
    const allSkippedFixtures = [];
    const allMissingTeams = [];
    const allMissingVenues = [];

    for (const round of ROUNDS) {
      console.log(`\n📊 Processing Round ${round}...`);

      const roundFixtures = await fetchLaLigaRoundFromApi(
        LA_LIGA_ID,
        SEASON,
        round
      );

      const importedFixtures = [];
      const skippedFixtures = [];
      const missingTeams = [];
      const missingVenues = [];

      for (const fixtureData of roundFixtures) {
        try {
          // Check if fixture already exists
          const existingFixture = await FootballEvent.findOne({
            "externalIds.apiFootball": fixtureData.fixture.id,
          });

          if (existingFixture) {
            skippedFixtures.push(fixtureData.fixture.id);
            continue;
          }

          // Find home team
          const homeTeam = await Team.findOne({
            "externalIds.apiFootball": fixtureData.teams.home.id,
          });

          if (!homeTeam) {
            missingTeams.push({
              id: fixtureData.teams.home.id,
              name: fixtureData.teams.home.name,
              type: "home",
              round: round,
            });
            continue;
          }

          // Find away team
          const awayTeam = await Team.findOne({
            "externalIds.apiFootball": fixtureData.teams.away.id,
          });

          if (!awayTeam) {
            missingTeams.push({
              id: fixtureData.teams.away.id,
              name: fixtureData.teams.away.name,
              type: "away",
              round: round,
            });
            continue;
          }

          // Find venue
          const venue = await Venue.findOne({
            "externalIds.apiFootball": fixtureData.fixture.venue.id,
          });

          if (!venue) {
            missingVenues.push({
              id: fixtureData.fixture.venue.id,
              name: fixtureData.fixture.venue.name,
              city: fixtureData.fixture.venue.city,
              round: round,
            });
            continue;
          }

          // Create slug with league prefix
          const leagueSlug = laLiga.slug;
          const slug = `${leagueSlug}-${homeTeam.slug}-vs-${awayTeam.slug}-${round}`;

          // Create fixture document
          const fixture = new FootballEvent({
            date: new Date(fixtureData.fixture.date),
            status: fixtureData.fixture.status.long,
            league: laLiga._id,
            homeTeam: homeTeam._id,
            awayTeam: awayTeam._id,
            venue: venue._id,
            round: fixtureData.league.round,
            roundNumber: round,
            slug: slug,
            tags: ["La Liga", `Round ${round}`, `${SEASON}`],
            externalIds: { apiFootball: fixtureData.fixture.id },
          });

          await fixture.save();
          importedFixtures.push(fixture);
        } catch (error) {
          console.error(
            `❌ Failed to import fixture ${fixtureData.fixture.id}:`,
            error.message
          );
        }
      }

      console.log(
        `✅ Round ${round}: Imported ${importedFixtures.length} fixtures`
      );

      allImportedFixtures.push(...importedFixtures);
      allSkippedFixtures.push(...skippedFixtures);
      allMissingTeams.push(...missingTeams);
      allMissingVenues.push(...missingVenues);
    }

    console.log(
      `\n🎉 Successfully imported ${allImportedFixtures.length} fixtures total`
    );
    console.log(`⚠️  Skipped ${allSkippedFixtures.length} existing fixtures`);

    if (allMissingTeams.length > 0) {
      console.log(`\n❌ Missing teams (${allMissingTeams.length}):`);
      const uniqueTeams = [...new Set(allMissingTeams.map((t) => t.name))];
      uniqueTeams.slice(0, 10).forEach((teamName) => {
        console.log(`  - ${teamName}`);
      });
      if (uniqueTeams.length > 10) {
        console.log(`  ... and ${uniqueTeams.length - 10} more`);
      }
    }

    if (allMissingVenues.length > 0) {
      console.log(`\n❌ Missing venues (${allMissingVenues.length}):`);
      const uniqueVenues = [...new Set(allMissingVenues.map((v) => v.name))];
      uniqueVenues.slice(0, 10).forEach((venueName) => {
        console.log(`  - ${venueName}`);
      });
      if (uniqueVenues.length > 10) {
        console.log(`  ... and ${uniqueVenues.length - 10} more`);
      }
    }

    // Show statistics
    const totalFixtures = await FootballEvent.countDocuments();
    console.log(`📈 Total fixtures in database: ${totalFixtures}`);

    // Show fixtures by round
    for (const round of ROUNDS) {
      const roundFixtures = await FootballEvent.find({
        league: laLiga._id,
        roundNumber: round,
      })
        .populate("homeTeam", "name code")
        .populate("awayTeam", "name code")
        .populate("venue", "name city")
        .sort({ date: 1 });

      console.log(`\n⚽ Round ${round} fixtures (${roundFixtures.length}):`);
      roundFixtures.forEach((fixture) => {
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
    }
  } catch (error) {
    console.error("❌ Error importing fixtures:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

importLaLigaRounds20to23();
