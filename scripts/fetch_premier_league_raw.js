import "dotenv/config";
import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// API Configuration
const API_KEY = "pub-6a76dc10-12e5-466e-83d5-35b745c485a2";
const API_URL = "https://api-live.hellotickets.com/v1";

// Champions League Performer ID
const CHAMPIONS_LEAGUE_PERFORMER_ID = "12872";

// Output path
const OUTPUT_DIR = path.resolve(__dirname, "../data/hellotickets");
const OUTPUT_FILE = path.resolve(
  OUTPUT_DIR,
  "champions_league_raw_response.json"
);

async function fetchChampionsLeagueMatches() {
  try {
    console.log(
      `🔍 Fetching Champions League matches from HelloTickets API...`
    );
    console.log(`   Performer ID: ${CHAMPIONS_LEAGUE_PERFORMER_ID}`);

    const response = await axios.get(`${API_URL}/performances`, {
      params: {
        performer_id: CHAMPIONS_LEAGUE_PERFORMER_ID,
        category_id: 1, // Sports
        limit: 100,
        page: 1,
        is_sellable: true,
      },
      headers: {
        Accept: "application/json",
        "X-Public-Key": API_KEY,
      },
    });

    // Save raw response exactly as received
    const rawData = {
      fetched_at: new Date().toISOString(),
      performer_id: CHAMPIONS_LEAGUE_PERFORMER_ID,
      competition: "Champions League",
      api_response: response.data, // Save the exact response from API
    };

    // Ensure directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Save to file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(rawData, null, 2), "utf8");

    console.log(`\n✅ Successfully saved raw response!`);
    console.log(`   📁 Location: ${OUTPUT_FILE}`);
    console.log(
      `   📊 Total performances: ${response.data?.performances?.length || 0}`
    );

    return rawData;
  } catch (error) {
    console.error("❌ Error fetching data:", error.message);
    if (error.response) {
      console.error("   Response status:", error.response.status);
      console.error("   Response data:", error.response.data);
    }
    throw error;
  }
}

fetchChampionsLeagueMatches();
