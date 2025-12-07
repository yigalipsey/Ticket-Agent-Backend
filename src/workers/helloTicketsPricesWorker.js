import "dotenv/config";
import mongoose from "mongoose";
import cron from "node-cron";
import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import FootballEvent from "../models/FootballEvent.js";
import Supplier from "../models/Supplier.js";
import Offer from "../models/Offer.js";
import League from "../models/League.js";
import Team from "../models/Team.js";
import { logWithCheckpoint, logError } from "../utils/logger.js";
import { updateFixtureMinPrice } from "../services/offer/utils/fixtureMinPriceService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Results directory
const RESULTS_DIR = path.join(__dirname, "../../data/helloTickets");

// Ensure results directory exists
function ensureResultsDirectory() {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
}

// Save worker results to file
function saveResults(result, leagueSlug = null, error = null) {
  try {
    ensureResultsDirectory();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const leaguePart = leagueSlug ? `_${leagueSlug}` : "";
    const filename = `hellotickets_prices${leaguePart}_${timestamp}.json`;
    const filepath = path.join(RESULTS_DIR, filename);

    const output = {
      timestamp: new Date().toISOString(),
      ...(leagueSlug && { leagueSlug }),
      success: !error,
      ...(error
        ? { error: error.message, stack: error.stack }
        : Array.isArray(result)
        ? {
            leagues: result,
            summary: {
              totalLeagues: result.length,
              successfulLeagues: result.filter((r) => !r.error).length,
              failedLeagues: result.filter((r) => r.error).length,
            },
          }
        : {
            league: {
              slug: result.leagueSlug,
              name: result.leagueName,
            },
            summary: {
              apiCalls: result.apiCalls,
              matchesUpdated: result.matchesUpdated,
              matchesSkipped: result.matchesSkipped,
              offersCreated: result.offersCreated,
              offersUpdated: result.offersUpdated,
              offersSkipped: result.offersSkipped,
              minPriceUpdates: result.minPriceUpdates,
              errors: result.errors,
            },
            matchesDetails: result.matchesDetails?.slice(0, 100) || [], // Save first 100 for reference
          }),
    };

    fs.writeFileSync(filepath, JSON.stringify(output, null, 2), "utf8");
    logWithCheckpoint(
      "info",
      "Worker results saved",
      "HT_PRICES_WORKER_RESULT_SAVED",
      { filepath }
    );
    return filepath;
  } catch (saveError) {
    logError(saveError, { operation: "saveResults" });
    return null;
  }
}

// Leagues to update prices for (can be overridden via environment variable)
const DEFAULT_LEAGUES = [
  "epl", // Premier League
  "laliga", // La Liga
  "serie-a", // Serie A
  "ligue-1", // Ligue 1
  "champions-league", // Champions League
];

const LEAGUES_TO_UPDATE =
  process.env.PRICE_UPDATE_LEAGUES?.split(",").map((s) => s.trim()) ||
  DEFAULT_LEAGUES;

// API Configuration
const API_KEY = process.env.HELLO_TICETS_API_KEY;
if (!API_KEY) {
  throw new Error(
    "HELLO_TICETS_API_KEY environment variable is required. Please set it in your .env file."
  );
}
const API_URL = "https://api-live.hellotickets.com/v1";
const AFFILIATE_PARAMS = "tap_a=141252-18675a&tap_s=8995852-00a564";

// API timeout configuration (30 seconds)
const API_TIMEOUT_MS = 30000;

function addAffiliateLink(originalUrl) {
  if (!originalUrl) return null;
  const separator = originalUrl.includes("?") ? "&" : "?";
  return `${originalUrl}${separator}${AFFILIATE_PARAMS}`;
}

