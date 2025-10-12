import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import League from "../src/models/League.js";
import { logWithCheckpoint, logError } from "../src/utils/logger.js";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

/**
 * יצירת מערך חודשים מתאריך התחלה ועד תאריך סיום
 */
function generateMonths(startDate, endDate) {
  const months = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, "0");
    months.push(`${year}-${month}`);

    // מעבר לחודש הבא
    current.setMonth(current.getMonth() + 1);
  }

  return months;
}

/**
 * הכנסת חודשים לכל הליגות - מאוקטובר 2025 עד אוקטובר 2026
 */
async function initializeLeagueMonths() {
  try {
    logWithCheckpoint(
      "info",
      "Starting league months initialization",
      "INIT_LEAGUE_MONTHS_001"
    );

    // התחברות למסד נתונים
    await mongoose.connect(process.env.MONGODB_URI);
    logWithCheckpoint("info", "Connected to MongoDB", "INIT_LEAGUE_MONTHS_002");

    // יצירת מערך חודשים מאוקטובר 2025 עד אוקטובר 2026
    const startDate = new Date("2025-10-01");
    const endDate = new Date("2026-10-31");
    const months = generateMonths(startDate, endDate);

    logWithCheckpoint(
      "info",
      "Generated months array",
      "INIT_LEAGUE_MONTHS_003",
      {
        startMonth: months[0],
        endMonth: months[months.length - 1],
        totalMonths: months.length,
        months: months,
      }
    );

    // קבלת כל הליגות
    const leagues = await League.find({});
    logWithCheckpoint("info", "Fetched all leagues", "INIT_LEAGUE_MONTHS_004", {
      count: leagues.length,
    });

    let updatedCount = 0;
    let errorCount = 0;

    // עדכון כל הליגות עם מערך החודשים
    for (const league of leagues) {
      try {
        logWithCheckpoint(
          "info",
          `Updating league: ${league.name}`,
          "INIT_LEAGUE_MONTHS_005",
          { leagueId: league._id, name: league.name }
        );

        await League.findByIdAndUpdate(league._id, {
          $set: { months: months },
        });

        updatedCount++;

        logWithCheckpoint(
          "info",
          `Updated league: ${league.name}`,
          "INIT_LEAGUE_MONTHS_006",
          {
            leagueId: league._id,
            monthsCount: months.length,
          }
        );
      } catch (error) {
        errorCount++;
        logError(error, {
          operation: "initializeLeagueMonths",
          leagueId: league._id,
          leagueName: league.name,
        });
      }
    }

    logWithCheckpoint(
      "info",
      "League months initialization completed",
      "INIT_LEAGUE_MONTHS_007",
      {
        totalLeagues: leagues.length,
        updatedCount,
        errorCount,
        monthsAdded: months.length,
      }
    );

    console.log("\n✅ League months initialization completed successfully!");
    console.log(`📊 Total leagues: ${leagues.length}`);
    console.log(`✔️  Updated: ${updatedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(
      `📅 Months added: ${months.length} (${months[0]} to ${
        months[months.length - 1]
      })`
    );
    console.log(`\n📋 Months list:`);
    months.forEach((month, index) => {
      console.log(`   ${index + 1}. ${month}`);
    });
  } catch (error) {
    logError(error, { operation: "initializeLeagueMonths" });
    console.error("❌ Error initializing league months:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    logWithCheckpoint(
      "info",
      "Disconnected from MongoDB",
      "INIT_LEAGUE_MONTHS_008"
    );
  }
}

// הרצת הסקריפט
initializeLeagueMonths();
