import "dotenv/config";
import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_URL = "https://api-live.hellotickets.com/v1";
const API_KEY =
  process.env.HELLO_TICETS_API_KEY ||
  "pub-6a76dc10-12e5-466e-83d5-35b745c485a2";

const OUTPUT_DIR = path.resolve(__dirname, "../data/hellotickets");
const OUTPUT_FILE = path.resolve(OUTPUT_DIR, "la_liga_raw_response.json");

const LA_LIGA_TEAMS = [
  { id: "598", name: "Real Madrid CF" },
  { id: "272", name: "FC Barcelona" },
  { id: "89", name: "Atletico de Madrid" },
  { id: "643", name: "Sevilla FC" },
  { id: "600", name: "Real Sociedad" },
  { id: "597", name: "Real Betis Balompie" },
  { id: "780", name: "Valencia CF" },
  { id: "83", name: "Athletic Club" },
  { id: "594", name: "RC Celta de Vigo" },
  { id: "296", name: "Getafe CF" },
  { id: "1861", name: "RCD Espanyol" },
  { id: "596", name: "RCD Mallorca" },
  { id: "227", name: "Deportivo Alaves" },
  { id: "302", name: "Girona FC" },
  { id: "769", name: "UD Las Palmas" },
  { id: "592", name: "Rayo Vallecano" },
  { id: "28699", name: "Elche CF" },
  { id: "28698", name: "Levante UD" },
  { id: "5976", name: "Villarreal CF" },
  { id: "3768", name: "CA Osasuna" },
];

async function fetchPerformancesForTeam(teamId, teamName) {
  let page = 1;
  let totalPages = 1;
  const performances = [];

  do {
    const params = {
      performer_id: teamId,
      category_id: 1, // Sports
      limit: 100,
      page,
    };

    const { data } = await axios.get(`${API_URL}/performances`, {
      params,
      headers: {
        Accept: "application/json",
        "X-Public-Key": API_KEY,
      },
    });

    if (page === 1) {
      totalPages = Math.ceil((data.total_count || 0) / (data.per_page || 100));
    }

    (data.performances || []).forEach((performance) => {
      performances.push({
        ...performance,
        _fetchedFromTeam: {
          id: teamId,
          name: teamName,
        },
      });
    });

    page++;
  } while (page <= totalPages);

  return performances;
}

async function run() {
  const aggregated = new Map();
  const errors = [];

  console.log("📥 Fetching La Liga matches from HelloTickets (per team)...");

  for (const team of LA_LIGA_TEAMS) {
    try {
      console.log(`   → ${team.name} (ID: ${team.id})`);
      const performances = await fetchPerformancesForTeam(team.id, team.name);
      console.log(`     ↳ ${performances.length} performances fetched`);

      for (const perf of performances) {
        const existing = aggregated.get(perf.id);
        if (existing) {
          existing._fetchedFromTeams.push(perf._fetchedFromTeam);
        } else {
          aggregated.set(perf.id, {
            ...perf,
            _fetchedFromTeams: [perf._fetchedFromTeam],
          });
        }
      }
    } catch (error) {
      console.error(`   ❌ Failed for ${team.name}: ${error.message}`);
      errors.push({
        teamId: team.id,
        teamName: team.name,
        message: error.message,
      });
    }
  }

  const performancesArray = Array.from(aggregated.values());

  const output = {
    fetched_at: new Date().toISOString(),
    competition: "La Liga",
    source: "team-aggregate",
    stats: {
      totalTeams: LA_LIGA_TEAMS.length,
      teamsSucceeded: LA_LIGA_TEAMS.length - errors.length,
      teamsFailed: errors.length,
      uniquePerformances: performancesArray.length,
    },
    performances: performancesArray,
    errors,
  };

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf8");

  console.log("\n✅ Finished collecting La Liga matches.");
  console.log(`   📁 Output file: ${OUTPUT_FILE}`);
  console.log(`   📊 Unique performances: ${performancesArray.length}`);
  if (errors.length > 0) {
    console.log(`   ⚠️ Teams with errors: ${errors.length}`);
  }
}

run().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});