async function fetchAllPerformances(
  performerId,
  performerName,
  apiCallCounter
) {
  try {
    let allPerformances = [];
    let page = 1;
    let totalPages = 1;

    do {
      const params = {
        performer_id: performerId,
        category_id: 1,
        page: page,
        limit: 100,
      };

      // Increment API call counter
      if (apiCallCounter) {
        apiCallCounter.count++;
      }

      const { data } = await axios.get(`${API_URL}/performances`, {
        params,
        headers: {
          Accept: "application/json",
          "X-Public-Key": API_KEY,
        },
        timeout: API_TIMEOUT_MS,
      });

      if (page === 1) {
        totalPages = Math.ceil(
          (data.total_count || 0) / (data.per_page || 100)
        );
      }

      if (data.performances && data.performances.length > 0) {
        allPerformances = allPerformances.concat(data.performances);
      }

      page++;
    } while (page <= totalPages);

    return allPerformances;
  } catch (error) {
    logError(error, {
      operation: "fetchAllPerformances",
      performerId,
      performerName,
    });
    throw error;
  }
}

class HelloTicketsPricesWorker {
  constructor() {
    this.isRunning = false;
    this.scheduledJob = null;
  }

  // Connect to MongoDB
  async connectToDatabase() {
    try {
      if (mongoose.connection.readyState === 1) {
        return; // Already connected
      }

      logWithCheckpoint(
        "info",
        "Connecting to MongoDB",
        "HT_PRICES_WORKER_001"
      );

      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 30000,
      });

