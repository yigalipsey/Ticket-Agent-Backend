import dotenv from "dotenv";
import axios from "axios";
import FootballEvent from "../src/models/FootballEvent.js";
import League from "../src/models/League.js";
import Team from "../src/models/Team.js";
import Venue from "../src/models/Venue.js";
import databaseConnection from "../src/config/database.js";

dotenv.config();

// API Football configuration
const API_FOOTBALL_BASE_URL =
  process.env.API_FOOTBALL_BASE_URL || "https://v3.football.api-sports.io";
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;

if (!API_FOOTBALL_KEY) {
  console.error("❌ API_FOOTBALL_KEY not found in environment variables");
  process.exit(1);
}

// API Football client
const apiClient = axios.create({
  baseURL: API_FOOTBALL_BASE_URL,
  headers: {
    "x-rapidapi-key": API_FOOTBALL_KEY,
    "x-rapidapi-host": "v3.football.api-sports.io",
  },
  timeout: 30000,
});

// Serie A configuration
const SERIEA_API_FOOTBALL_ID = 135; // API-Football league ID for Serie A
const CURRENT_SEASON = 2025;

// Generate slug from teams and date
function generateSlug(homeTeamSlug, awayTeamSlug, date) {
  const dateStr = new Date(date).toISOString().split("T")[0]; // YYYY-MM-DD
  return `${homeTeamSlug}-vs-${awayTeamSlug}-${dateStr}`;
}

// Step 1: Fetch matches from API-Football
async function fetchMatchesFromAPI() {
  try {
    console.log("=".repeat(80));
    console.log("📍 STEP 1: Fetching matches from API-Football");
    console.log("=".repeat(80));
    console.log("");

    console.log(
      `🔍 Fetching fixtures for Serie A (ID: ${SERIEA_API_FOOTBALL_ID}, Season: ${CURRENT_SEASON})...`
    );
    console.log("");

    const fixturesResponse = await apiClient.get("/fixtures", {
      params: {
        league: SERIEA_API_FOOTBALL_ID,
        season: CURRENT_SEASON,
      },
    });

    if (
      !fixturesResponse.data ||
      !fixturesResponse.data.response ||
      fixturesResponse.data.response.length === 0
    ) {
      console.log("❌ No fixtures found in API response");
      return [];
    }

    console.log(
      `✅ Found ${fixturesResponse.data.response.length} fixtures in API response`
    );
    console.log("");

    return fixturesResponse.data.response;
  } catch (error) {
    console.error("❌ Error fetching matches from API:", error.message);
    if (error.response) {
      console.error("API Response:", error.response.data);
    }
    throw error;
  }
}

