import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import FootballEvent from "../src/models/FootballEvent.js";
import League from "../src/models/League.js";
import Team from "../src/models/Team.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to JSON file
const JSON_FILE = path.resolve(
  __dirname,
  "../data/footballapi/league_135_from_next_week.json"
);

// Format date with time for display
function formatDateTime(date) {
  if (!date) return "N/A";
  const d = new Date(date);
  return d.toISOString().replace("T", " ").substring(0, 19);
}

async function checkDatesTimes() {
  try {
    console.log("=".repeat(80));
    console.log("🕐 Checking Serie A dates and times");
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
      exactMatch: 0,
      dateOnlyMatch: 0,
      timeDifference: 0,
      dateDifference: 0,
      issues: [],
    };

    // Process each match
    for (let i = 0; i < jsonMatches.length; i++) {
      const jsonMatch = jsonMatches[i];
      const apiFootballId = jsonMatch.apiFootballId;

      // Find match in database by API Football ID
      const dbMatch = await FootballEvent.findOne({
        "externalIds.apiFootball": apiFootballId,
      })
        .populate("homeTeam", "name name_en")
        .populate("awayTeam", "name name_en")
        .lean();

      if (!dbMatch) {
        stats.notFound++;
        continue;
      }

      stats.found++;

      // Compare dates and times precisely
      const jsonDate = new Date(jsonMatch.date);
      const dbDate = new Date(dbMatch.date);

      // Calculate differences
      const totalDiffMs = Math.abs(jsonDate.getTime() - dbDate.getTime());
      const totalDiffMinutes = Math.floor(totalDiffMs / 60000);
      const totalDiffHours = Math.floor(totalDiffMs / 3600000);
      const totalDiffDays = Math.floor(totalDiffMs / 86400000);

      // Check if dates match (same day)
      const jsonDateStr = jsonDate.toISOString().split("T")[0];
      const dbDateStr = dbDate.toISOString().split("T")[0];
      const datesMatch = jsonDateStr === dbDateStr;

      // Check if times match (within 1 minute)
      const timesMatch = totalDiffMinutes <= 1;

      if (timesMatch && datesMatch) {
        stats.exactMatch++;
      } else if (datesMatch && !timesMatch) {
        stats.timeDifference++;
        stats.issues.push({
          apiFootballId,
          dbMatchId: dbMatch._id.toString(),
          match: `${dbMatch.homeTeam?.name_en || dbMatch.homeTeam?.name} vs ${dbMatch.awayTeam?.name_en || dbMatch.awayTeam?.name}`,
          jsonDateTime: formatDateTime(jsonDate),
          dbDateTime: formatDateTime(dbDate),
          differenceMinutes: totalDiffMinutes,
          differenceHours: totalDiffHours.toFixed(2),
        });
      } else {
        stats.dateDifference++;
        stats.issues.push({
          apiFootballId,
          dbMatchId: dbMatch._id.toString(),
          match: `${dbMatch.homeTeam?.name_en || dbMatch.homeTeam?.name} vs ${dbMatch.awayTeam?.name_en || dbMatch.awayTeam?.name}`,
          jsonDateTime: formatDateTime(jsonDate),
          dbDateTime: formatDateTime(dbDate),
          differenceDays: totalDiffDays,
          differenceHours: totalDiffHours.toFixed(2),
        });
      }
    }

    // Print summary report
    console.log("=".repeat(80));
    console.log("📊 DATES & TIMES REPORT");
    console.log("=".repeat(80));
    console.log(`Total matches in JSON: ${stats.total}`);
    console.log(`✅ Found in database: ${stats.found}`);
    console.log(`❌ Not found: ${stats.notFound}`);
    console.log(`✅ Exact match (date + time): ${stats.exactMatch}`);
    console.log(`⚠️  Same date, different time: ${stats.timeDifference}`);
    console.log(`❌ Different date: ${stats.dateDifference}`);
    console.log("");

    // Show issues
    if (stats.issues.length > 0) {
      console.log("=".repeat(80));
      console.log("⚠️  MATCHES WITH DATE/TIME ISSUES:");
      console.log("=".repeat(80));

      // Group by type
      const timeIssues = stats.issues.filter((i) => i.differenceMinutes !== undefined);
      const dateIssues = stats.issues.filter((i) => i.differenceDays !== undefined);

      if (timeIssues.length > 0) {
        console.log(`\n📅 Same date, different time (${timeIssues.length} matches):\n`);
        timeIssues.slice(0, 20).forEach((issue, idx) => {
          console.log(`${idx + 1}. API ID: ${issue.apiFootballId} - ${issue.match}`);
          console.log(`   JSON: ${issue.jsonDateTime}`);
          console.log(`   DB:   ${issue.dbDateTime}`);
          console.log(`   Difference: ${issue.differenceMinutes} minutes (${issue.differenceHours} hours)`);
          console.log("");
        });
        if (timeIssues.length > 20) {
          console.log(`... and ${timeIssues.length - 20} more time differences\n`);
        }
      }

      if (dateIssues.length > 0) {
        console.log(`\n📆 Different dates (${dateIssues.length} matches):\n`);
        dateIssues.slice(0, 20).forEach((issue, idx) => {
          console.log(`${idx + 1}. API ID: ${issue.apiFootballId} - ${issue.match}`);
          console.log(`   JSON: ${issue.jsonDateTime}`);
          console.log(`   DB:   ${issue.dbDateTime}`);
          console.log(`   Difference: ${issue.differenceDays} days (${issue.differenceHours} hours)`);
          console.log("");
        });
        if (dateIssues.length > 20) {
          console.log(`... and ${dateIssues.length - 20} more date differences\n`);
        }
      }
    } else {
      console.log("✅ All dates and times match perfectly!");
    }

    // Save detailed report
    const reportFile = path.resolve(
      __dirname,
      "../data/footballapi/seriea_dates_times_report.json"
    );
    const report = {
      generated_at: new Date().toISOString(),
      summary: stats,
      issues: stats.issues,
    };

    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), "utf8");
    console.log(`📄 Detailed report saved to: ${reportFile}\n`);

    console.log("=".repeat(80));
    console.log("✅ Check complete!");
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

checkDatesTimes();

