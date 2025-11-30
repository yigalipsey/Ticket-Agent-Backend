import dotenv from "dotenv";
import axios from "axios";
import databaseConnection from "../src/config/database.js";
import FootballEvent from "../src/models/FootballEvent.js";
import { logWithCheckpoint, logError } from "../src/utils/logger.js";

dotenv.config();

// API Football configuration
const API_FOOTBALL_BASE_URL =
  process.env.API_FOOTBALL_BASE_URL || "https://v3.football.api-sports.io";
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;

if (!API_FOOTBALL_KEY) {
  console.error("❌ API_FOOTBALL_KEY not found in environment variables");
  process.exit(1);
}

// API Football client
const apiClient = axios.create({
  baseURL: API_FOOTBALL_BASE_URL,
  headers: {
    "x-rapidapi-key": API_FOOTBALL_KEY,
    "x-rapidapi-host": "v3.football.api-sports.io",
  },
  timeout: 30000,
});

/**
 * Fetch fixture data from Football API by fixture ID
 */
async function fetchFixtureFromAPI(fixtureId) {
  try {
    logWithCheckpoint(
      "info",
      `[CHECKPOINT 1] Fetching fixture ${fixtureId} from Football API`,
      "UPDATE_DATES_001",
      { fixtureId }
    );

    const response = await apiClient.get("/fixtures", {
      params: {
        id: fixtureId,
      },
    });

    if (
      !response.data ||
      !response.data.response ||
      response.data.response.length === 0
    ) {
      logWithCheckpoint(
        "warn",
        `[CHECKPOINT 2] No fixture data found for ID ${fixtureId}`,
        "UPDATE_DATES_002",
        { fixtureId }
      );
      return null;
    }

    const fixtureData = response.data.response[0];

    logWithCheckpoint(
      "info",
      `[CHECKPOINT 3] Successfully fetched fixture ${fixtureId} from API`,
      "UPDATE_DATES_003",
      {
        fixtureId,
        date: fixtureData.fixture?.date,
        status: fixtureData.fixture?.status?.short,
      }
    );

    return fixtureData;
  } catch (error) {
    logError(error, {
      operation: "fetchFixtureFromAPI",
      fixtureId,
      checkpoint: "UPDATE_DATES_ERROR_001",
    });
    return null;
  }
}

/**
 * Update match date and time in database
 */
async function updateMatchDate(footballEvent, newDate) {
  try {
    const oldDate = footballEvent.date;
    const matchId = footballEvent._id.toString();
    const apiFootballId = footballEvent.externalIds?.apiFootball;

    logWithCheckpoint(
      "info",
      `[CHECKPOINT 4] Updating match ${matchId} date`,
      "UPDATE_DATES_004",
      {
        matchId,
        apiFootballId,
        oldDate: oldDate?.toISOString(),
        newDate: newDate?.toISOString(),
      }
    );

    const updatedMatch = await FootballEvent.findByIdAndUpdate(
      matchId,
      {
        $set: {
          date: newDate,
          updatedAt: new Date(),
        },
      },
      {
        new: true,
        runValidators: true,
      }
    ).lean();

    if (!updatedMatch) {
      logWithCheckpoint(
        "warn",
        `[CHECKPOINT 5] Match ${matchId} not found for update`,
        "UPDATE_DATES_005",
        { matchId }
      );
      return false;
    }

    logWithCheckpoint(
      "info",
      `[CHECKPOINT 6] Successfully updated match ${matchId} date`,
      "UPDATE_DATES_006",
      {
        matchId,
        apiFootballId,
        oldDate: oldDate?.toISOString(),
        newDate: updatedMatch.date?.toISOString(),
      }
    );

    return true;
  } catch (error) {
    logError(error, {
      operation: "updateMatchDate",
      matchId: footballEvent._id.toString(),
      checkpoint: "UPDATE_DATES_ERROR_002",
    });
    return false;
  }
}

/**
 * Main function to update all match dates from Football API
 */