// Step 2: Create matches in database
async function createMatches(apiFixtures, league, teams, venues) {
  try {
    console.log("=".repeat(80));
    console.log("📍 STEP 2: Creating matches in database");
    console.log("=".repeat(80));
    console.log("");

    // Create lookup maps
    const teamMapByApiId = new Map();
    const teamMapBySlug = new Map();
    teams.forEach((team) => {
      if (team.apiFootballId) {
        teamMapByApiId.set(team.apiFootballId, team);
      }
      if (team.externalIds?.apiFootball) {
        teamMapByApiId.set(team.externalIds.apiFootball, team);
      }
      teamMapBySlug.set(team.slug, team);
    });

    const venueMapByApiId = new Map();
    venues.forEach((venue) => {
      if (venue.externalIds?.apiFootball) {
        venueMapByApiId.set(venue.externalIds.apiFootball, venue);
      }
      if (venue.venueId) {
        venueMapByApiId.set(venue.venueId, venue);
      }
    });

    console.log(`📊 Loaded ${teams.length} teams and ${venues.length} venues for lookup`);
    console.log("");

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const errors = [];

    console.log(
      "================================================================================"
    );
    console.log("📋 Processing matches...");
    console.log(
      "================================================================================"
    );
    console.log("");

    for (let i = 0; i < apiFixtures.length; i++) {
      const fixture = apiFixtures[i];
      const matchNum = i + 1;

      try {
        const fixtureData = fixture.fixture;
        const teamsData = fixture.teams;
        const leagueData = fixture.league;
        const venueData = fixture.venue;

        // Get teams
        const homeTeamApiId = teamsData.home.id;
        const awayTeamApiId = teamsData.away.id;

        const homeTeam = teamMapByApiId.get(homeTeamApiId);
        const awayTeam = teamMapByApiId.get(awayTeamApiId);

        if (!homeTeam || !awayTeam) {
          console.log(
            `[${matchNum}/${apiFixtures.length}] ⚠️  Skipping: Teams not found in DB`
          );
          console.log(
            `   Home: ${teamsData.home.name} (API ID: ${homeTeamApiId})`
          );
          console.log(
            `   Away: ${teamsData.away.name} (API ID: ${awayTeamApiId})`
          );
          skippedCount++;
          continue;
        }

        // Get venue
        let venue = null;
        if (venueData && venueData.id) {
          venue = venueMapByApiId.get(venueData.id);
        }

        // If venue not found, try to get from home team
        if (!venue && homeTeam.venueId) {
          const homeTeamVenue = await Venue.findById(homeTeam.venueId).lean();
          if (homeTeamVenue) {
            venue = homeTeamVenue;
          }
        }

        if (!venue) {
          console.log(
            `[${matchNum}/${apiFixtures.length}] ⚠️  Skipping: Venue not found`
          );
          skippedCount++;
          continue;
        }

        // Parse date
        const date = new Date(fixtureData.date);
        if (isNaN(date.getTime())) {
          console.log(
            `[${matchNum}/${apiFixtures.length}] ⚠️  Skipping: Invalid date`
          );
          skippedCount++;
          continue;
        }

        // Filter: Only matches from December 2025 onwards
        const minDate = new Date("2025-12-01T00:00:00Z");
        if (date < minDate) {
          skippedCount++;
          continue;
        }

        // Generate slug
        const slug = generateSlug(homeTeam.slug, awayTeam.slug, date);

        // Check if match already exists
        const existingMatch = await FootballEvent.findOne({ slug });

        // Prepare match data
        const matchData = {
          date: date,
          status: fixtureData.status?.short || "NS",
          league: league._id,
          homeTeam: homeTeam._id,
          awayTeam: awayTeam._id,
          venue: venue._id,
          round: leagueData.round || null,
          roundNumber: null,
          slug: slug,
          tags: ["Serie A", CURRENT_SEASON.toString()],
          externalIds: {
            apiFootball: fixtureData.id,
          },
          minPrice: null,
        };

        if (existingMatch) {
          // Update existing match
          const updateData = {};

          // Update external ID if missing
          if (
            fixtureData.id &&
            !existingMatch.externalIds?.apiFootball
          ) {
            updateData["externalIds.apiFootball"] = fixtureData.id;
          }

          // Update status if changed
          if (fixtureData.status?.short) {
            updateData.status = fixtureData.status.short;
          }

          // Update date if changed
          if (date.getTime() !== existingMatch.date.getTime()) {
            updateData.date = date;
          }

          if (Object.keys(updateData).length > 0) {
            await FootballEvent.findByIdAndUpdate(
              existingMatch._id,
              updateData,
              { new: true }
            );
            console.log(
              `[${matchNum}/${apiFixtures.length}] 🔄 Updated: ${
                homeTeam.name_en || homeTeam.name
              } vs ${awayTeam.name_en || awayTeam.name} (${
                date.toISOString().split("T")[0]
              })`
            );
            updatedCount++;
          } else {
            console.log(
              `[${matchNum}/${apiFixtures.length}] ⏭️  Skipped: ${
                homeTeam.name_en || homeTeam.name
              } vs ${awayTeam.name_en || awayTeam.name} (${
                date.toISOString().split("T")[0]
              }) - No changes needed`
            );
            skippedCount++;
          }
        } else {
          // Create new match
          const newMatch = new FootballEvent(matchData);
          await newMatch.save();
          console.log(
            `[${matchNum}/${apiFixtures.length}] ✅ Created: ${
              homeTeam.name_en || homeTeam.name
            } vs ${awayTeam.name_en || awayTeam.name} (${
              date.toISOString().split("T")[0]
            })`
          );
          createdCount++;
        }
      } catch (error) {
        const errorMsg = `Error processing match ${i + 1}: ${error.message}`;
        console.error(`[${matchNum}/${apiFixtures.length}] ❌ ${errorMsg}`);
        errors.push({
          matchIndex: i + 1,
          error: error.message,
        });
        skippedCount++;
      }
    }

    console.log("");
    console.log(
      "================================================================================"
    );
    console.log("📊 SUMMARY");
    console.log(
      "================================================================================"
    );
    console.log(`✅ Created: ${createdCount} matches`);
    console.log(`🔄 Updated: ${updatedCount} matches`);
    console.log(`⏭️  Skipped: ${skippedCount} matches`);
    if (errors.length > 0) {
      console.log(`❌ Errors: ${errors.length}`);
      console.log("\nError details:");
      errors.slice(0, 10).forEach((err) => {
        console.log(`   Match ${err.matchIndex}: ${err.error}`);
      });
    }
    console.log("");

    // Verification
    console.log(
      "================================================================================"
    );
    console.log("🔍 VERIFICATION");
    console.log(
      "================================================================================"
    );
    console.log("");

    const totalMatches = await FootballEvent.countDocuments({
      league: league._id,
    });
    console.log(`📊 Total Serie A matches in DB: ${totalMatches}`);

    const matchesWithApiFootball = await FootballEvent.countDocuments({
      league: league._id,
      "externalIds.apiFootball": { $exists: true, $ne: null },
    });
    console.log(`📊 Matches with API-Football ID: ${matchesWithApiFootball}`);

    console.log("");

    return {
      created: createdCount,
      updated: updatedCount,
      skipped: skippedCount,
      errors: errors.length,
    };
  } catch (error) {
    console.error("❌ Error creating matches:", error.message);
    throw error;
  }
}

