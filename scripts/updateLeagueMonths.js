import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import League from "../src/models/League.js";
import FootballEvent from "../src/models/FootballEvent.js";
import { logWithCheckpoint, logError } from "../src/utils/logger.js";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

/**
 * עדכון החודשים הזמינים לכל ליגה על בסיס המשחקים הקיימים
 */
async function updateLeagueMonths() {
  try {
    logWithCheckpoint(
      "info",
      "Starting league months update",
      "UPDATE_LEAGUE_MONTHS_001"
    );

    // התחברות למסד נתונים
    await mongoose.connect(process.env.MONGODB_URI);
    logWithCheckpoint(
      "info",
      "Connected to MongoDB",
      "UPDATE_LEAGUE_MONTHS_002"
    );

    // קבלת כל הליגות
    const leagues = await League.find({});
    logWithCheckpoint(
      "info",
      "Fetched all leagues",
      "UPDATE_LEAGUE_MONTHS_003",
      { count: leagues.length }
    );

    let updatedCount = 0;
    let errorCount = 0;

    // עבור כל ליגה
    for (const league of leagues) {
      try {
        logWithCheckpoint(
          "info",
          `Processing league: ${league.name}`,
          "UPDATE_LEAGUE_MONTHS_004",
          { leagueId: league._id, name: league.name }
        );

        // שליפת כל המשחקים של הליגה
        const fixtures = await FootballEvent.find({
          league: league._id,
          date: { $exists: true },
        })
          .select("date")
          .lean();

        if (fixtures.length === 0) {
          logWithCheckpoint(
            "warn",
            `No fixtures found for league: ${league.name}`,
            "UPDATE_LEAGUE_MONTHS_005",
            { leagueId: league._id }
          );
          continue;
        }

        // חישוב חודשים ייחודיים
        const monthsSet = new Set();
        fixtures.forEach((fixture) => {
          if (fixture.date) {
            const month = new Date(fixture.date).toISOString().slice(0, 7); // YYYY-MM
            monthsSet.add(month);
          }
        });

        const months = Array.from(monthsSet).sort();

        logWithCheckpoint(
          "info",
          `Found months for league: ${league.name}`,
          "UPDATE_LEAGUE_MONTHS_006",
          {
            leagueId: league._id,
            monthsCount: months.length,
            months: months,
            fixturesCount: fixtures.length,
          }
        );

        // עדכון הליגה
        await League.findByIdAndUpdate(league._id, {
          $set: { months: months },
        });

        updatedCount++;

        logWithCheckpoint(
          "info",
          `Updated league: ${league.name}`,
          "UPDATE_LEAGUE_MONTHS_007",
          {
            leagueId: league._id,
            monthsCount: months.length,
          }
        );
      } catch (error) {
        errorCount++;
        logError(error, {
          operation: "updateLeagueMonths",
          leagueId: league._id,
          leagueName: league.name,
        });
      }
    }

    logWithCheckpoint(
      "info",
      "League months update completed",
      "UPDATE_LEAGUE_MONTHS_008",
      {
        totalLeagues: leagues.length,
        updatedCount,
        errorCount,
      }
    );

    console.log("\n✅ League months update completed successfully!");
    console.log(`📊 Total leagues: ${leagues.length}`);
    console.log(`✔️  Updated: ${updatedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
  } catch (error) {
    logError(error, { operation: "updateLeagueMonths" });
    console.error("❌ Error updating league months:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    logWithCheckpoint(
      "info",
      "Disconnected from MongoDB",
      "UPDATE_LEAGUE_MONTHS_009"
    );
  }
}

// הרצת הסקריפט
updateLeagueMonths();
