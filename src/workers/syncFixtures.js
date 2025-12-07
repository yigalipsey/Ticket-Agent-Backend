import dotenv from "dotenv";
import mongoose from "mongoose";
import cron from "node-cron";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import syncService from "../services/syncService.js";
import { logWithCheckpoint, logError } from "../utils/logger.js";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Results directory
const RESULTS_DIR = path.join(__dirname, "../../data/footballApi");

// Ensure results directory exists
function ensureResultsDirectory() {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
}

// Save worker results to file
function saveResults(result, leagueId, season, error = null) {
  try {
    ensureResultsDirectory();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `sync_fixtures_${leagueId}_${season}_${timestamp}.json`;
    const filepath = path.join(RESULTS_DIR, filename);

    const output = {
      timestamp: new Date().toISOString(),
      leagueId,
      season,
      success: !error,
      ...(error ? { error: error.message, stack: error.stack } : { result }),
    };

    fs.writeFileSync(filepath, JSON.stringify(output, null, 2), "utf8");
    logWithCheckpoint(
      "info",
      "Worker results saved",
      "SYNC_FIXTURES_RESULT_SAVED",
      { filepath }
    );
    return filepath;
  } catch (saveError) {
    logError(saveError, { operation: "saveResults" });
    return null;
  }
}

class SyncFixturesWorker {
  constructor() {
    this.isRunning = false;
    this.scheduledJobs = new Map();
  }

  // Connect to MongoDB
  async connectToDatabase() {
    try {
      logWithCheckpoint("info", "Connecting to MongoDB", "WORKER_001");

      await mongoose.connect(process.env.MONGODB_URI);

      logWithCheckpoint(
        "info",
        "Successfully connected to MongoDB",
        "WORKER_002"
      );
    } catch (error) {
      logError(error, { operation: "connectToDatabase" });
      throw error;
    }
  }

  // Disconnect from MongoDB
  async disconnectFromDatabase() {
    try {
      logWithCheckpoint("info", "Disconnecting from MongoDB", "WORKER_003");

      await mongoose.disconnect();

      logWithCheckpoint(
        "info",
        "Successfully disconnected from MongoDB",
        "WORKER_004"
      );
    } catch (error) {
      logError(error, { operation: "disconnectFromDatabase" });
      throw error;
    }
  }