// Main function
async function main() {
  try {
    // Connect to database
    console.log("🔌 Connecting to database...");
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error("❌ MONGODB_URI not found in environment variables");
      process.exit(1);
    }

    const connected = await databaseConnection.connect(mongoUri);
    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }
    console.log("✅ Connected to database");
    console.log("");

    // Find the league
    const league = await League.findOne({
      $or: [
        { slug: "serie-a" },
        { "externalIds.apiFootball": SERIEA_API_FOOTBALL_ID },
      ],
    });

    if (!league) {
      console.log("❌ Serie A not found in database");
      console.log("   Please run create_seriea_league.js first");
      await databaseConnection.disconnect();
      process.exit(1);
    }

    console.log(`✅ Found league: ${league.name} (${league.nameHe || "N/A"})`);
    console.log("");

    // Get all teams for this league
    const teams = await Team.find({ leagueIds: league._id }).lean();
    console.log(`✅ Loaded ${teams.length} teams for Serie A`);
    console.log("");

    if (teams.length === 0) {
      console.log("❌ No teams found for Serie A");
      console.log("   Please run create_seriea_teams.js first");
      await databaseConnection.disconnect();
      process.exit(1);
    }

    // Get all venues (we'll match them by API ID)
    const venues = await Venue.find({}).lean();
    console.log(`✅ Loaded ${venues.length} venues for lookup`);
    console.log("");

    // Step 1: Fetch matches from API
    const apiFixtures = await fetchMatchesFromAPI();

    if (apiFixtures.length === 0) {
      console.log("❌ No fixtures found in API response");
      await databaseConnection.disconnect();
      process.exit(0);
    }

    // Step 2: Create matches
    const result = await createMatches(apiFixtures, league, teams, venues);

    // Disconnect from database
    await databaseConnection.disconnect();
    console.log("✅ Disconnected from database");
    console.log("");

    console.log("🎉 Script completed successfully!");
    console.log("");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    if (databaseConnection.isDatabaseConnected()) {
      await databaseConnection.disconnect();
    }
    process.exit(1);
  }
}

// Run the script
main();

