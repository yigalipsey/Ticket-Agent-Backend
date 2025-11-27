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

// Paths
const RAW_RESPONSE_PATH = path.resolve(
  __dirname,
  "../data/hellotickets/champions_league_raw_response.json"
);

async function connectDB() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined in .env");
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB");
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
      name: perf.name,
      dateTime: perf.start_date?.date_time,
    });
  }

  return perfMap;
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
    console.log(`📥 Loaded ${htPerformances.size} performances from HelloTickets\n`);

    // 4. Find all Champions League events with HelloTickets mapping
    const dbEvents = await FootballEvent.find({
      league: championsLeague._id,
      "supplierExternalIds.supplierRef": supplier._id,
    })
      .populate("homeTeam", "name slug")
      .populate("awayTeam", "name slug")
      .lean();

    console.log(
      `🔍 Found ${dbEvents.length} Champions League events with HelloTickets mapping\n`
    );

    // 5. Verify each event
    const stats = {
      total: dbEvents.length,
      valid: 0,
      missingInJSON: [],
      missingUrl: [],
      missingAffiliateUrl: [],
      missingMinPrice: [],
      priceMismatch: [],
      invalidIds: [],
    };

    console.log("=".repeat(80));
    console.log("🔍 VERIFICATION REPORT");
    console.log("=".repeat(80));
    console.log("");

    for (const event of dbEvents) {
      // Find HelloTickets mapping
      const htMapping = event.supplierExternalIds.find(
        (m) => m.supplierRef.toString() === supplier._id.toString()
      );

      if (!htMapping || !htMapping.supplierExternalId) {
        stats.invalidIds.push({
          slug: event.slug,
          reason: "No HelloTickets mapping found",
        });
        continue;
      }

      const htPerformanceId = htMapping.supplierExternalId;
      const htPerf = htPerformances.get(htPerformanceId);

      if (!htPerf) {
        stats.missingInJSON.push({
          slug: event.slug,
          htId: htPerformanceId,
        });
        continue;
      }

      // Check URL
      const metadata = htMapping.metadata || {};
      const url = metadata.get ? metadata.get("url") : metadata.url;
      const affiliateUrl = metadata.get
        ? metadata.get("affiliateUrl")
        : metadata.affiliateUrl;

      if (!url) {
        stats.missingUrl.push({
          slug: event.slug,
          htId: htPerformanceId,
        });
      }

      if (!affiliateUrl) {
        stats.missingAffiliateUrl.push({
          slug: event.slug,
          htId: htPerformanceId,
        });
      }

      // Check minPrice
      if (!event.minPrice || !event.minPrice.amount) {
        stats.missingMinPrice.push({
          slug: event.slug,
          htId: htPerformanceId,
        });
      } else if (event.minPrice.amount !== htPerf.minPrice) {
        stats.priceMismatch.push({
          slug: event.slug,
          htId: htPerformanceId,
          dbPrice: event.minPrice.amount,
          htPrice: htPerf.minPrice,
        });
      }

      // If all checks pass
      if (
        htPerf &&
        url &&
        affiliateUrl &&
        event.minPrice &&
        event.minPrice.amount === htPerf.minPrice
      ) {
        stats.valid++;
      }
    }

    // 6. Display results
    console.log(`📊 VERIFICATION RESULTS:\n`);
    console.log(`✅ Valid events: ${stats.valid}/${stats.total}`);
    console.log(`❌ Issues found: ${stats.total - stats.valid}\n`);

    if (stats.missingInJSON.length > 0) {
      console.log(`⚠️  Missing in JSON (${stats.missingInJSON.length}):`);
      stats.missingInJSON.forEach((item) => {
        console.log(`   - ${item.slug} (HT ID: ${item.htId})`);
      });
      console.log("");
    }

    if (stats.missingUrl.length > 0) {
      console.log(`⚠️  Missing URL (${stats.missingUrl.length}):`);
      stats.missingUrl.forEach((item) => {
        console.log(`   - ${item.slug} (HT ID: ${item.htId})`);
      });
      console.log("");
    }

    if (stats.missingAffiliateUrl.length > 0) {
      console.log(`⚠️  Missing Affiliate URL (${stats.missingAffiliateUrl.length}):`);
      stats.missingAffiliateUrl.forEach((item) => {
        console.log(`   - ${item.slug} (HT ID: ${item.htId})`);
      });
      console.log("");
    }

    if (stats.missingMinPrice.length > 0) {
      console.log(`⚠️  Missing Min Price (${stats.missingMinPrice.length}):`);
      stats.missingMinPrice.forEach((item) => {
        console.log(`   - ${item.slug} (HT ID: ${item.htId})`);
      });
      console.log("");
    }

    if (stats.priceMismatch.length > 0) {
      console.log(`⚠️  Price Mismatch (${stats.priceMismatch.length}):`);
      stats.priceMismatch.forEach((item) => {
        console.log(
          `   - ${item.slug} (HT ID: ${item.htId}): DB=${item.dbPrice} EUR, HT=${item.htPrice} EUR`
        );
      });
      console.log("");
    }

    if (stats.invalidIds.length > 0) {
      console.log(`⚠️  Invalid IDs (${stats.invalidIds.length}):`);
      stats.invalidIds.forEach((item) => {
        console.log(`   - ${item.slug}: ${item.reason}`);
      });
      console.log("");
    }

    // 7. Check for HT performances not in DB
    const dbHtIds = new Set();
    dbEvents.forEach((event) => {
      const htMapping = event.supplierExternalIds.find(
        (m) => m.supplierRef.toString() === supplier._id.toString()
      );
      if (htMapping && htMapping.supplierExternalId) {
        dbHtIds.add(htMapping.supplierExternalId);
      }
    });

    const missingInDB = [];
    htPerformances.forEach((perf, htId) => {
      if (!dbHtIds.has(htId)) {
        missingInDB.push({
          htId,
          name: perf.name,
          dateTime: perf.dateTime,
        });
      }
    });

    if (missingInDB.length > 0) {
      console.log(`⚠️  HelloTickets performances NOT in DB (${missingInDB.length}):`);
      missingInDB.forEach((item) => {
        console.log(`   - ${item.name} (HT ID: ${item.htId}, Date: ${item.dateTime})`);
      });
      console.log("");
    }

    // 8. Summary
    console.log("=".repeat(80));
    console.log("📋 SUMMARY");
    console.log("=".repeat(80));
    console.log(`Total DB events with HT mapping: ${stats.total}`);
    console.log(`✅ Fully valid: ${stats.valid}`);
    console.log(`❌ Issues: ${stats.total - stats.valid}`);
    console.log(`📥 HT performances in JSON: ${htPerformances.size}`);
    console.log(`🔗 HT performances mapped in DB: ${dbHtIds.size}`);
    console.log(`⚠️  HT performances not in DB: ${missingInDB.length}`);

    if (stats.valid === stats.total && missingInDB.length === 0) {
      console.log("\n✅ All checks passed! Everything is valid.");
    } else {
      console.log("\n⚠️  Some issues found. Please review the report above.");
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