  // Run sync for specific league and season
  async runSync(leagueId, season, options = {}) {
    if (this.isRunning) {
      logWithCheckpoint("warn", "Sync already running, skipping", "WORKER_005");
      return;
    }

    this.isRunning = true;

    try {
      logWithCheckpoint("info", "Starting sync worker", "WORKER_006", {
        leagueId,
        season,
        options,
      });

      const result = await syncService.syncFixtures(leagueId, season, options);

      logWithCheckpoint(
        "info",
        "Sync worker completed successfully",
        "WORKER_007",
        result
      );

      return result;
    } catch (error) {
      logError(error, { operation: "runSync", leagueId, season, options });
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  // Schedule recurring sync
  scheduleSync(leagueId, season, cronExpression, options = {}) {
    try {
      logWithCheckpoint("info", "Scheduling recurring sync", "WORKER_008", {
        leagueId,
        season,
        cronExpression,
      });

      const jobKey = `${leagueId}-${season}`;

      // Cancel existing job if it exists
      if (this.scheduledJobs.has(jobKey)) {
        this.scheduledJobs.get(jobKey).destroy();
        logWithCheckpoint(
          "info",
          "Cancelled existing scheduled job",
          "WORKER_009",
          { jobKey }
        );
      }

      // Create new scheduled job
      const job = cron.schedule(
        cronExpression,
        async () => {
          try {
            logWithCheckpoint(
              "info",
              "Executing scheduled sync",
              "WORKER_010",
              {
                leagueId,
                season,
              }
            );

            const result = await this.runSync(leagueId, season, options);
            saveResults(result, leagueId, season);
          } catch (error) {
            logError(error, { operation: "scheduledSync", leagueId, season });
            saveResults(null, leagueId, season, error);
          }
        },
        {
          scheduled: false,
        }
      );

      this.scheduledJobs.set(jobKey, job);
      job.start();

      logWithCheckpoint(
        "info",
        "Successfully scheduled sync job",
        "WORKER_011",
        {
          jobKey,
          cronExpression,
        }
      );

      return job;
    } catch (error) {
      logError(error, {
        operation: "scheduleSync",
        leagueId,
        season,
        cronExpression,
      });
      throw error;
    }
  }

  // Cancel scheduled sync
  cancelScheduledSync(leagueId, season) {
    try {
      const jobKey = `${leagueId}-${season}`;

      if (this.scheduledJobs.has(jobKey)) {
        this.scheduledJobs.get(jobKey).destroy();
        this.scheduledJobs.delete(jobKey);

        logWithCheckpoint("info", "Cancelled scheduled sync", "WORKER_012", {
          jobKey,
        });
        return true;
      } else {
        logWithCheckpoint(
          "warn",
          "No scheduled job found to cancel",
          "WORKER_013",
          { jobKey }
        );
        return false;
      }
    } catch (error) {
      logError(error, { operation: "cancelScheduledSync", leagueId, season });
      throw error;
    }
  }

  // Get all scheduled jobs
  getScheduledJobs() {
    const jobs = [];

    for (const [jobKey, job] of this.scheduledJobs) {
      jobs.push({
        key: jobKey,
        running: job.running,
        nextDate: job.nextDate(),
      });
    }

    return jobs;
  }

  // Stop all scheduled jobs
  stopAllJobs() {
    try {
      logWithCheckpoint("info", "Stopping all scheduled jobs", "WORKER_014");

      for (const [jobKey, job] of this.scheduledJobs) {
        job.destroy();
        logWithCheckpoint("debug", "Stopped job", "WORKER_015", { jobKey });
      }

      this.scheduledJobs.clear();

      logWithCheckpoint("info", "All scheduled jobs stopped", "WORKER_016");
    } catch (error) {
      logError(error, { operation: "stopAllJobs" });
      throw error;
    }
  }
}

// Create worker instance
const syncWorker = new SyncFixturesWorker();

// Handle uncaught exceptions - prevent worker crash
process.on("uncaughtException", (error) => {
  logError(error, {
    operation: "uncaughtException",
    worker: "syncFixturesWorker",
  });
  logWithCheckpoint(
    "error",
    "Uncaught exception in sync fixtures worker - shutting down gracefully",
    "WORKER_019",
    { error: error.message }
  );
  // Stop the worker and exit
  try {
    syncWorker.stopAllJobs();
  } catch (stopError) {
    logError(stopError, { operation: "stopWorkerOnError" });
  }
  process.exit(1);
});

// Handle unhandled promise rejections - prevent worker crash
process.on("unhandledRejection", (reason, promise) => {
  logError(new Error(`Unhandled Rejection at: ${promise}, reason: ${reason}`), {
    operation: "unhandledRejection",
    worker: "syncFixturesWorker",
  });
  logWithCheckpoint(
    "error",
    "Unhandled rejection in sync fixtures worker",
    "WORKER_020",
    { reason: reason?.toString() || "Unknown" }
  );
  // Note: We don't exit on unhandled rejection to allow the worker to continue
  // but we log it for monitoring
});

// Handle process termination
process.on("SIGINT", async () => {
  logWithCheckpoint(
    "info",
    "Received SIGINT, shutting down gracefully",
    "WORKER_017"
  );

  try {
    syncWorker.stopAllJobs();
    await syncWorker.disconnectFromDatabase();
    process.exit(0);
  } catch (error) {
    logError(error, { operation: "gracefulShutdown" });
    process.exit(1);
  }
});

process.on("SIGTERM", async () => {
  logWithCheckpoint(
    "info",
    "Received SIGTERM, shutting down gracefully",
    "WORKER_018"
  );

  try {
    syncWorker.stopAllJobs();
    await syncWorker.disconnectFromDatabase();
    process.exit(0);
  } catch (error) {
    logError(error, { operation: "gracefulShutdown" });
    process.exit(1);
  }
});

// CLI interface for manual execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log("Usage: node syncFixtures.js <leagueId> <season> [options]");
    console.log("Example: node syncFixtures.js 39 2023 --force-update");
    process.exit(1);
  }

  const leagueId = args[0];
  const season = args[1];
  const options = {};

  // Parse additional options
  if (args.includes("--force-update")) {
    options.forceUpdate = true;
  }

  if (args.includes("--from")) {
    const fromIndex = args.indexOf("--from");
    if (args[fromIndex + 1]) {
      options.from = args[fromIndex + 1];
    }
  }

  if (args.includes("--to")) {
    const toIndex = args.indexOf("--to");
    if (args[toIndex + 1]) {
      options.to = args[toIndex + 1];
    }
  }

  // Run sync
  (async () => {
    try {
      await syncWorker.connectToDatabase();
      const result = await syncWorker.runSync(leagueId, season, options);
      console.log("Sync completed:", result);

      // Save results to file
      const savedPath = saveResults(result, leagueId, season);
      if (savedPath) {
        console.log(`\n✅ Results saved to: ${savedPath}`);
      }

      await syncWorker.disconnectFromDatabase();
    } catch (error) {
      console.error("Sync failed:", error);

      // Save error results to file
      const savedPath = saveResults(null, leagueId, season, error);
      if (savedPath) {
        console.log(`\n⚠️ Error results saved to: ${savedPath}`);
      }

      process.exit(1);
    }
  })();
}

export default syncWorker;
