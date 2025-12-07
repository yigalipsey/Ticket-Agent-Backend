import "dotenv/config";
import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// API Configuration
const API_KEY =
  process.env.HELLO_TICETS_API_KEY ||
  "pub-6a76dc10-12e5-466e-83d5-35b745c485a2";
const API_URL = "https://api-live.hellotickets.com/v1";

// Bayern Munich HelloTickets ID
const BAYERN_MUNICH_ID = 273;

async function fetchAllPerformances(performerId, performerName) {
  try {
    console.log(`\n[CHECKPOINT 1] Starting to fetch performances for ${performerName} (ID: ${performerId})`);
    
    let allPerformances = [];
    let page = 1;
    let totalPages = 1;

    do {
      console.log(`[CHECKPOINT 2] Fetching page ${page}...`);
      
      const params = {
        performer_id: performerId,
        category_id: 1, // Sports category
        page: page,
        limit: 100,
      };

      const { data } = await axios.get(`${API_URL}/performances`, {
        params,
        headers: {
          Accept: "application/json",
          "X-Public-Key": API_KEY,
        },
      });

      if (page === 1) {
        totalPages = Math.ceil(
          (data.total_count || 0) / (data.per_page || 100)
        );
        console.log(`[CHECKPOINT 3] Total pages: ${totalPages}, Total count: ${data.total_count || 0}`);
      }

      if (data.performances && data.performances.length > 0) {
        allPerformances = allPerformances.concat(data.performances);
        console.log(`[CHECKPOINT 4] Page ${page}: Found ${data.performances.length} performances (Total so far: ${allPerformances.length})`);
      } else {
        console.log(`[CHECKPOINT 5] Page ${page}: No performances found`);
      }

      page++;
      
      // Small delay to avoid rate limiting
      if (page <= totalPages) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } while (page <= totalPages);

    console.log(`[CHECKPOINT 6] Completed fetching. Total performances: ${allPerformances.length}`);
    return allPerformances;
  } catch (error) {
    console.error(`[ERROR] Failed to fetch performances for ${performerName}:`, error.message);
    if (error.response) {
      console.error(`[ERROR] Response status: ${error.response.status}`);
      console.error(`[ERROR] Response data:`, error.response.data);
    }
    throw error;
  }
}

async function main() {
  try {
    console.log("=".repeat(60));
    console.log("Fetching Bayern Munich matches from HelloTickets");
    console.log("=".repeat(60));

    const performances = await fetchAllPerformances(BAYERN_MUNICH_ID, "FC Bayern Munich");

    // Prepare output data in the same format as the Arsenal example
    const outputData = {
      performances: performances,
      metadata: {
        performer_id: BAYERN_MUNICH_ID,
        performer_name: "FC Bayern Munich",
        total_count: performances.length,
        fetched_at: new Date().toISOString(),
      },
    };

    // Save to file
    const outputPath = path.join(
      __dirname,
      "../../data/hellotickets/bayern_munich_all_matches_api_response.json"
    );

    // Ensure directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), "utf-8");

    console.log("\n" + "=".repeat(60));
    console.log(`[SUCCESS] Saved ${performances.length} matches to:`);
    console.log(outputPath);
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\n[FATAL ERROR] Script failed:", error.message);
    process.exit(1);
  }
}

main();






