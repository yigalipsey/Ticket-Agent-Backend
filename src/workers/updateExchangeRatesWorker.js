import "dotenv/config";
import cron from "node-cron";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadBaseRatesFromAPI } from "../utils/exchangeRate.js";
import { logWithCheckpoint, logError } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Results directory
const RESULTS_DIR = path.join(__dirname, "../../data/exchangeRates");

// Ensure results directory exists
function ensureResultsDirectory() {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
}

// Save worker results to file
function saveResults(result, error = null) {
  try {
    ensureResultsDirectory();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `exchange_rates_${timestamp}.json`;
    const filepath = path.join(RESULTS_DIR, filename);

    const output = {
      timestamp: new Date().toISOString(),
      success: !error && result?.success !== false,
      ...(error
        ? { error: error.message, stack: error.stack }
        : {
            loadedCurrencies: result.loadedCurrencies,
            timestamp: result.timestamp,
            usedFallback: result.usedFallback || false,
            ...(result.error && { error: result.error }),
          }),
    };

    fs.writeFileSync(filepath, JSON.stringify(output, null, 2), "utf8");
    logWithCheckpoint(
      "info",
      "Worker results saved",
      "EXCHANGE_RATE_WORKER_RESULT_SAVED",
      { filepath }
    );
    return filepath;
  } catch (saveError) {
    logError(saveError, { operation: "saveResults" });
    return null;
  }
}

class UpdateExchangeRatesWorker {
  constructor() {
    this.scheduledJob = null;
  }

