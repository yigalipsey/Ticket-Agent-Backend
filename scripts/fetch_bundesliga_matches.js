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

// Affiliate parameters
const AFFILIATE_PARAMS = "?tap_a=141252-18675a&tap_s=8995852-00a564";

// Paths
const BUNDESLIGA_TEAMS_PATH = path.resolve(
  __dirname,
  "../data/dataFromMongo/bundesliga.json"
);
const OUTPUT_DIR = path.resolve(__dirname, "../data/hellotickets");
const OUTPUT_FILE = path.resolve(
  OUTPUT_DIR,
  "bundesliga_matches_hellotickets.json"
);

function addAffiliateLink(originalUrl) {
  if (!originalUrl) return null;
  const separator = originalUrl.includes("?") ? "&" : "?";
  return `${originalUrl}${separator}${AFFILIATE_PARAMS.substring(1)}`;
}

function loadBundesligaTeams() {
  const data = JSON.parse(fs.readFileSync(BUNDESLIGA_TEAMS_PATH, "utf8"));
  return data.map((team) => ({
    id: team._id,
    slug: team.slug,
    name: team.name,
    hellotickets_id: team.hellotickets_id,
    hellotickets_name: team.hellotickets_name,
  }));
}

async function fetchAllPerformances(performerId, performerName) {
  try {
    let allPerformances = [];
    let page = 1;
    let totalPages = 1;

    do {
      const params = {
        performer_id: performerId,
        category_id: 1, // Sports
        page: page,
        limit: 100,
        // No is_sellable filter
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
      }

      if (data.performances && data.performances.length > 0) {
        allPerformances = allPerformances.concat(data.performances);
      }

      page++;
    } while (page <= totalPages);

    return allPerformances;
  } catch (error) {
    console.error(
      `❌ Error fetching performances for ${performerName}:`,
      error.response ? error.response.data : error.message
    );
    throw error;
  }
}

function isBundesligaMatch(perf, bundesligaTeamIds) {
  const perfDate = new Date(perf.start_date?.date_time);
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);

  // Filter: only future matches (from next week)
  if (perfDate < nextWeek) return false;

  // Filter: exclude European competitions and cup
  const name = perf.name.toLowerCase();
  const isEuropean =
    name.includes("champions league") ||
    name.includes("europa league") ||
    name.includes("uefa") ||
    name.includes("conference league");
  const isCup =
    name.includes("dfb pokal") ||
    name.includes("pokal") ||
    name.includes("cup") ||
    name.includes("supercup");

  if (isEuropean || isCup) return false;

  // Filter: must have exactly 2 performers, both Bundesliga teams
  const performers = perf.performers || [];
  if (performers.length !== 2) return false;

  const performerIds = performers.map((p) => p.id?.toString());
  const bothBundesliga = performerIds.every((id) => bundesligaTeamIds.has(id));

  return bothBundesliga;
}

