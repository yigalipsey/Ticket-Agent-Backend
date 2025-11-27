import dotenv from "dotenv";
import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const API_KEY =
  process.env.HELLO_TICETS_API_KEY ||
  "pub-6a76dc10-12e5-466e-83d5-35b745c485a2";
const API_URL = "https://api-live.hellotickets.com/v1";

// January 2025 date range
const FROM_DATE = "2025-01-01T00:00:00Z";
const TO_DATE = "2025-01-31T23:59:59Z";

// Arsenal FC - Hello Tickets performer ID
// Source: https://docs-api.hellotickets.com/#introduction
const ARSENAL_PERFORMER_ID = "1835";
const ARSENAL_NAME = "Arsenal FC";

async function fetchPerformerPerformances(performerId, teamName) {
  try {
    console.log(
      `\n🔍 [${teamName}] Fetching performances for performer ${performerId}...`
    );

    let allPerformances = [];
    let page = 1;
    let totalPages = 1;

    do {
      const params = {
        performer_id: performerId,
        category_id: 1, // Sports
        page: page,
        limit: 100,
        is_sellable: true,
        from: FROM_DATE,
        to: TO_DATE,
      };

      const { data } = await axios.get(`${API_URL}/performances`, {
        params,
        headers: {
          Accept: "application/json",
          "X-Public-Key": API_KEY,
        },
      });

      if (page === 1) {
        console.log(
          `   ✅ Found ${data.total_count} total performances in January 2025.`
        );
        totalPages = Math.ceil(data.total_count / data.per_page);
      }

      allPerformances = allPerformances.concat(data.performances || []);
      console.log(
        `   📄 Fetched page ${page}/${totalPages} (${allPerformances.length} performances so far)`
      );
      page++;
    } while (page <= totalPages);

    return allPerformances;
  } catch (error) {
    console.error(
      `   ❌ Error fetching performances for ${teamName} (ID: ${performerId}):`,
      error.response ? error.response.data : error.message
    );
    return [];
  }
}

// Try to fetch all performances without performer_id (by category and date only)
async function fetchAllPerformancesByCategory() {
  try {
    console.log(
      "🔍 Attempting to fetch all performances by category (without performer_id)..."
    );

    let allPerformances = [];
    let page = 1;
    let totalPages = 1;

    do {
      const params = {
        category_id: 1, // Sports
        page: page,
        limit: 100,
        is_sellable: true,
        from: FROM_DATE,
        to: TO_DATE,
      };

      const { data } = await axios.get(`${API_URL}/performances`, {
        params,
        headers: {
          Accept: "application/json",
          "X-Public-Key": API_KEY,
        },
      });

      if (page === 1) {
        console.log(
          `   ✅ Found ${data.total_count} total performances in January 2025.`
        );
        totalPages = Math.ceil(data.total_count / data.per_page);
      }

      allPerformances = allPerformances.concat(data.performances || []);
      console.log(
        `   📄 Fetched page ${page}/${totalPages} (${allPerformances.length} performances so far)`
      );
      page++;
    } while (page <= totalPages);

    return allPerformances;
  } catch (error) {
    console.error(
      `   ❌ Error fetching all performances:`,
      error.response ? error.response.data : error.message
    );
    return null; // Return null to indicate this method doesn't work
  }
}

