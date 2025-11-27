import "dotenv/config";
import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// API Configuration
const API_KEY = process.env.HELLO_TICETS_API_KEY || "pub-6a76dc10-12e5-466e-83d5-35b745c485a2";
const API_URL = "https://api-live.hellotickets.com/v1";

// UEFA Champions League performer ID
const CHAMPIONS_LEAGUE_PERFORMER_ID = "12872";
const CHAMPIONS_LEAGUE_NAME = "UEFA Champions League";

// Output path
const OUTPUT_PATH = path.resolve(
  __dirname,
  "../data/champions_league_all_matches_hellotickets.json"
);

async function fetchAllPerformances() {
  try {
    console.log(`\n🔍 Fetching all performances for ${CHAMPIONS_LEAGUE_NAME} (ID: ${CHAMPIONS_LEAGUE_PERFORMER_ID})...\n`);

    let allPerformances = [];
    let page = 1;
    let totalPages = 1;

    do {
      const params = {
        performer_id: CHAMPIONS_LEAGUE_PERFORMER_ID,
        category_id: 1, // Sports
        page: page,
        limit: 100,
        is_sellable: true,
      };

      console.log(`📄 Fetching page ${page}...`);

      const { data } = await axios.get(`${API_URL}/performances`, {
        params,
        headers: {
          Accept: "application/json",
          "X-Public-Key": API_KEY,
        },
      });

      if (page === 1) {
        console.log(`   ✅ Found ${data.total_count} total performances`);
        totalPages = Math.ceil(data.total_count / data.per_page);
        console.log(`   📊 Total pages: ${totalPages}\n`);
      }

      if (data.performances && data.performances.length > 0) {
        allPerformances = allPerformances.concat(data.performances);
        console.log(`   ✅ Fetched ${data.performances.length} performances (${allPerformances.length} total so far)`);
      }

      page++;
    } while (page <= totalPages);

    return allPerformances;
  } catch (error) {
    console.error(
      `❌ Error fetching performances for ${CHAMPIONS_LEAGUE_NAME}:`,
      error.response ? error.response.data : error.message
    );
    throw error;
  }
}

async function saveToFile(performances) {
  const data = {
    performer_id: CHAMPIONS_LEAGUE_PERFORMER_ID,
    performer_name: CHAMPIONS_LEAGUE_NAME,
    fetched_at: new Date().toISOString(),
    total_count: performances.length,
    performances: performances,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2), "utf8");
  console.log(`\n✅ Saved ${performances.length} performances to: ${OUTPUT_PATH}`);
  
  // Print summary
  console.log("\n📊 Summary:");
  console.log(`   Total matches: ${performances.length}`);
  
  // Count unique teams
  const teams = new Set();
  performances.forEach(perf => {
    if (perf.performers) {
      perf.performers.forEach(p => {
        // Don't count the Champions League performer itself
        if (p.id.toString() !== CHAMPIONS_LEAGUE_PERFORMER_ID) {
          teams.add(`${p.id}:${p.name}`);
        }
      });
    }
  });
  console.log(`   Unique teams: ${teams.size}`);
  
  // Show date range
  if (performances.length > 0) {
    const dates = performances
      .map(p => p.start_date?.date_time)
      .filter(Boolean)
      .sort();
    if (dates.length > 0) {
      console.log(`   Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
    }
  }
}

async function run() {
  try {
    console.log("=".repeat(60));
    console.log("📥 Fetching Champions League matches from Hello Tickets");
    console.log("=".repeat(60));

    const performances = await fetchAllPerformances();

    if (performances.length === 0) {
      console.log("\n⚠️  No performances found");
      return;
    }

    await saveToFile(performances);

    console.log("\n" + "=".repeat(60));
    console.log("✅ Done!");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    if (error.response) {
      console.error("Response data:", JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

run();




