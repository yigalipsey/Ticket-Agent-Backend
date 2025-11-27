import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import FootballEvent from "../src/models/FootballEvent.js";
import Team from "../src/models/Team.js";
import Venue from "../src/models/Venue.js";
import League from "../src/models/League.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to JSON file
const JSON_FILE = path.resolve(
  __dirname,
  "../data/footballapi/league_135_from_next_week.json"
);

// Helper function to format date for comparison (ignore milliseconds)
function normalizeDate(date) {
  if (!date) return null;
  const d = new Date(date);
  // Round to nearest minute
  d.setSeconds(0, 0);
  return d;
}

// Compare two dates (allow 1 minute difference)
function datesMatch(date1, date2) {
  if (!date1 || !date2) return false;
  const d1 = normalizeDate(date1);
  const d2 = normalizeDate(date2);
  const diff = Math.abs(d1.getTime() - d2.getTime());
  return diff < 60000; // 1 minute tolerance
}

// Format date for display
function formatDate(date) {
  if (!date) return "N/A";
  return new Date(date).toISOString().replace("T", " ").substring(0, 19);
}

async function verifyMatches() {
  try {
    console.log("=".repeat(80));
    console.log("🔍 Verifying Serie A matches from JSON file vs Database");
    console.log("=".repeat(80));
    console.log("");

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Find Serie A league
    const serieA = await League.findOne({
      $or: [{ slug: "serie-a" }, { name: /serie.?a/i }],
    });

    if (!serieA) {
      console.error("❌ Serie A not found in database");
      process.exit(1);
    }

    console.log(`✅ Found league: ${serieA.name} (ID: ${serieA._id})\n`);

    // Read JSON file
    if (!fs.existsSync(JSON_FILE)) {
      console.error(`❌ JSON file not found: ${JSON_FILE}`);
      console.error(`   Please run fetch_seriea_from_next_week.js first`);
      process.exit(1);
    }

    const jsonData = JSON.parse(fs.readFileSync(JSON_FILE, "utf8"));
    const jsonMatches = jsonData.matches || [];

    console.log(`📄 Loaded ${jsonMatches.length} matches from JSON file\n`);

    // Statistics
    const stats = {
      total: jsonMatches.length,
      found: 0,
      notFound: 0,
      perfectMatch: 0,
      dateMismatch: 0,
      homeTeamMismatch: 0,
      awayTeamMismatch: 0,
      venueMismatch: 0,
      reversed: 0,
      issues: [],
    };

    // Process each match
    for (let i = 0; i < jsonMatches.length; i++) {
      const jsonMatch = jsonMatches[i];
      const apiFootballId = jsonMatch.apiFootballId;

      console.log(
        `[CHECKPOINT ${i + 1}] Processing match ${i + 1}/${jsonMatches.length}: API ID ${apiFootballId}`
      );

      // Find match in database by API Football ID only
      const dbMatch = await FootballEvent.findOne({
        "externalIds.apiFootball": apiFootballId,
      })
        .populate("homeTeam", "name name_en apiFootballId")
        .populate("awayTeam", "name name_en apiFootballId")
        .populate("venue", "name_en name_he externalIds venueId")
        .lean();

      if (!dbMatch) {
        stats.notFound++;
        stats.issues.push({
          apiFootballId,
          issue: "NOT_FOUND",
          jsonMatch: {
            homeTeam: jsonMatch.homeTeam.name,
            awayTeam: jsonMatch.awayTeam.name,
            date: jsonMatch.date,
            venue: jsonMatch.venue.name,
          },
        });
        console.log(
          `   ❌ Match not found in database (${jsonMatch.homeTeam.name} vs ${jsonMatch.awayTeam.name})`
        );
        continue;
      }

      stats.found++;

      // Compare data
      const issues = [];
      let isReversed = false;

      // 1. Compare date/time
      const jsonDate = new Date(jsonMatch.date);
      const dbDate = new Date(dbMatch.date);
      if (!datesMatch(jsonDate, dbDate)) {
        issues.push({
          field: "date",
          json: formatDate(jsonDate),
          db: formatDate(dbDate),
        });
        stats.dateMismatch++;
      }

      // 2. Compare home team
      const jsonHomeTeamId = jsonMatch.homeTeam.id;
      const dbHomeTeamApiId =
        dbMatch.homeTeam?.apiFootballId ||
        dbMatch.homeTeam?.externalIds?.apiFootball;
      const dbAwayTeamApiId =
        dbMatch.awayTeam?.apiFootballId ||
        dbMatch.awayTeam?.externalIds?.apiFootball;

      // Check if reversed
      if (
        jsonHomeTeamId === dbAwayTeamApiId &&
        jsonMatch.awayTeam.id === dbHomeTeamApiId
      ) {
        isReversed = true;
        stats.reversed++;
        issues.push({
          field: "teams",
          issue: "REVERSED",
          json: {
            home: jsonMatch.homeTeam.name,
            away: jsonMatch.awayTeam.name,
          },
          db: {
            home:
              dbMatch.awayTeam?.name_en || dbMatch.awayTeam?.name || "N/A",
            away:
              dbMatch.homeTeam?.name_en || dbMatch.homeTeam?.name || "N/A",
          },
        });
      } else if (jsonHomeTeamId !== dbHomeTeamApiId) {
        issues.push({
          field: "homeTeam",
          json: `${jsonMatch.homeTeam.name} (ID: ${jsonHomeTeamId})`,
          db: `${dbMatch.homeTeam?.name_en || dbMatch.homeTeam?.name || "N/A"} (ID: ${dbHomeTeamApiId || "N/A"})`,
        });
        stats.homeTeamMismatch++;
      }

      // 3. Compare away team (only if not reversed)
      if (!isReversed) {
        const jsonAwayTeamId = jsonMatch.awayTeam.id;
        if (jsonAwayTeamId !== dbAwayTeamApiId) {
          issues.push({
            field: "awayTeam",
            json: `${jsonMatch.awayTeam.name} (ID: ${jsonAwayTeamId})`,
            db: `${dbMatch.awayTeam?.name_en || dbMatch.awayTeam?.name || "N/A"} (ID: ${dbAwayTeamApiId || "N/A"})`,
          });
          stats.awayTeamMismatch++;
        }
      }

      // 4. Compare venue
      const jsonVenueId = jsonMatch.venue.id;
      const dbVenueApiId =
        dbMatch.venue?.externalIds?.apiFootball || dbMatch.venue?.venueId;
      if (jsonVenueId && jsonVenueId !== dbVenueApiId) {
        issues.push({
          field: "venue",
          json: `${jsonMatch.venue.name} (ID: ${jsonVenueId})`,
          db: `${dbMatch.venue?.name_en || "N/A"} (ID: ${dbVenueApiId || "N/A"})`,
        });
        stats.venueMismatch++;
      }

      if (issues.length === 0) {
        stats.perfectMatch++;
        console.log(
          `   ✅ Perfect match: ${jsonMatch.homeTeam.name} vs ${jsonMatch.awayTeam.name}`
        );
      } else {
        stats.issues.push({
          apiFootballId,
          dbMatchId: dbMatch._id.toString(),
          slug: dbMatch.slug,
          issues,
          isReversed,
          jsonMatch: {
            homeTeam: jsonMatch.homeTeam.name,
            awayTeam: jsonMatch.awayTeam.name,
            date: jsonMatch.date,
            venue: jsonMatch.venue.name,
          },
          dbMatch: {
            homeTeam:
              dbMatch.homeTeam?.name_en || dbMatch.homeTeam?.name || "N/A",
            awayTeam:
              dbMatch.awayTeam?.name_en || dbMatch.awayTeam?.name || "N/A",
            date: dbMatch.date,
            venue: dbMatch.venue?.name_en || "N/A",
          },
        });
        console.log(`   ⚠️  Found ${issues.length} issue(s):`);
        issues.forEach((issue) => {
          if (issue.issue === "REVERSED") {
            console.log(
              `      - Teams REVERSED: JSON="${issue.json.home} vs ${issue.json.away}" vs DB="${issue.db.home} vs ${issue.db.away}"`
            );
          } else {
            console.log(
              `      - ${issue.field}: JSON="${issue.json}" vs DB="${issue.db}"`
            );
          }
        });
      }
    }

    // Print summary report
    console.log("\n" + "=".repeat(80));
    console.log("📊 VERIFICATION REPORT");
    console.log("=".repeat(80));
    console.log(`Total matches in JSON: ${stats.total}`);
    console.log(`✅ Found in database: ${stats.found}`);
    console.log(`❌ Not found in database: ${stats.notFound}`);
    console.log(`✅ Perfect matches: ${stats.perfectMatch}`);
    console.log(`⚠️  Matches with issues: ${stats.issues.length}`);
    console.log(`   - Reversed (teams): ${stats.reversed}`);
    console.log(`   - Date mismatches: ${stats.dateMismatch}`);
    console.log(`   - Home team mismatches: ${stats.homeTeamMismatch}`);
    console.log(`   - Away team mismatches: ${stats.awayTeamMismatch}`);
    console.log(`   - Venue mismatches: ${stats.venueMismatch}`);
    console.log("");

    // Save detailed report to file
    const reportFile = path.resolve(
      __dirname,
      "../data/footballapi/seriea_verification_report.json"
    );
    const report = {
      generated_at: new Date().toISOString(),
      json_file: JSON_FILE,
      summary: {
        total: stats.total,
        found: stats.found,
        notFound: stats.notFound,
        perfectMatch: stats.perfectMatch,
        issues: stats.issues.length,
        reversed: stats.reversed,
        dateMismatch: stats.dateMismatch,
        homeTeamMismatch: stats.homeTeamMismatch,
        awayTeamMismatch: stats.awayTeamMismatch,
        venueMismatch: stats.venueMismatch,
      },
      issues: stats.issues,
    };

    fs.writeFileSync(
      reportFile,
      JSON.stringify(report, null, 2),
      "utf8"
    );

    console.log(`📄 Detailed report saved to: ${reportFile}\n`);

    // Show sample issues
    if (stats.issues.length > 0) {
      console.log("=".repeat(80));
      console.log("⚠️  SAMPLE ISSUES (first 20):");
      console.log("=".repeat(80));
      stats.issues.slice(0, 20).forEach((issue, idx) => {
        console.log(`\n${idx + 1}. API Football ID: ${issue.apiFootballId}`);
        if (issue.issue === "NOT_FOUND") {
          console.log(`   Status: ❌ NOT FOUND IN DATABASE`);
          console.log(
            `   JSON: ${issue.jsonMatch.homeTeam} vs ${issue.jsonMatch.awayTeam}`
          );
          console.log(`   Date: ${formatDate(issue.jsonMatch.date)}`);
          console.log(`   Venue: ${issue.jsonMatch.venue}`);
        } else {
          console.log(`   Status: ⚠️  MISMATCH`);
          console.log(`   DB Match ID: ${issue.dbMatchId}`);
          console.log(`   Slug: ${issue.slug}`);
          if (issue.isReversed) {
            console.log(`   ⚠️  REVERSED: Teams are swapped`);
          }
          console.log(`   JSON: ${issue.jsonMatch.homeTeam} vs ${issue.jsonMatch.awayTeam}`);
          console.log(`   DB: ${issue.dbMatch.homeTeam} vs ${issue.dbMatch.awayTeam}`);
          issue.issues.forEach((i) => {
            if (i.issue === "REVERSED") {
              console.log(`   - Teams REVERSED:`);
              console.log(`     JSON: ${i.json.home} vs ${i.json.away}`);
              console.log(`     DB:   ${i.db.home} vs ${i.db.away}`);
            } else {
              console.log(`   - ${i.field}:`);
              console.log(`     JSON: ${i.json}`);
              console.log(`     DB:   ${i.db}`);
            }
          });
        }
      });
      if (stats.issues.length > 20) {
        console.log(`\n... and ${stats.issues.length - 20} more issues`);
      }
      console.log("");
    }

    console.log("=".repeat(80));
    console.log("✅ Verification complete!");
    console.log("=".repeat(80));

    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  } catch (error) {
    console.error("\n❌ Error:", error);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

verifyMatches();



