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

// Bayern Munich ID
const BAYERN_MUNICH_ID = "273";

// Output path
const OUTPUT_DIR = path.resolve(__dirname, "../data/hellotickets");
const OUTPUT_FILE = path.resolve(OUTPUT_DIR, "bayern_munich_all_matches.json");

async function fetchAllBayernMatches() {
  try {
    console.log("🔍 Fetching ALL Bayern Munich matches (without is_sellable filter)...\n");

    let allPerformances = [];
    let page = 1;
    let totalPages = 1;

    do {
      const response = await axios.get(`${API_URL}/performances`, {
        params: {
          performer_id: BAYERN_MUNICH_ID,
          category_id: 1, // Sports
          limit: 100,
          page: page,
        },
        headers: {
          Accept: "application/json",
          "X-Public-Key": API_KEY,
        },
      });

      if (page === 1) {
        totalPages = Math.ceil((response.data?.total_count || 0) / (response.data?.per_page || 100));
        console.log(`📊 Total matches: ${response.data?.total_count || 0}`);
        console.log(`📊 Total pages: ${totalPages}\n`);
      }

      if (response.data?.performances) {
        allPerformances = allPerformances.concat(response.data.performances);
        console.log(`📄 Fetched page ${page}/${totalPages}: ${response.data.performances.length} matches`);
      }

      page++;
    } while (page <= totalPages);

    console.log(`\n✅ Total fetched: ${allPerformances.length} matches\n`);

    // Extract all unique German team IDs from opponents
    const germanTeamIds = new Map();
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    // Filter for Bundesliga matches (exclude European competitions and cup)
    const bundesligaMatches = allPerformances.filter(perf => {
      const perfDate = new Date(perf.start_date?.date_time);
      if (perfDate < nextWeek) return false;
      
      const name = perf.name.toLowerCase();
      const isEuropean = name.includes('champions league') || 
                         name.includes('europa league') ||
                         name.includes('uefa');
      const isCup = name.includes('dfb pokal') || name.includes('pokal') || name.includes('cup');
      
      return !isEuropean && !isCup;
    });

    // Extract opponent teams
    bundesligaMatches.forEach(perf => {
      const teams = (perf.performers || []).filter(
        p => p.id?.toString() !== "12872" && p.id?.toString() !== BAYERN_MUNICH_ID
      );
      
      teams.forEach(team => {
        if (!germanTeamIds.has(team.id.toString())) {
          germanTeamIds.set(team.id.toString(), {
            id: team.id.toString(),
            name: team.name,
            matches: 0
          });
        }
        germanTeamIds.get(team.id.toString()).matches++;
      });
    });

    // Save to file
    const outputData = {
      fetched_at: new Date().toISOString(),
      performer_id: BAYERN_MUNICH_ID,
      performer_name: "FC Bayern Munich",
      total_matches: allPerformances.length,
      bundesliga_matches_from_next_week: bundesligaMatches.length,
      german_teams_found: Array.from(germanTeamIds.values()),
      all_matches: allPerformances,
    };

    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(outputData, null, 2), "utf8");

    console.log("=".repeat(80));
    console.log("📊 RESULTS");
    console.log("=".repeat(80));
    console.log(`\n✅ Saved ${allPerformances.length} matches to: ${OUTPUT_FILE}`);
    console.log(`\n📋 Bundesliga matches (from next week): ${bundesligaMatches.length}`);
    
    console.log(`\n🇩🇪 German team IDs found (${germanTeamIds.size} teams):\n`);
    Array.from(germanTeamIds.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((team, idx) => {
        console.log(`${idx + 1}. ${team.name} (ID: ${team.id}) - ${team.matches} match(es)`);
      });

    console.log(`\n📋 Sample Bundesliga matches:\n`);
    bundesligaMatches.slice(0, 10).forEach((perf, idx) => {
      const teams = (perf.performers || []).filter(
        p => p.id?.toString() !== "12872" && p.id?.toString() !== BAYERN_MUNICH_ID
      );
      const opponent = teams[0];
      console.log(`${idx + 1}. ${perf.name}`);
      console.log(`   Date: ${perf.start_date?.date_time}`);
      console.log(`   Opponent: ${opponent?.name} (ID: ${opponent?.id})`);
      console.log(`   Performance ID: ${perf.id}`);
      console.log("");
    });

  } catch (error) {
    console.error("❌ Error:", error.message);
    if (error.response) {
      console.error("Response:", error.response.data);
    }
    throw error;
  }
}

fetchAllBayernMatches();