      logWithCheckpoint(
        "info",
        "Successfully connected to MongoDB",
        "HT_PRICES_WORKER_002"
      );
    } catch (error) {
      logError(error, { operation: "connectToDatabase" });
      throw error;
    }
  }

  // Main function to update prices for a specific league
  async updateLeaguePrices(leagueSlug) {
    if (this.isRunning) {
      logWithCheckpoint(
        "warn",
        "HelloTickets price update already running, skipping",
        "HT_PRICES_WORKER_003",
        { leagueSlug }
      );
      return;
    }

    this.isRunning = true;

    try {
      logWithCheckpoint(
        "info",
        `Starting HelloTickets price update for league: ${leagueSlug}`,
        "HT_PRICES_WORKER_004",
        { leagueSlug }
      );

      const supplier = await Supplier.findOne({ slug: "hellotickets" });
      if (!supplier) {
        throw new Error('Supplier "hellotickets" not found');
      }

      const league = await League.findOne({ slug: leagueSlug });
      if (!league) {
        throw new Error(`League "${leagueSlug}" not found`);
      }

      // Get all teams with HelloTickets IDs for this league
      const teams = await Team.find({
        leagueIds: league._id,
      })
        .select("name_en name slug suppliersInfo")
        .lean();

      const teamsWithHT = teams.filter((team) => {
        const htInfo = team.suppliersInfo?.find(
          (s) => s.supplierRef?.toString() === supplier._id.toString()
        );
        return htInfo?.supplierExternalId;
      });

      logWithCheckpoint(
        "info",
        `Found ${teamsWithHT.length} teams with HelloTickets ID`,
        "HT_PRICES_WORKER_005",
        { totalTeams: teams.length, teamsWithHT: teamsWithHT.length }
      );

      // API call counter
      const apiCallCounter = { count: 0 };

      // Fetch all performances for all teams (one API call per team)
      const allHTPerformances = new Map();
      let teamIndex = 0;

      for (const team of teamsWithHT) {
        teamIndex++;
        const htInfo = team.suppliersInfo.find(
          (s) => s.supplierRef?.toString() === supplier._id.toString()
        );
        const htId = htInfo.supplierExternalId;
        const teamName = team.name_en || team.name;

        try {
          const performances = await fetchAllPerformances(
            htId,
            teamName,
            apiCallCounter
          );

          performances.forEach((perf) => {
            const perfId = perf.id.toString();
            if (!allHTPerformances.has(perfId)) {
              allHTPerformances.set(perfId, perf);
            }
          });

          logWithCheckpoint(
            "info",
            `Fetched HelloTickets matches for ${teamName}`,
            "HT_PRICES_WORKER_006",
            {
              team: teamName,
              matches: performances.length,
              total: allHTPerformances.size,
            }
          );

          // Small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          logError(error, {
            operation: "fetchTeamPerformances",
            team: teamName,
            htId,
          });
          continue;
        }
      }

      // Get all Premier League matches with HelloTickets mapping
      const now = new Date();
      const dbMatches = await FootballEvent.find({
        league: league._id,
        date: { $gte: now },
        "supplierExternalIds.supplierRef": supplier._id,
      })
        .populate("homeTeam", "name slug")
        .populate("awayTeam", "name slug")
        .lean();

      logWithCheckpoint(
        "info",
        `Found ${dbMatches.length} matches to update for ${league.name}`,
        "HT_PRICES_WORKER_007",
        { leagueSlug, leagueName: league.name, matchCount: dbMatches.length }
      );

      const stats = {
        matchesUpdated: 0,
        matchesSkipped: 0,
        offersUpdated: 0,
        offersCreated: 0,
        offersSkipped: 0,
        errors: 0,
        apiCalls: 0,
        matchesDetails: [],
        minPriceUpdates: 0,
      };

      for (let i = 0; i < dbMatches.length; i++) {
        const dbMatch = dbMatches[i];

        try {
          const htMapping = dbMatch.supplierExternalIds?.find((s) => {
            const supplierId =
              s.supplierRef?._id?.toString() || s.supplierRef?.toString();
            return supplierId === supplier._id.toString();
          });

          if (!htMapping || !htMapping.supplierExternalId) {
            stats.matchesSkipped++;
            continue;
          }

          const htPerformanceId = htMapping.supplierExternalId.toString();
          const htPerf = allHTPerformances.get(htPerformanceId);

          if (!htPerf) {
            stats.matchesSkipped++;
            continue;
          }

          let needsUpdate = false;

          // Get price info for Offer and metadata
          const expectedMinPrice = htPerf.price_range?.min_price;
          const expectedCurrency = htPerf.price_range?.currency || "EUR";

          // Check and update URLs in metadata
          const expectedUrl = htPerf.url;
          const expectedAffiliateUrl = addAffiliateLink(expectedUrl);

          const metadata = htMapping.metadata || new Map();
          const actualUrl =
            metadata instanceof Map ? metadata.get("url") : metadata?.url;
          const actualAffiliateUrl =
            metadata instanceof Map
              ? metadata.get("affiliateUrl")
              : metadata?.affiliateUrl;

          if (
            actualUrl !== expectedUrl ||
            actualAffiliateUrl !== expectedAffiliateUrl
          ) {
            const newMetadata = new Map();
            newMetadata.set("url", expectedUrl);
            newMetadata.set("affiliateUrl", expectedAffiliateUrl);
            newMetadata.set("minPrice", expectedMinPrice);
            newMetadata.set("maxPrice", htPerf.price_range?.max_price);
            newMetadata.set("currency", expectedCurrency);

            // Update supplierExternalIds metadata
            await FootballEvent.findByIdAndUpdate(dbMatch._id, {
              $pull: { supplierExternalIds: { supplierRef: supplier._id } },
            });

            await FootballEvent.findByIdAndUpdate(dbMatch._id, {
              $push: {
                supplierExternalIds: {
                  supplierRef: supplier._id,
                  supplierExternalId: htPerformanceId,
                  metadata: newMetadata,
                },
              },
            });

            needsUpdate = true;
          }

          if (needsUpdate) {
            stats.matchesUpdated++;
          } else {
            stats.matchesSkipped++;
          }

          // Check and update/create Offer
          if (expectedMinPrice && expectedAffiliateUrl) {
            // Get current minPrice before update
            const fixtureBeforeUpdate = await FootballEvent.findById(
              dbMatch._id
            ).lean();
            const minPriceBefore = fixtureBeforeUpdate?.minPrice
              ? {
                  amount: fixtureBeforeUpdate.minPrice.amount,
                  currency: fixtureBeforeUpdate.minPrice.currency,
                }
              : null;

            const offerData = {
              fixtureId: dbMatch._id,
              ownerType: "Supplier",
              ownerId: supplier._id,
              price: expectedMinPrice,
              currency: expectedCurrency,
              ticketType: "standard",
              isHospitality: false,
              isAvailable: true,
              url: expectedAffiliateUrl,
            };

            const existingOffer = await Offer.findOne({
              fixtureId: dbMatch._id,
              ownerType: "Supplier",
              ownerId: supplier._id,
            }).lean();

            let offerChanged = false;
            let offerAction = "skipped";

            if (existingOffer) {
              if (
                existingOffer.price !== offerData.price ||
                existingOffer.currency !== offerData.currency ||
                existingOffer.url !== offerData.url
              ) {
                await Offer.findByIdAndUpdate(existingOffer._id, {
                  $set: offerData,
                });
                stats.offersUpdated++;
                offerChanged = true;
                offerAction = "updated";
              } else {
                stats.offersSkipped++;
                offerAction = "skipped";
              }
            } else {
              const newOffer = new Offer(offerData);
              await newOffer.save();
              stats.offersCreated++;
              offerChanged = true;
              offerAction = "created";
            }

            // עדכון minPrice של המשחק לפי ההצעה הכי זולה מכל הספקים
            // (לא רק HelloTickets - updateFixtureMinPrice מחפש את ההצעה הכי זולה)
            let minPriceUpdated = false;
            try {
              const updateResult = await updateFixtureMinPrice(dbMatch._id, {
                refreshCache: false, // לא לרענן cache כאן כי זה worker שמעדכן הרבה משחקים
              });
              if (updateResult?.updated) {
                minPriceUpdated = true;
                stats.minPriceUpdates++;
              }
            } catch (error) {
              logError(error, {
                operation: "updateFixtureMinPrice in worker",
                fixtureId: dbMatch._id,
              });
              // ממשיכים גם אם יש שגיאה בעדכון minPrice
            }

            // Get minPrice after update
            const fixtureAfterUpdate = await FootballEvent.findById(
              dbMatch._id
            ).lean();
            const minPriceAfter = fixtureAfterUpdate?.minPrice
              ? {
                  amount: fixtureAfterUpdate.minPrice.amount,
                  currency: fixtureAfterUpdate.minPrice.currency,
                }
              : null;

            // Add match details to stats
            stats.matchesDetails.push({
              fixtureId: dbMatch._id.toString(),
              slug: dbMatch.slug,
              homeTeam: dbMatch.homeTeam?.name || "Unknown",
              awayTeam: dbMatch.awayTeam?.name || "Unknown",
              date: dbMatch.date,
              offerAction: offerAction,
              offerPrice: expectedMinPrice,
              offerCurrency: expectedCurrency,
              minPriceBefore: minPriceBefore,
              minPriceAfter: minPriceAfter,
              minPriceUpdated: minPriceUpdated,
            });
          } else {
            // No offer created/updated - still add to details
            stats.matchesDetails.push({
              fixtureId: dbMatch._id.toString(),
              slug: dbMatch.slug,
              homeTeam: dbMatch.homeTeam?.name || "Unknown",
              awayTeam: dbMatch.awayTeam?.name || "Unknown",
              date: dbMatch.date,
              offerAction: "skipped",
              reason: !expectedMinPrice
                ? "no_price"
                : !expectedAffiliateUrl
                ? "no_url"
                : "unknown",
            });
          }
        } catch (error) {
          stats.errors++;
          logError(error, {
            operation: "updateMatchPrice",
            matchSlug: dbMatch.slug,
            matchId: dbMatch._id,
          });
        }
      }

      // Add API calls count to stats
      stats.apiCalls = apiCallCounter.count;

      logWithCheckpoint(
        "info",
        `HelloTickets price update completed for ${league.name}`,
        "HT_PRICES_WORKER_008",
        {
          leagueSlug,
          leagueName: league.name,
          ...stats,
          matchesDetailsCount: stats.matchesDetails.length,
        }
      );

      return {
        leagueSlug,
        leagueName: league.name,
        ...stats,
        matchesDetails: stats.matchesDetails,
      };
    } catch (error) {
      logError(error, { operation: "updateLeaguePrices", leagueSlug });
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  // Update prices for multiple leagues
  async updateMultipleLeagues(leagueSlugs) {
    const results = [];

    for (const leagueSlug of leagueSlugs) {
      try {
        logWithCheckpoint(
          "info",
          `Processing HelloTickets league: ${leagueSlug}`,
          "HT_PRICES_WORKER_015",
          { leagueSlug, remaining: leagueSlugs.length - results.length }
        );

        const result = await this.updateLeaguePrices(leagueSlug);
        results.push(result);

        // Small delay between leagues to avoid overwhelming the API
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        logError(error, { operation: "updateMultipleLeagues", leagueSlug });
        results.push({ leagueSlug, error: error.message });
      }
    }

    return results;
  }

  // Main function to update Premier League prices (backward compatibility)
  async updatePremierLeaguePrices() {
    return await this.updateLeaguePrices("epl");
  }

  // Schedule recurring price update (runs hourly from 8 AM to midnight)
  start() {
    if (this.scheduledJob) {
      logWithCheckpoint(
        "warn",
        "HelloTickets price update job already scheduled",
        "HT_PRICES_WORKER_009"
      );
      return;
    }

    // Cron expression: runs at minute 0, from hour 8 to 23 and also at 0 (midnight), every day
    // This means: 0:00, 8:00, 9:00, 10:00, ..., 23:00 (17 times per day - from midnight until 11 PM)
    const cronExpression = "0 0,8-23 * * *";

    logWithCheckpoint(
      "info",
      "Scheduling HelloTickets price update job",
      "HT_PRICES_WORKER_010",
      {
        cronExpression,
        schedule: "Hourly from 8:00 AM to midnight (00:00, 8:00-23:00)",
        leagues: LEAGUES_TO_UPDATE,
      }
    );

    this.scheduledJob = cron.schedule(
      cronExpression,
      async () => {
        try {
          await this.connectToDatabase();
          const result = await this.updateMultipleLeagues(LEAGUES_TO_UPDATE);
          saveResults(result);
        } catch (error) {
          logError(error, { operation: "scheduledPriceUpdate" });
          saveResults(null, null, error);
        }
      },
      {
        scheduled: true,
        // Using system timezone - adjust if needed via environment variable
        timezone: process.env.TZ || undefined,
      }
    );

    logWithCheckpoint(
      "info",
      "HelloTickets price update job scheduled successfully",
      "HT_PRICES_WORKER_011",
      {
        cronExpression,
        nextRun: this.scheduledJob.nextDate(),
      }
    );
  }

  // Stop the scheduled job
  stop() {
    if (this.scheduledJob) {
      this.scheduledJob.stop();
      this.scheduledJob.destroy();
      this.scheduledJob = null;
      logWithCheckpoint(
        "info",
        "HelloTickets price update job stopped",
        "HT_PRICES_WORKER_012"
      );
    }
  }

  // Get job status
  getStatus() {
    return {
      isRunning: this.isRunning,
      isScheduled: this.scheduledJob !== null,
      nextRun: this.scheduledJob?.nextDate() || null,
    };
  }
}