async function fetchAllPremierLeagueMatches() {
  try {
    console.log("🏆 Fetching Premier League matches from Hello Tickets API");
    console.log(`📅 Date range: ${FROM_DATE} to ${TO_DATE}\n`);

    // First, try to fetch all performances at once (without performer_id)
    console.log(
      "📋 Attempting method 1: Fetch all performances by category...\n"
    );
    const allPerformancesDirect = await fetchAllPerformancesByCategory();

    if (allPerformancesDirect && allPerformancesDirect.length > 0) {
      console.log(
        `\n✅ Success! Found ${allPerformancesDirect.length} performances using direct method.\n`
      );

      // Filter to Premier League teams only
      const premierLeaguePerformerIds = new Set(
        PREMIER_LEAGUE_TEAMS.map((t) => t.id)
      );
      const premierLeagueMatches = allPerformancesDirect.filter((perf) => {
        // Check if any performer in the performance matches our Premier League teams
        return perf.performers?.some((p) =>
          premierLeaguePerformerIds.has(String(p.id))
        );
      });

      console.log(
        `📊 Filtered to ${premierLeagueMatches.length} Premier League matches\n`
      );

      // Save results
      const outputDir = path.resolve(__dirname, "../data");
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const outputPath = path.resolve(
        outputDir,
        "premier_league_january_2025_matches.json"
      );
      const summaryPath = path.resolve(
        outputDir,
        "premier_league_january_2025_summary.json"
      );

      const result = {
        fetched_at: new Date().toISOString(),
        date_range: {
          from: FROM_DATE,
          to: TO_DATE,
        },
        method: "direct_category_fetch",
        total_matches: premierLeagueMatches.length,
        matches: premierLeagueMatches,
      };

      const summary = {
        fetched_at: new Date().toISOString(),
        date_range: {
          from: FROM_DATE,
          to: TO_DATE,
        },
        method: "direct_category_fetch",
        total_matches: premierLeagueMatches.length,
      };

      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
      fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

      console.log(`\n📊 ===== SUMMARY =====`);
      console.log(`Total matches found: ${premierLeagueMatches.length}`);
      console.log(`\n💾 Full data saved to: ${outputPath}`);
      console.log(`💾 Summary saved to: ${summaryPath}\n`);

      console.log("\n✅ Process completed successfully");
      process.exit(0);
      return;
    }

    // If direct method doesn't work, fall back to fetching by each team
    console.log(
      "\n⚠️  Direct method didn't work. Falling back to method 2: Fetch by each team...\n"
    );
    console.log(
      `📋 Processing ${PREMIER_LEAGUE_TEAMS.length} Premier League teams...\n`
    );

    // Fetch performances for all teams
    // Using Hello Tickets API: GET /v1/performances with performer_id parameter
    // Documentation: https://docs-api.hellotickets.com/#introduction
    const allMatches = [];
    const teamResults = {};

    for (const team of PREMIER_LEAGUE_TEAMS) {
      const performances = await fetchPerformerPerformances(team.id, team.name);

      if (performances.length > 0) {
        teamResults[team.name] = {
          performerId: team.id,
          count: performances.length,
          performances,
        };

        // Add team info to each performance
        performances.forEach((perf) => {
          allMatches.push({
            ...perf,
            teamName: team.name,
            performerId: team.id,
          });
        });
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Save results
    const outputDir = path.resolve(__dirname, "../data");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.resolve(
      outputDir,
      "premier_league_january_2025_matches.json"
    );
    const summaryPath = path.resolve(
      outputDir,
      "premier_league_january_2025_summary.json"
    );

    const result = {
      fetched_at: new Date().toISOString(),
      date_range: {
        from: FROM_DATE,
        to: TO_DATE,
      },
      method: "per_team_fetch",
      total_matches: allMatches.length,
      teams_processed: PREMIER_LEAGUE_TEAMS.length,
      teams_with_matches: Object.keys(teamResults).length,
      matches: allMatches,
    };

    const summary = {
      fetched_at: new Date().toISOString(),
      date_range: {
        from: FROM_DATE,
        to: TO_DATE,
      },
      method: "per_team_fetch",
      total_matches: allMatches.length,
      teams_processed: PREMIER_LEAGUE_TEAMS.length,
      teams_with_matches: Object.keys(teamResults).length,
      teams: Object.entries(teamResults).map(([name, data]) => ({
        teamName: name,
        performerId: data.performerId,
        matchCount: data.count,
      })),
    };

    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

    console.log(`\n\n📊 ===== SUMMARY =====`);
    console.log(`Total matches found: ${allMatches.length}`);
    console.log(`Teams with matches: ${Object.keys(teamResults).length}`);
    console.log(`\n💾 Full data saved to: ${outputPath}`);
    console.log(`💾 Summary saved to: ${summaryPath}\n`);

    // Print summary by team
    console.log("📋 Matches by team:");
    Object.entries(teamResults)
      .sort((a, b) => b[1].count - a[1].count)
      .forEach(([name, data]) => {
        console.log(`   ${name}: ${data.count} matches`);
      });

    console.log("\n✅ Process completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

fetchAllPremierLeagueMatches();
