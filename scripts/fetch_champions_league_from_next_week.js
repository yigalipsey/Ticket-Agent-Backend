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

// Track API calls
let apiCallCount = 0;

// API Football client
const apiClient = axios.create({
  baseURL: API_FOOTBALL_BASE_URL,
  headers: {
    "x-rapidapi-key": API_FOOTBALL_KEY,
    "x-rapidapi-host": "v3.football.api-sports.io",
  },
  timeout: 30000,
});

// Interceptor to count API calls
apiClient.interceptors.request.use(
  (config) => {
    apiCallCount++;
    console.log(
      `[CHECKPOINT ${apiCallCount}] API Call #${apiCallCount}: ${config.method.toUpperCase()} ${
        config.url
      }`
    );
    if (config.params) {
      console.log(`   Parameters:`, config.params);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// League configuration - UEFA Champions League ID is 2
const LEAGUE_ID = 2; // UEFA Champions League
const CURRENT_SEASON = new Date().getFullYear(); // Current year

// Paths
const OUTPUT_DIR = path.resolve(__dirname, "../data/footballapi");
const OUTPUT_FILE = path.resolve(
  OUTPUT_DIR,
  `league_${LEAGUE_ID}_from_next_week.json`
);

// Calculate next week date
function getNextWeekDate() {
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  // Set to start of day
  nextWeek.setHours(0, 0, 0, 0);
  return nextWeek;
}

// Format date for API (YYYY-MM-DD)
function formatDateForAPI(date) {
  return date.toISOString().split("T")[0];
}

async function fetchMatches() {
  try {
    console.log("=".repeat(80));
    console.log(
      `🔍 Fetching matches for League ID ${LEAGUE_ID} (UEFA Champions League, Season ${CURRENT_SEASON})`
    );
    console.log("=".repeat(80));
    console.log("");

    const nextWeek = getNextWeekDate();
    const nextWeekStr = formatDateForAPI(nextWeek);
    console.log(`📅 Filter: Matches from ${nextWeekStr} onwards\n`);

    // Reset API call counter
    apiCallCount = 0;

    // Fetch all fixtures for the season
    console.log(
      `[CHECKPOINT 0] Starting to fetch all matches for season ${CURRENT_SEASON}...\n`
    );

    const response = await apiClient.get("/fixtures", {
      params: {
        league: LEAGUE_ID,
        season: CURRENT_SEASON,
      },
    });

    if (
      !response.data ||
      !response.data.response ||
      response.data.response.length === 0
    ) {
      console.log("❌ No matches found in API response");
      return [];
    }

    console.log(
      `\n✅ Received ${response.data.response.length} total matches from API`
    );
    console.log("");

    // Filter matches from next week onwards
    const nextWeekTimestamp = nextWeek.getTime();
    const filteredFixtures = response.data.response.filter((fixture) => {
      const fixtureDate = new Date(fixture.fixture?.date);
      return fixtureDate && fixtureDate.getTime() >= nextWeekTimestamp;
    });

    console.log(
      `📊 After filtering (from ${nextWeekStr}): ${filteredFixtures.length} matches\n`
    );

    // Transform fixtures to our format
    const matches = filteredFixtures.map((fixture) => {
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
      league_id: LEAGUE_ID,
      season: CURRENT_SEASON,
      from_date: nextWeekStr,
      total_matches: matches.length,
      api_calls_made: apiCallCount,
      fetched_in_single_call: apiCallCount === 1,
      matches: matches,
    };

    // Create directory if it doesn't exist
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      console.log(`✅ Created directory: ${OUTPUT_DIR}\n`);
    }

    // Save to file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(outputData, null, 2), "utf8");

    console.log("=".repeat(80));
    console.log("📊 SUMMARY");
    console.log("=".repeat(80));
    console.log(`✅ Total matches: ${matches.length}`);
    console.log(`✅ API calls made: ${apiCallCount}`);
    console.log(
      `✅ Fetched in single call: ${apiCallCount === 1 ? "YES ✅" : "NO ❌"}`
    );
    console.log(`✅ Saved to: ${OUTPUT_FILE}\n`);

    // Display sample matches
    if (matches.length > 0) {
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
          `   Venue: ${match.venue.name || "N/A"} (${
            match.venue.city || "N/A"
          })`
        );
        console.log(`   Round: ${match.league.round || "N/A"}`);
        console.log("");
      });
    }

    console.log("=".repeat(80));
    console.log("✅ Done!");
    console.log("=".repeat(80));

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

fetchMatches();