// Create worker instance
const helloTicketsPricesWorker = new HelloTicketsPricesWorker();

// Handle uncaught exceptions - prevent worker crash
process.on("uncaughtException", (error) => {
  logError(error, {
    operation: "uncaughtException",
    worker: "helloTicketsPricesWorker",
  });
  logWithCheckpoint(
    "error",
    "Uncaught exception in HelloTickets prices worker - shutting down gracefully",
    "HT_PRICES_WORKER_015",
    { error: error.message }
  );
  // Stop the worker and exit
  try {
    helloTicketsPricesWorker.stop();
  } catch (stopError) {
    logError(stopError, { operation: "stopWorkerOnError" });
  }
  process.exit(1);
});

// Handle unhandled promise rejections - prevent worker crash
process.on("unhandledRejection", (reason, promise) => {
  logError(new Error(`Unhandled Rejection at: ${promise}, reason: ${reason}`), {
    operation: "unhandledRejection",
    worker: "helloTicketsPricesWorker",
  });
  logWithCheckpoint(
    "error",
    "Unhandled rejection in HelloTickets prices worker",
    "HT_PRICES_WORKER_016",
    { reason: reason?.toString() || "Unknown" }
  );
  // Note: We don't exit on unhandled rejection to allow the worker to continue
  // but we log it for monitoring
});

