import "dotenv/config";
import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Bundesliga configuration
const BUNDESLIGA_LEAGUE_ID = 78; // API-Football league ID for Bundesliga
const CURRENT_SEASON = 2025;

// Paths
const OUTPUT_DIR = path.resolve(__dirname, "../data/footballapi");
const OUTPUT_FILE = path.resolve(OUTPUT_DIR, "bundesliga_matches.json");

// Calculate next week date
function getNextWeekDate() {
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  return nextWeek;
}

// Format date for API (YYYY-MM-DD)
function formatDateForAPI(date) {
  return date.toISOString().split("T")[0];
}

async function fetchBundesligaMatches() {
  try {
    console.log(
      "================================================================================"
    );
    console.log(
      "🔍 Fetching Bundesliga matches from API-Football (from next week)"
    );
    console.log(
      "================================================================================"
    );

    const nextWeek = getNextWeekDate();
    const nextWeekStr = formatDateForAPI(nextWeek);
    console.log(`\n📅 Fetching matches from: ${nextWeekStr} onwards\n`);

    // Fetch fixtures from next week
    // Try with 'from' parameter first
    let response;
    try {
      response = await apiClient.get("/fixtures", {
        params: {
          league: BUNDESLIGA_LEAGUE_ID,
          season: CURRENT_SEASON,
          from: nextWeekStr,
        },
      });
    } catch (error) {
      console.log(
        "⚠️  Error with 'from' parameter, trying without date filter...\n"
      );
      // If that fails, fetch all matches for the season and filter locally
      response = await apiClient.get("/fixtures", {
        params: {
          league: BUNDESLIGA_LEAGUE_ID,
          season: CURRENT_SEASON,
        },
      });
    }

    if (
      !response.data ||
      !response.data.response ||
      response.data.response.length === 0
    ) {
      console.log("❌ No matches found in API response");
      return [];
    }

    let fixtures = response.data.response || [];

    // Filter matches from next week onwards
    if (fixtures.length > 0) {
      const nextWeekTimestamp = nextWeek.getTime();
      fixtures = fixtures.filter((fixture) => {
        const fixtureDate = new Date(fixture.fixture?.date);
        return fixtureDate && fixtureDate.getTime() >= nextWeekTimestamp;
      });
    }

    console.log(
      `✅ Found ${fixtures.length} Bundesliga matches from next week\n`
    );

    // Transform fixtures to our format
    const matches = fixtures.map((fixture) => {
      const homeTeam = fixture.teams?.home;
      const awayTeam = fixture.teams?.away;
      const fixtureData = fixture.fixture;
      const league = fixture.league;
      const score = fixture.score;

      return {
        apiFootballId: fixtureData.id,
        date: fixtureData.date,
        timezone: fixtureData.timezone,
        venue: {
          id: fixtureData.venue?.id || null,
          name: fixtureData.venue?.name || null,
          city: fixtureData.venue?.city || null,
        },
        status: {
          long: fixtureData.status?.long || null,
          short: fixtureData.status?.short || null,
          elapsed: fixtureData.status?.elapsed || null,
        },
        homeTeam: {
          id: homeTeam?.id || null,
          name: homeTeam?.name || null,
          logo: homeTeam?.logo || null,
        },
        awayTeam: {
          id: awayTeam?.id || null,
          name: awayTeam?.name || null,
          logo: awayTeam?.logo || null,
        },
        score: {
          fulltime: {
            home: score?.fulltime?.home || null,
            away: score?.fulltime?.away || null,
          },
          halftime: {
            home: score?.halftime?.home || null,
            away: score?.halftime?.away || null,
          },
        },
        league: {
          id: league?.id || null,
          name: league?.name || null,
          country: league?.country || null,
          logo: league?.logo || null,
          flag: league?.flag || null,
          season: league?.season || null,
          round: league?.round || null,
        },
      };
    });

    // Sort by date
    matches.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Prepare output data
    const outputData = {
      fetched_at: new Date().toISOString(),
      league: "Bundesliga",
      league_id: BUNDESLIGA_LEAGUE_ID,
      season: CURRENT_SEASON,
      from_date: nextWeekStr,
      total_matches: matches.length,
      matches: matches,
    };

    // Create directory if it doesn't exist
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      console.log(`✅ Created directory: ${OUTPUT_DIR}\n`);
    }

    // Save to file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(outputData, null, 2), "utf8");

    console.log(
      "================================================================================"
    );
    console.log("📊 SUMMARY");
    console.log(
      "================================================================================"
    );
    console.log(`✅ Total matches: ${matches.length}`);
    console.log(`✅ Saved to: ${OUTPUT_FILE}\n`);

    // Display sample matches
    console.log("📋 Sample matches (first 10):\n");
    matches.slice(0, 10).forEach((match, idx) => {
      const matchDate = new Date(match.date).toISOString().split("T")[0];
      const matchTime = new Date(match.date)
        .toISOString()
        .split("T")[1]
        .substring(0, 5);
      console.log(
        `${idx + 1}. ${match.homeTeam.name} vs ${match.awayTeam.name}`
      );
      console.log(`   Date: ${matchDate} ${matchTime}`);
      console.log(`   API-Football ID: ${match.apiFootballId}`);
      console.log(
        `   Venue: ${match.venue.name || "N/A"} (${match.venue.city || "N/A"})`
      );
      console.log(`   Round: ${match.league.round || "N/A"}`);
      console.log("");
    });

    console.log(
      "================================================================================"
    );
    console.log("✅ Done!");
    console.log(
      "================================================================================"
    );

    return matches;
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error(
        "Response data:",
        JSON.stringify(error.response.data, null, 2)
      );
    }
    throw error;
  }
}

fetchBundesligaMatches();