async function updateMatchDates() {
  try {
    console.log("=".repeat(80));
    console.log("🔄 Starting match dates update from Football API");
    console.log("=".repeat(80));
    console.log("");

    // Connect to database
    logWithCheckpoint(
      "info",
      "[CHECKPOINT 0] Connecting to database",
      "UPDATE_DATES_000"
    );

    await databaseConnection.connect(process.env.MONGODB_URI);

    logWithCheckpoint(
      "info",
      "[CHECKPOINT 0.1] Database connected successfully",
      "UPDATE_DATES_000_1"
    );

    // Find all fixtures with apiFootball external ID
    logWithCheckpoint(
      "info",
      "[CHECKPOINT 0.2] Fetching all matches with apiFootball ID",
      "UPDATE_DATES_000_2"
    );

    const matches = await FootballEvent.find({
      "externalIds.apiFootball": { $exists: true, $ne: null },
    })
      .select("_id date externalIds.apiFootball slug")
      .lean();

    console.log(
      `\n📊 Found ${matches.length} matches with apiFootball ID\n`
    );

    if (matches.length === 0) {
      console.log("✅ No matches to update");
      await databaseConnection.disconnect();
      return;
    }

    let updated = 0;
    let unchanged = 0;
    let errors = 0;
    let notFound = 0;

    // Process matches in batches to avoid rate limiting
    const BATCH_SIZE = 10;
    const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds delay between batches

    for (let i = 0; i < matches.length; i += BATCH_SIZE) {
      const batch = matches.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(matches.length / BATCH_SIZE);

      console.log(
        `\n📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} matches)`
      );

      for (const match of batch) {
        try {
          const apiFootballId = match.externalIds?.apiFootball;

          if (!apiFootballId) {
            console.log(
              `   ⚠️  Match ${match._id} has no apiFootball ID, skipping`
            );
            unchanged++;
            continue;
          }

          // Fetch fixture data from API
          const fixtureData = await fetchFixtureFromAPI(apiFootballId);

          if (!fixtureData) {
            console.log(
              `   ❌ Match ${match._id} (API ID: ${apiFootballId}) not found in Football API`
            );
            notFound++;
            continue;
          }

          const newDate = new Date(fixtureData.fixture?.date);

          if (!newDate || isNaN(newDate.getTime())) {
            console.log(
              `   ⚠️  Match ${match._id} (API ID: ${apiFootballId}) has invalid date from API`
            );
            errors++;
            continue;
          }

          // Check if date has changed
          const oldDate = match.date ? new Date(match.date) : null;
          const dateChanged =
            !oldDate ||
            Math.abs(newDate.getTime() - oldDate.getTime()) > 60000; // 1 minute difference

          if (!dateChanged) {
            console.log(
              `   ✓ Match ${match._id} (API ID: ${apiFootballId}) - date unchanged`
            );
            unchanged++;
            continue;
          }

          // Update match date
          const success = await updateMatchDate(match, newDate);

          if (success) {
            console.log(
              `   ✅ Match ${match._id} (API ID: ${apiFootballId}) - date updated from ${oldDate?.toISOString()} to ${newDate.toISOString()}`
            );
            updated++;
          } else {
            console.log(
              `   ❌ Failed to update match ${match._id} (API ID: ${apiFootballId})`
            );
            errors++;
          }

          // Small delay between requests to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          console.error(
            `   ❌ Error processing match ${match._id}:`,
            error.message
          );
          logError(error, {
            operation: "updateMatchDates",
            matchId: match._id.toString(),
            checkpoint: "UPDATE_DATES_ERROR_003",
          });
          errors++;
        }
      }

      // Delay between batches (except for the last batch)
      if (i + BATCH_SIZE < matches.length) {
        console.log(
          `\n⏳ Waiting ${DELAY_BETWEEN_BATCHES / 1000} seconds before next batch...`
        );
        await new Promise((resolve) =>
          setTimeout(resolve, DELAY_BETWEEN_BATCHES)
        );
      }
    }

    // Summary
    console.log("\n" + "=".repeat(80));
    console.log("📊 UPDATE SUMMARY");
    console.log("=".repeat(80));
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ✓ Unchanged: ${unchanged}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   🔍 Not found in API: ${notFound}`);
    console.log(`   📈 Total processed: ${matches.length}`);
    console.log("=".repeat(80));

    logWithCheckpoint(
      "info",
      "[CHECKPOINT 7] Match dates update completed",
      "UPDATE_DATES_007",
      {
        updated,
        unchanged,
        errors,
        notFound,
        total: matches.length,
      }
    );

    // Disconnect from database
    await databaseConnection.disconnect();

    logWithCheckpoint(
      "info",
      "[CHECKPOINT 8] Database disconnected",
      "UPDATE_DATES_008"
    );
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    logError(error, {
      operation: "updateMatchDates",
      checkpoint: "UPDATE_DATES_ERROR_FATAL",
    });

    try {
      await databaseConnection.disconnect();
    } catch (disconnectError) {
      console.error("Error disconnecting from database:", disconnectError);
    }

    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  updateMatchDates()
    .then(() => {
      console.log("\n✅ Script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Script failed:", error);
      process.exit(1);
    });
}

export default updateMatchDates;