  /**
   * טעינת שערי מטבע מה-API
   */
  async updateExchangeRates() {
    try {
      logWithCheckpoint(
        "info",
        "Starting exchange rates update",
        "EXCHANGE_RATE_WORKER_001"
      );

      const result = await loadBaseRatesFromAPI();

      if (result.success) {
        logWithCheckpoint(
          "info",
          "Exchange rates updated successfully",
          "EXCHANGE_RATE_WORKER_002",
          {
            loadedCurrencies: result.loadedCurrencies,
            timestamp: result.timestamp,
          }
        );
        return { success: true, ...result };
      } else {
        logWithCheckpoint(
          "warn",
          "Exchange rates update failed, using fallback",
          "EXCHANGE_RATE_WORKER_003",
          {
            error: result.error,
            usedFallback: result.usedFallback,
          }
        );
        return { success: false, ...result };
      }
    } catch (error) {
      logError(error, { operation: "updateExchangeRates" });
      logWithCheckpoint(
        "error",
        "Exchange rates update crashed",
        "EXCHANGE_RATE_WORKER_004",
        {
          error: error.message,
        }
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * הפעלת worker עם cron job - פעם ביום ב-8:00 בבוקר
   */
  start() {
    if (this.scheduledJob) {
      logWithCheckpoint(
        "warn",
        "Exchange rates update job already scheduled",
        "EXCHANGE_RATE_WORKER_005"
      );
      return;
    }

    // Cron expression: פעם ביום ב-8:00 בבוקר
    const cronExpression = "0 8 * * *";

    logWithCheckpoint(
      "info",
      "Scheduling exchange rates update job",
      "EXCHANGE_RATE_WORKER_006",
      {
        cronExpression,
        schedule: "Daily at 8:00 AM",
      }
    );

    this.scheduledJob = cron.schedule(
      cronExpression,
      async () => {
        try {
          const result = await this.updateExchangeRates();
          saveResults(result);
        } catch (error) {
          logError(error, { operation: "scheduledExchangeRatesUpdate" });
          saveResults(null, error);
        }
      },
      {
        scheduled: true,
        timezone: process.env.TZ || undefined,
      }
    );

    logWithCheckpoint(
      "info",
      "Exchange rates update job scheduled successfully",
      "EXCHANGE_RATE_WORKER_007",
      {
        cronExpression,
        nextRun: this.scheduledJob.nextDate(),
      }
    );
  }

  /**
   * עצירת ה-worker
   */
  stop() {
    if (this.scheduledJob) {
      this.scheduledJob.stop();
      this.scheduledJob = null;
      logWithCheckpoint(
        "info",
        "Exchange rates update job stopped",
        "EXCHANGE_RATE_WORKER_008"
      );
    }
  }

  /**
   * קבלת סטטוס ה-worker
   */
  getStatus() {
    return {
      isRunning: !!this.scheduledJob,
      nextRun: this.scheduledJob?.nextDate() || null,
    };
  }
}

const updateExchangeRatesWorker = new UpdateExchangeRatesWorker();

// Handle uncaught exceptions - prevent worker crash
process.on("uncaughtException", (error) => {
  logError(error, {
    operation: "uncaughtException",
    worker: "updateExchangeRatesWorker",
  });
  logWithCheckpoint(
    "error",
    "Uncaught exception in exchange rates worker - shutting down gracefully",
    "EXCHANGE_RATE_WORKER_009",
    { error: error.message }
  );
  // Stop the worker and exit
  try {
    updateExchangeRatesWorker.stop();
  } catch (stopError) {
    logError(stopError, { operation: "stopWorkerOnError" });
  }
  process.exit(1);
});

// Handle unhandled promise rejections - prevent worker crash
process.on("unhandledRejection", (reason, promise) => {
  logError(new Error(`Unhandled Rejection at: ${promise}, reason: ${reason}`), {
    operation: "unhandledRejection",
    worker: "updateExchangeRatesWorker",
  });
  logWithCheckpoint(
    "error",
    "Unhandled rejection in exchange rates worker",
    "EXCHANGE_RATE_WORKER_010",
    { reason: reason?.toString() || "Unknown" }
  );
  // Note: We don't exit on unhandled rejection to allow the worker to continue
  // but we log it for monitoring
});

// טעינה ראשונית בעת הפעלת ה-worker
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  if (args.includes("--start")) {
    // הפעלת worker עם cron scheduling
    (async () => {
      try {
        // טעינה ראשונית מיד בעת הפעלה
        const result = await updateExchangeRatesWorker.updateExchangeRates();
        saveResults(result);

        // הפעלת ה-scheduler
        updateExchangeRatesWorker.start();

        console.log("✅ Exchange rates worker started and scheduled");
        console.log("📅 Schedule: Daily at 8:00 AM");
        console.log(
          `⏰ Next run: ${updateExchangeRatesWorker.getStatus().nextRun}`
        );
      } catch (error) {
        console.error("❌ Failed to start worker:", error);
        process.exit(1);
      }
    })();
  } else if (args.includes("--run-once")) {
    // הרצה חד-פעמית (לבדיקה)
    (async () => {
      try {
        console.log("🔄 Updating exchange rates...");
        const result = await updateExchangeRatesWorker.updateExchangeRates();

        if (result.success) {
          console.log("\n✅ Exchange rates updated successfully:");
          console.log(`   Currencies: ${result.loadedCurrencies.join(", ")}`);
          console.log(`   Timestamp: ${result.timestamp}`);
        } else {
          console.log("\n⚠️ Exchange rates update failed, using fallback");
          if (result.error) {
            console.log(`   Error: ${result.error}`);
          }
        }

        // Save results to file
        const savedPath = saveResults(result);
        if (savedPath) {
          console.log(`\n✅ Results saved to: ${savedPath}`);
        }

        process.exit(0);
      } catch (error) {
        console.error("❌ Exchange rates update failed:", error);

        // Save error results to file
        const savedPath = saveResults(null, error);
        if (savedPath) {
          console.log(`\n⚠️ Error results saved to: ${savedPath}`);
        }

        process.exit(1);
      }
    })();
  } else {
    console.log("Usage:");
    console.log("  --start     Start the worker with cron scheduling");
    console.log("  --run-once  Run exchange rates update once (for testing)");
    process.exit(1);
  }
}

export default updateExchangeRatesWorker;
