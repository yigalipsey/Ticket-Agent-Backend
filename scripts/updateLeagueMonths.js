import dotenv from "dotenv";
import mongoose from "mongoose";
import League from "../src/models/League.js";
import { logWithCheckpoint, logError } from "../src/utils/logger.js";

// Load environment variables
dotenv.config();

/**
 * Script to update league months until May 2026
 */

const leagueIds = [
  "6926eb65157fcaee5df59760",
  "6926f079518b2d5adbba7229", // Serie A
  "68f784ee63924d01b9f06eaa",
];

// Generate months from December 2025 to May 2026
const generateMonths = () => {
  const months = [];
  const startYear = 2025;
  const startMonth = 12; // December
  const endYear = 2026;
  const endMonth = 5; // May

  // December 2025
  months.push(`${startYear}-${String(startMonth).padStart(2, "0")}`);

  // January 2026 to May 2026
  for (let year = endYear; year <= endYear; year++) {
    for (let month = 1; month <= endMonth; month++) {
      months.push(`${year}-${String(month).padStart(2, "0")}`);
    }
  }

  return months;
};

const monthsToAdd = generateMonths();

async function connectToDatabase() {
  try {
    logWithCheckpoint("info", "Connecting to MongoDB", "SCRIPT_001");

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
    });

    logWithCheckpoint(
      "info",
      "Successfully connected to MongoDB",
      "SCRIPT_002"
    );
  } catch (error) {
    logError(error, { operation: "connectToDatabase" });
    throw error;
  }
}

async function updateLeagueMonths() {
  try {
    logWithCheckpoint(
      "info",
      `Updating ${leagueIds.length} leagues with months until May 2026`,
      "SCRIPT_003",
      { months: monthsToAdd }
    );

    const results = [];

    for (const leagueId of leagueIds) {
      try {
        const league = await League.findById(leagueId);

        if (!league) {
          logWithCheckpoint(
            "warn",
            `League not found with ID: ${leagueId}`,
            "SCRIPT_004"
          );
          results.push({
            success: false,
            leagueId,
            error: "League not found",
          });
          continue;
        }

        const currentMonths = league.months || [];
        const updatedMonths = [...new Set([...currentMonths, ...monthsToAdd])].sort();

        logWithCheckpoint(
          "info",
          `Found league: ${league.name || league.nameHe || leagueId}`,
          "SCRIPT_004",
          {
            leagueId,
            currentMonthsCount: currentMonths.length,
            newMonthsCount: updatedMonths.length,
            currentMonths,
            updatedMonths,
          }
        );

        league.months = updatedMonths;
        await league.save({ runValidators: true });

        logWithCheckpoint(
          "info",
          `Updated league: ${league.name || league.nameHe || leagueId}`,
          "SCRIPT_005",
          {
            leagueId,
            monthsCount: updatedMonths.length,
            months: updatedMonths,
          }
        );

        results.push({
          success: true,
          league: {
            _id: league._id,
            name: league.name || league.nameHe,
            slug: league.slug,
            months: league.months,
          },
        });
      } catch (error) {
        results.push({
          success: false,
          leagueId,
          error: error.message,
        });

        logError(error, {
          operation: "updateLeagueMonths",
          leagueId,
        });
      }
    }

    return results;
  } catch (error) {
    logError(error, { operation: "updateLeagueMonths" });
    throw error;
  }
}

async function main() {
  try {
    // Connect to database
    await connectToDatabase();

    // Update leagues
    const results = await updateLeagueMonths();

    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    console.log("\n✅ Successfully updated leagues:");
    successful.forEach((result, index) => {
      const l = result.league;
      console.log(`${index + 1}. ${l.name || l.slug} (${l._id})`);
      console.log(`   Months: ${l.months.join(", ")}`);
    });

    if (failed.length > 0) {
      console.log("\n❌ Failed to update leagues:");
      failed.forEach((result, index) => {
        console.log(`${index + 1}. League ID: ${result.leagueId}`);
        console.log(`   Error: ${result.error}`);
      });
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Successfully updated: ${successful.length} leagues`);
    if (failed.length > 0) {
      console.log(`   ❌ Failed: ${failed.length} leagues`);
    }
    console.log(`   📝 Total processed: ${leagueIds.length} leagues`);
  } catch (error) {
    logError(error, { operation: "main" });
    console.error("❌ Error updating leagues:", error.message);
    process.exit(1);
  } finally {
    // Disconnect from database
    await mongoose.disconnect();
    logWithCheckpoint("info", "Disconnected from MongoDB", "SCRIPT_006");
  }
}

// Run the script
main();






