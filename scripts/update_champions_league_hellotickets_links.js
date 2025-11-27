import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import FootballEvent from "../src/models/FootballEvent.js";
import League from "../src/models/League.js";
import Supplier from "../src/models/Supplier.js";
import Team from "../src/models/Team.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const DRY_RUN = false; // Set to false to actually update DB

// Affiliate parameters
const AFFILIATE_PARAMS = "tap_a=141252-18675a&tap_s=8995852-00a564";

// Paths
const RAW_RESPONSE_PATH = path.resolve(
  __dirname,
  "../data/hellotickets/champions_league_raw_response.json"
);

/**
 * Add affiliate parameters to URL
 */
function addAffiliateLink(originalUrl) {
  if (!originalUrl) return null;

  // Check if URL already has query parameters
  const separator = originalUrl.includes("?") ? "&" : "?";
  return `${originalUrl}${separator}${AFFILIATE_PARAMS}`;
}

/**
 * Load HelloTickets performances from raw response file
 */
function loadHelloTicketsPerformances() {
  const rawData = JSON.parse(fs.readFileSync(RAW_RESPONSE_PATH, "utf8"));
  const performances = rawData?.api_response?.performances || [];

  // Create a map: HT Performance ID -> Performance data
  const perfMap = new Map();
  for (const perf of performances) {
    perfMap.set(perf.id.toString(), {
      id: perf.id.toString(),
      url: perf.url,
      minPrice: perf.price_range?.min_price,
      maxPrice: perf.price_range?.max_price,
      currency: perf.price_range?.currency || "EUR",
    });
  }

  console.log(`📥 Loaded ${perfMap.size} performances from HelloTickets`);
  return perfMap;
}

async function connectDB() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined in .env");
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB");
}

async function run() {
  try {
    await connectDB();

    // 1. Find HelloTickets Supplier
    const supplier = await Supplier.findOne({ slug: "hellotickets" });
    if (!supplier) {
      throw new Error("HelloTickets supplier not found in database");
    }
    console.log(`✅ Found supplier: ${supplier.name} (${supplier._id})\n`);

    // 2. Find Champions League
    const championsLeague = await League.findOne({ slug: "champions-league" });
    if (!championsLeague) {
      throw new Error("Champions League not found in database");
    }
    console.log(
      `✅ Found league: ${championsLeague.name} (${championsLeague._id})\n`
    );

    // 3. Load HelloTickets performances
    const htPerformances = loadHelloTicketsPerformances();

    // 4. Find all Champions League events with HelloTickets mapping
    const dbEvents = await FootballEvent.find({
      league: championsLeague._id,
      "supplierExternalIds.supplierRef": supplier._id,
    });

    console.log(
      `🔍 Found ${dbEvents.length} Champions League events with HelloTickets mapping\n`
    );

    // 5. Update each event
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const event of dbEvents) {
      try {
        // Find HelloTickets mapping
        const htMapping = event.supplierExternalIds.find(
          (m) => m.supplierRef.toString() === supplier._id.toString()
        );

        if (!htMapping || !htMapping.supplierExternalId) {
          skipped++;
          continue;
        }

        const htPerformanceId = htMapping.supplierExternalId;
        const htPerf = htPerformances.get(htPerformanceId);

        if (!htPerf) {
          console.log(
            `⚠️  Performance ${htPerformanceId} not found in JSON for event ${event.slug}`
          );
          skipped++;
          continue;
        }

        let changed = false;

        // Update metadata with URLs
        if (!htMapping.metadata) {
          htMapping.metadata = new Map();
        }

        if (htPerf.url) {
          const originalUrl = htPerf.url;
          const affiliateUrl = addAffiliateLink(originalUrl);

          htMapping.metadata.set("url", originalUrl);
          htMapping.metadata.set("affiliateUrl", affiliateUrl);
          changed = true;
        }

        // Update minPrice
        if (htPerf.minPrice !== undefined && htPerf.minPrice !== null) {
          event.minPrice = {
            amount: htPerf.minPrice,
            currency: htPerf.currency,
            updatedAt: new Date(),
          };
          changed = true;
        }

        if (changed) {
          await event.save();
          updated++;
          console.log(
            `✅ Updated: ${event.slug} - Min Price: ${htPerf.minPrice || "N/A"} ${htPerf.currency || ""}`
          );
        } else {
          skipped++;
        }
      } catch (error) {
        console.error(
          `❌ Error updating event ${event.slug}:`,
          error.message
        );
        errors++;
      }
    }

    // 6. Display summary
    console.log("\n" + "=".repeat(80));
    console.log("📊 UPDATE SUMMARY");
    console.log("=".repeat(80));
    console.log(`✅ Updated: ${updated} events`);
    console.log(`⏭️  Skipped: ${skipped} events`);
    if (errors > 0) {
      console.log(`❌ Errors: ${errors} events`);
    }

    if (DRY_RUN) {
      console.log(
        "\n⚠️  DRY RUN MODE: No changes were made to the database."
      );
      console.log("   Set DRY_RUN = false to enable database updates.");
    }
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
}

run();