async function run() {
  try {
    console.log(
      "================================================================================"
    );
    console.log("🔍 Fetching ALL Bundesliga matches for the upcoming season");
    console.log(
      "================================================================================"
    );

    // Load Bundesliga teams
    const teams = loadBundesligaTeams();
    console.log(`\n📋 Loaded ${teams.length} Bundesliga teams\n`);

    // Create map of HelloTickets IDs
    const bundesligaTeamIds = new Set(
      teams.map((t) => t.hellotickets_id).filter(Boolean)
    );

    // Create map for quick lookup
    const htIdToTeam = new Map();
    teams.forEach((team) => {
      if (team.hellotickets_id) {
        htIdToTeam.set(team.hellotickets_id, team);
      }
    });

    // Fetch all matches for all teams
    const allMatches = new Map(); // Use Map to avoid duplicates (key: performance ID)

    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      if (!team.hellotickets_id) {
        console.log(`⏭️  Skipping ${team.name} - No HelloTickets ID`);
        continue;
      }

      console.log(
        `[${i + 1}/${teams.length}] Fetching matches for ${
          team.hellotickets_name
        } (${team.hellotickets_id})...`
      );

      try {
        const performances = await fetchAllPerformances(
          team.hellotickets_id,
          team.hellotickets_name
        );

        // Filter and process matches
        performances.forEach((perf) => {
          if (isBundesligaMatch(perf, bundesligaTeamIds)) {
            const perfId = perf.id.toString();

            // Only add if not already in map (avoid duplicates)
            if (!allMatches.has(perfId)) {
              // Extract team information
              const performers = perf.performers || [];
              const team1 = performers[0];
              const team2 = performers[1];

              const team1Data = htIdToTeam.get(team1.id?.toString());
              const team2Data = htIdToTeam.get(team2.id?.toString());

              // Determine home/away (first performer is usually home)
              const homeTeam = team1Data || {
                id: null,
                slug: null,
                name: team1.name,
                hellotickets_id: team1.id?.toString(),
                hellotickets_name: team1.name,
              };
              const awayTeam = team2Data || {
                id: null,
                slug: null,
                name: team2.name,
                hellotickets_id: team2.id?.toString(),
                hellotickets_name: team2.name,
              };

              allMatches.set(perfId, {
                htPerformanceId: perfId,
                htEventName: perf.name,
                dateTime: perf.start_date?.date_time,
                venue: perf.venue?.name || null,
                homeTeam: {
                  id: homeTeam.id,
                  slug: homeTeam.slug,
                  name: homeTeam.name,
                  hellotickets_id: homeTeam.hellotickets_id,
                  hellotickets_name: homeTeam.hellotickets_name,
                },
                awayTeam: {
                  id: awayTeam.id,
                  slug: awayTeam.slug,
                  name: awayTeam.name,
                  hellotickets_id: awayTeam.hellotickets_id,
                  hellotickets_name: awayTeam.hellotickets_name,
                },
                priceRange: {
                  min_price: perf.price_range?.min_price || null,
                  max_price: perf.price_range?.max_price || null,
                  currency: perf.price_range?.currency || "EUR",
                },
                url: perf.url || null,
                affiliateUrl: addAffiliateLink(perf.url),
              });
            }
          }
        });

        console.log(
          `   ✅ Found ${performances.length} total matches, ${allMatches.size} unique Bundesliga matches so far\n`
        );
      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        continue;
      }
    }

    // Convert to array and sort by date
    const matchesArray = Array.from(allMatches.values()).sort(
      (a, b) => new Date(a.dateTime) - new Date(b.dateTime)
    );

    // Prepare output data
    const outputData = {
      fetched_at: new Date().toISOString(),
      league: "Bundesliga",
      total_teams: teams.length,
      total_matches: matchesArray.length,
      matches: matchesArray,
    };

    // Save to file
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(outputData, null, 2), "utf8");

    console.log(
      "\n================================================================================"
    );
    console.log("📊 SUMMARY");
    console.log(
      "================================================================================"
    );
    console.log(`✅ Total unique Bundesliga matches: ${matchesArray.length}`);
    console.log(`✅ Saved to: ${OUTPUT_FILE}\n`);

    // Display sample matches
    console.log("📋 Sample matches (first 10):\n");
    matchesArray.slice(0, 10).forEach((match, idx) => {
      console.log(
        `${idx + 1}. ${match.homeTeam.hellotickets_name} vs ${
          match.awayTeam.hellotickets_name
        }`
      );
      console.log(`   Date: ${match.dateTime}`);
      console.log(`   HT Performance ID: ${match.htPerformanceId}`);
      console.log(
        `   Price: ${match.priceRange.min_price || "N/A"} ${
          match.priceRange.currency
        }`
      );
      console.log(`   URL: ${match.url || "N/A"}`);
      console.log("");
    });

    console.log(
      "================================================================================"
    );
    console.log("✅ Done!");
    console.log(
      "================================================================================"
    );
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    if (error.response) {
      console.error(
        "Response data:",
        JSON.stringify(error.response.data, null, 2)
      );
    }
    process.exit(1);
  }
}

run();