// Handle process termination
process.on("SIGINT", async () => {
  logWithCheckpoint(
    "info",
    "Received SIGINT, shutting down HelloTickets prices worker gracefully",
    "HT_PRICES_WORKER_013"
  );

  try {
    helloTicketsPricesWorker.stop();
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(0);
  } catch (error) {
    logError(error, { operation: "gracefulShutdown" });
    process.exit(1);
  }
});

process.on("SIGTERM", async () => {
  logWithCheckpoint(
    "info",
    "Received SIGTERM, shutting down HelloTickets prices worker gracefully",
    "HT_PRICES_WORKER_014"
  );

  try {
    helloTicketsPricesWorker.stop();
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(0);
  } catch (error) {
    logError(error, { operation: "gracefulShutdown" });
    process.exit(1);
  }
});

// CLI interface for manual execution or starting the worker
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  if (args.includes("--start")) {
    // Start the worker with cron scheduling
    (async () => {
      try {
        await helloTicketsPricesWorker.connectToDatabase();
        helloTicketsPricesWorker.start();
        console.log("✅ HelloTickets prices worker started and scheduled");
        console.log(
          "📅 Schedule: Hourly from 8:00 AM to midnight (00:00, 8:00-23:00)"
        );
        console.log(`🏆 Leagues to update: ${LEAGUES_TO_UPDATE.join(", ")}`);
        console.log(
          `⏰ Next run: ${helloTicketsPricesWorker.getStatus().nextRun}`
        );
      } catch (error) {
        console.error("❌ Failed to start worker:", error);
        process.exit(1);
      }
    })();
  } else if (args.includes("--run-once")) {
    // Run once immediately (for testing) - EPL only
    (async () => {
      try {
        await helloTicketsPricesWorker.connectToDatabase();
        console.log(
          "🏆 Updating HelloTickets prices for: epl (Premier League)"
        );
        const result = await helloTicketsPricesWorker.updateLeaguePrices("epl");

        // Output as JSON
        const output = {
          success: true,
          league: {
            slug: result.leagueSlug,
            name: result.leagueName,
          },
          summary: {
            apiCalls: result.apiCalls,
            matchesUpdated: result.matchesUpdated,
            matchesSkipped: result.matchesSkipped,
            offersCreated: result.offersCreated,
            offersUpdated: result.offersUpdated,
            offersSkipped: result.offersSkipped,
            minPriceUpdates: result.minPriceUpdates,
            errors: result.errors,
          },
          matchesDetails: result.matchesDetails || [],
        };

        // Save to file and also print to console
        const fs = await import("fs");
        const outputPath =
          process.env.WORKER_OUTPUT_PATH ||
          "/tmp/hellotickets_worker_result.json";
        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf8");
        console.log("\n" + JSON.stringify(output, null, 2));
        console.log(`\n✅ Results also saved to: ${outputPath}`);

        // Save results to new location as well
        const savedPath = saveResults(result, result.leagueSlug);
        if (savedPath) {
          console.log(`✅ Results also saved to: ${savedPath}`);
        }

        await mongoose.disconnect();
        process.exit(0);
      } catch (error) {
        const errorOutput = {
          success: false,
          error: error.message,
          stack: error.stack,
        };
        console.error("\n" + JSON.stringify(errorOutput, null, 2));

        // Save error results to file
        const savedPath = saveResults(null, "epl", error);
        if (savedPath) {
          console.log(`\n⚠️ Error results saved to: ${savedPath}`);
        }

        process.exit(1);
      }
    })();
  } else {
    console.log("Usage:");
    console.log(
      "  --start     Start the HelloTickets prices worker with cron scheduling"
    );
    console.log(
      "  --run-once  Run HelloTickets price update once (for testing)"
    );
    process.exit(1);
  }
}

export default helloTicketsPricesWorker;
