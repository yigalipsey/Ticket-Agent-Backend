import "dotenv/config";
import cron from "node-cron";
import { loadBaseRatesFromAPI } from "../utils/exchangeRate.js";
import { logWithCheckpoint, logError } from "../utils/logger.js";

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
          await this.updateExchangeRates();
        } catch (error) {
          logError(error, { operation: "scheduledExchangeRatesUpdate" });
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

// טעינה ראשונית בעת הפעלת ה-worker
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  if (args.includes("--start")) {
    // הפעלת worker עם cron scheduling
    (async () => {
      try {
        // טעינה ראשונית מיד בעת הפעלה
        await updateExchangeRatesWorker.updateExchangeRates();

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

        process.exit(0);
      } catch (error) {
        console.error("❌ Exchange rates update failed:", error);
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
