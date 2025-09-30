import mongoose from "mongoose";
import dotenv from "dotenv";
import FootballEvent from "../src/models/FootballEvent.js";
import Team from "../src/models/Team.js";
import Venue from "../src/models/Venue.js";
import League from "../src/models/League.js";

dotenv.config();

const LA_LIGA_ID = 140;
const SEASON = 2025;
const API_KEY = process.env.X_RAPIDAPI_KEY;

async function fetchLaLigaFixturesFromApi(leagueId, season) {
  const url = `https://v3.football.api-sports.io/fixtures?league=${leagueId}&season=${season}`;
  const headers = {
    "x-rapidapi-key": API_KEY,
    "x-rapidapi-host": "v3.football.api-sports.io",
  };

  try {
    console.log(`🔄 Fetching La Liga fixtures for season ${season}...`);
    const response = await fetch(url, { headers });
    const data = await response.json();
    
    if (data.response && data.response.length > 0) {
      console.log(`✅ Found ${data.response.length} fixtures`);
      return data.response;
    }
    return [];
  } catch (error) {
    console.error(`❌ Error fetching fixtures for league ${leagueId}, season ${season}:`, error);
    return [];
  }
}

async function importLaLiga2025() {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    console.log("🔄 Importing La Liga 2025 fixtures...");

    // Ensure La Liga exists
    let laLiga = await League.findOne({
      "externalIds.apiFootball": LA_LIGA_ID,
    });

    if (!laLiga) {
      console.log("🔄 Creating La Liga...");
      laLiga = new League({
        leagueId: LA_LIGA_ID,
        name: "La Liga",
        slug: "laliga",
        country: "Spain",
        logoUrl: "https://media.api-sports.io/football/leagues/140.png",
        type: "League",
        externalIds: { apiFootball: LA_LIGA_ID },
      });
      await laLiga.save();
      console.log("✅ Created La Liga");
    } else {
      console.log("✅ La Liga already exists");
    }

    const allFixtures = await fetchLaLigaFixturesFromApi(LA_LIGA_ID, SEASON);

    const importedFixtures = [];
    const skippedFixtures = [];
    const missingTeams = [];
    const missingVenues = [];

    console.log(`🔄 Processing ${allFixtures.length} fixtures...`);

    for (let i = 0; i < allFixtures.length; i++) {
      const fixtureData = allFixtures[i];
      
      if (i % 50 === 0) {
        console.log(`📊 Progress: ${i}/${allFixtures.length} fixtures processed`);
      }

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
            type: "home"
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
            type: "away"
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
            city: fixtureData.fixture.venue.city
          });
          continue;
        }

        // Create slug with league prefix
        const leagueSlug = laLiga.slug;
        const roundNumber = fixtureData.league.round ? 
          parseInt(fixtureData.league.round.split(' - ')[1]) || 1 : 1;
        const slug = `${leagueSlug}-${homeTeam.slug}-vs-${awayTeam.slug}-${roundNumber}`;

        // Create fixture document
        const fixture = new FootballEvent({
          date: new Date(fixtureData.fixture.date),
          status: fixtureData.fixture.status.long,
          league: laLiga._id,
          homeTeam: homeTeam._id,
          awayTeam: awayTeam._id,
          venue: venue._id,
          round: fixtureData.league.round,
          roundNumber: roundNumber,
          slug: slug,
          tags: ["La Liga", `Round ${roundNumber}`, `${SEASON}`],
          externalIds: { apiFootball: fixtureData.fixture.id },
        });

        await fixture.save();
        importedFixtures.push(fixture);

        if (importedFixtures.length % 20 === 0) {
          console.log(`✅ Imported ${importedFixtures.length} fixtures...`);
        }
      } catch (error) {
        console.error(`❌ Failed to import fixture ${fixtureData.fixture.id}:`, error.message);
      }
    }

    console.log(`🎉 Successfully imported ${importedFixtures.length} fixtures`);
    console.log(`⚠️  Skipped ${skippedFixtures.length} existing fixtures`);

    if (missingTeams.length > 0) {
      console.log(`\n❌ Missing teams (${missingTeams.length}):`);
      missingTeams.slice(0, 10).forEach(team => {
        console.log(`  - ${team.name} (ID: ${team.id}) - ${team.type} team`);
      });
      if (missingTeams.length > 10) {
        console.log(`  ... and ${missingTeams.length - 10} more`);
      }
    }

    if (missingVenues.length > 0) {
      console.log(`\n❌ Missing venues (${missingVenues.length}):`);
      missingVenues.slice(0, 10).forEach(venue => {
        console.log(`  - ${venue.name} (${venue.city}) - ID: ${venue.id}`);
      });
      if (missingVenues.length > 10) {
        console.log(`  ... and ${missingVenues.length - 10} more`);
      }
    }

    // Show statistics
    const totalFixtures = await FootballEvent.countDocuments();
    console.log(`📈 Total fixtures in database: ${totalFixtures}`);

    // Show some examples
    const sampleFixtures = await FootballEvent.find({ league: laLiga._id })
      .populate("homeTeam", "name code")
      .populate("awayTeam", "name code")
      .populate("venue", "name city")
      .sort({ date: 1 })
      .limit(5);

    console.log("\n⚽ Sample La Liga fixtures:");
    sampleFixtures.forEach((fixture) => {
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
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

importLaLiga2025();
