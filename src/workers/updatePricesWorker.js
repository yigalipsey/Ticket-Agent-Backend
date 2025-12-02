import "dotenv/config";
import mongoose from "mongoose";
import cron from "node-cron";
import axios from "axios";
import FootballEvent from "../models/FootballEvent.js";
import Supplier from "../models/Supplier.js";
import Offer from "../models/Offer.js";
import League from "../models/League.js";
import Team from "../models/Team.js";
import { logWithCheckpoint, logError } from "../utils/logger.js";

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
const API_KEY =
  process.env.HELLO_TICETS_API_KEY ||
  "pub-6a76dc10-12e5-466e-83d5-35b745c485a2";
const API_URL = "https://api-live.hellotickets.com/v1";
const AFFILIATE_PARAMS = "tap_a=141252-18675a&tap_s=8995852-00a564";

function addAffiliateLink(originalUrl) {
  if (!originalUrl) return null;
  const separator = originalUrl.includes("?") ? "&" : "?";
  return `${originalUrl}${separator}${AFFILIATE_PARAMS}`;
}

async function fetchAllPerformances(performerId, performerName) {
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

      const { data } = await axios.get(`${API_URL}/performances`, {
        params,
        headers: {
          Accept: "application/json",
          "X-Public-Key": API_KEY,
        },
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

class UpdatePricesWorker {
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

      logWithCheckpoint("info", "Connecting to MongoDB", "PRICE_WORKER_001");

      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 30000,
      });

      logWithCheckpoint(
        "info",
        "Successfully connected to MongoDB",
        "PRICE_WORKER_002"
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
        "Price update already running, skipping",
        "PRICE_WORKER_003",
        { leagueSlug }
      );
      return;
    }

    this.isRunning = true;

    try {
      logWithCheckpoint(
        "info",
        `Starting price update for league: ${leagueSlug}`,
        "PRICE_WORKER_004",
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
        "PRICE_WORKER_005",
        { totalTeams: teams.length, teamsWithHT: teamsWithHT.length }
      );

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
          const performances = await fetchAllPerformances(htId, teamName);

          performances.forEach((perf) => {
            const perfId = perf.id.toString();
            if (!allHTPerformances.has(perfId)) {
              allHTPerformances.set(perfId, perf);
            }
          });

          logWithCheckpoint(
            "info",
            `Fetched matches for ${teamName}`,
            "PRICE_WORKER_006",
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
        "PRICE_WORKER_007",
        { leagueSlug, leagueName: league.name, matchCount: dbMatches.length }
      );

      const stats = {
        matchesUpdated: 0,
        matchesSkipped: 0,
        offersUpdated: 0,
        offersCreated: 0,
        offersSkipped: 0,
        errors: 0,
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
          const updateData = {};

          // Check and update price
          const expectedMinPrice = htPerf.price_range?.min_price;
          const expectedCurrency = htPerf.price_range?.currency || "EUR";
          const actualMinPrice = dbMatch.minPrice?.amount;
          const actualCurrency = dbMatch.minPrice?.currency;

          if (
            expectedMinPrice !== undefined &&
            (actualMinPrice !== expectedMinPrice ||
              actualCurrency !== expectedCurrency)
          ) {
            updateData.minPrice = {
              amount: expectedMinPrice,
              currency: expectedCurrency,
              updatedAt: new Date(),
            };
            needsUpdate = true;
          }

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

          // Update minPrice if needed
          if (updateData.minPrice) {
            await FootballEvent.findByIdAndUpdate(dbMatch._id, {
              $set: updateData,
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
              } else {
                stats.offersSkipped++;
              }
            } else {
              const newOffer = new Offer(offerData);
              await newOffer.save();
              stats.offersCreated++;
            }
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

      logWithCheckpoint(
        "info",
        `Price update completed for ${league.name}`,
        "PRICE_WORKER_008",
        { leagueSlug, leagueName: league.name, ...stats }
      );

      return { leagueSlug, leagueName: league.name, ...stats };
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
          `Processing league: ${leagueSlug}`,
          "PRICE_WORKER_015",
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
        "Price update job already scheduled",
        "PRICE_WORKER_009"
      );
      return;
    }

    // Cron expression: runs at minute 0, from hour 8 to 23 and also at 0 (midnight), every day
    // This means: 0:00, 8:00, 9:00, 10:00, ..., 23:00 (17 times per day - from midnight until 11 PM)
    const cronExpression = "0 0,8-23 * * *";

    logWithCheckpoint(
      "info",
      "Scheduling price update job",
      "PRICE_WORKER_010",
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
          await this.updateMultipleLeagues(LEAGUES_TO_UPDATE);
        } catch (error) {
          logError(error, { operation: "scheduledPriceUpdate" });
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
      "Price update job scheduled successfully",
      "PRICE_WORKER_011",
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
      logWithCheckpoint("info", "Price update job stopped", "PRICE_WORKER_012");
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
const updatePricesWorker = new UpdatePricesWorker();

// Handle process termination
process.on("SIGINT", async () => {
  logWithCheckpoint(
    "info",
    "Received SIGINT, shutting down gracefully",
    "PRICE_WORKER_013"
  );

  try {
    updatePricesWorker.stop();
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
    "Received SIGTERM, shutting down gracefully",
    "PRICE_WORKER_014"
  );

  try {
    updatePricesWorker.stop();
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
        await updatePricesWorker.connectToDatabase();
        updatePricesWorker.start();
        console.log("✅ Price update worker started and scheduled");
        console.log(
          "📅 Schedule: Hourly from 8:00 AM to midnight (00:00, 8:00-23:00)"
        );
        console.log(`🏆 Leagues to update: ${LEAGUES_TO_UPDATE.join(", ")}`);
        console.log(`⏰ Next run: ${updatePricesWorker.getStatus().nextRun}`);
      } catch (error) {
        console.error("❌ Failed to start worker:", error);
        process.exit(1);
      }
    })();
  } else if (args.includes("--run-once")) {
    // Run once immediately (for testing) - all leagues
    (async () => {
      try {
        await updatePricesWorker.connectToDatabase();
        console.log(`🏆 Updating prices for: ${LEAGUES_TO_UPDATE.join(", ")}`);
        const results = await updatePricesWorker.updateMultipleLeagues(
          LEAGUES_TO_UPDATE
        );
        console.log("\n✅ Price update completed for all leagues:");
        results.forEach((result) => {
          if (result.error) {
            console.log(`  ❌ ${result.leagueSlug}: ${result.error}`);
          } else {
            console.log(
              `  ✅ ${result.leagueName} (${result.leagueSlug}): ${result.matchesUpdated} matches updated, ${result.offersUpdated} offers updated`
            );
          }
        });
        await mongoose.disconnect();
        process.exit(0);
      } catch (error) {
        console.error("❌ Price update failed:", error);
        process.exit(1);
      }
    })();
  } else {
    console.log("Usage:");
    console.log("  --start     Start the worker with cron scheduling");
    console.log("  --run-once  Run price update once (for testing)");
    process.exit(1);
  }
}

export default updatePricesWorker;
