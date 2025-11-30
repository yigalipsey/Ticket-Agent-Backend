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
      `[CHECKPOINT ${apiCallCount}] API Call #${apiCallCount}: ${config.method.toUpperCase()} ${config.url}`
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

// League configuration
const LEAGUE_ID = 78; // Bundesliga
const CURRENT_SEASON = new Date().getFullYear(); // Current year

// Paths
const OUTPUT_DIR = path.resolve(__dirname, "../data/footballapi");
const OUTPUT_FILE = path.resolve(
  OUTPUT_DIR,
  `bundesliga_stadiums.json`
);

async function fetchBundesligaStadiums() {
  try {
    console.log("=".repeat(80));
    console.log(
      `🔍 Fetching stadiums for Bundesliga (League ID ${LEAGUE_ID}, Season ${CURRENT_SEASON})`
    );
    console.log("=".repeat(80));
    console.log("");

    // Reset API call counter
    apiCallCount = 0;

    console.log(
      `[CHECKPOINT 0] Starting to fetch teams for Bundesliga (season ${CURRENT_SEASON})...\n`
    );

    // Fetch all teams for the league
    const response = await apiClient.get("/teams", {
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
      console.log("❌ No teams found in API response");
      return [];
    }

    console.log(
      `\n✅ Received ${response.data.response.length} teams from API`
    );
    console.log("");

    // Extract venues from teams
    const venuesMap = new Map();
    
    response.data.response.forEach((item) => {
      const team = item.team;
      const venue = item.venue;
      
      if (venue && venue.id) {
        // Use venue ID as key to avoid duplicates
        if (!venuesMap.has(venue.id)) {
          venuesMap.set(venue.id, {
            id: venue.id,
            name: venue.name || null,
            address: venue.address || null,
            city: venue.city || null,
            capacity: venue.capacity || null,
            surface: venue.surface || null,
            image: venue.image || null,
            // Store which teams use this venue
            teams: [],
          });
        }
        
        // Add team to venue's teams list
        const venueData = venuesMap.get(venue.id);
        if (team && team.id) {
          venueData.teams.push({
            id: team.id,
            name: team.name,
            logo: team.logo,
          });
        }
      }
    });

    // Convert map to array
    const stadiums = Array.from(venuesMap.values());

    // Sort by name
    stadiums.sort((a, b) => {
      const nameA = a.name || "";
      const nameB = b.name || "";
      return nameA.localeCompare(nameB);
    });

    console.log(
      `📊 Found ${stadiums.length} unique stadiums from ${response.data.response.length} teams\n`
    );

    // Prepare output data
    const outputData = {
      fetched_at: new Date().toISOString(),
      league_id: LEAGUE_ID,
      league_name: "Bundesliga",
      season: CURRENT_SEASON,
      total_stadiums: stadiums.length,
      total_teams: response.data.response.length,
      api_calls_made: apiCallCount,
      fetched_in_single_call: apiCallCount === 1,
      stadiums: stadiums,
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
    console.log(`✅ Total stadiums: ${stadiums.length}`);
    console.log(`✅ Total teams: ${response.data.response.length}`);
    console.log(`✅ API calls made: ${apiCallCount}`);
    console.log(
      `✅ Fetched in single call: ${apiCallCount === 1 ? "YES ✅" : "NO ❌"}`
    );
    console.log(`✅ Saved to: ${OUTPUT_FILE}\n`);

    // Display all stadiums
    console.log("🏟️  Bundesliga Stadiums:\n");
    stadiums.forEach((stadium, idx) => {
      console.log(`${idx + 1}. ${stadium.name || "N/A"}`);
      console.log(`   ID: ${stadium.id}`);
      console.log(`   City: ${stadium.city || "N/A"}`);
      console.log(`   Capacity: ${stadium.capacity || "N/A"}`);
      console.log(`   Teams: ${stadium.teams.map(t => t.name).join(", ") || "N/A"}`);
      console.log("");
    });

    console.log("=".repeat(80));
    console.log("✅ Done!");
    console.log("=".repeat(80));

    return stadiums;
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

fetchBundesligaStadiums();




