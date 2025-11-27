import "dotenv/config";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { fileURLToPath } from "url";

import FootballEvent from "../src/models/FootballEvent.js";
import Supplier from "../src/models/Supplier.js";
import Offer from "../src/models/Offer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RAW_FILE = path.resolve(
  __dirname,
  "../data/hellotickets/champions_league_raw_response.json"
);
const OUTPUT_SUMMARY = path.resolve(
  __dirname,
  "../data/hellotickets/champions_league_offers_summary.json"
);

const LEAGUE_ID = "68e257c87413ca349124a5e3";
const SUPPLIER_SLUG = "hellotickets";

const AFFILIATE_PARAMS = "tap_a=141252-18675a&tap_s=8995852-00a564";

function appendAffiliate(url) {
  if (!url) return null;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${AFFILIATE_PARAMS}`;
}

function loadRawPerformances() {
  const raw = JSON.parse(fs.readFileSync(RAW_FILE, "utf8"));
  return raw?.api_response?.performances || [];
}

async function run() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined");
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB");

  try {
    const supplier = await Supplier.findOne({ slug: SUPPLIER_SLUG });
    if (!supplier) {
      throw new Error(`Supplier '${SUPPLIER_SLUG}' not found`);
    }

    const performances = loadRawPerformances();
    const performanceMap = new Map(
      performances.map((perf) => [perf.id?.toString(), perf])
    );
    console.log(
      `📄 Loaded ${performances.length} Champions League performances`
    );

    const now = new Date();
    const events = await FootballEvent.find({
      league: LEAGUE_ID,
      date: { $gte: now },
      "supplierExternalIds.supplierRef": supplier._id,
    })
      .select("slug date supplierExternalIds")
      .lean();

    const stats = {
      totalEvents: events.length,
      matched: 0,
      offersCreated: 0,
      offersUpdated: 0,
      skippedNoPerformance: 0,
      skippedNoPrice: 0,
      skippedPastEvent: 0,
    };

    const unmatchedDetails = [];

    for (const event of events) {
      const mapping = event.supplierExternalIds?.find(
        (entry) => entry.supplierRef?.toString() === supplier._id.toString()
      );

      if (!mapping) {
        stats.skippedNoPerformance++;
        unmatchedDetails.push({
          reason: "missing_mapping",
          slug: event.slug,
        });
        continue;
      }

      if (event.date < now) {
        stats.skippedPastEvent++;
        continue;
      }

      const perf = performanceMap.get(mapping.supplierExternalId?.toString());
      if (!perf) {
        stats.skippedNoPerformance++;
        unmatchedDetails.push({
          reason: "performance_not_found",
          slug: event.slug,
          helloTicketsId: mapping.supplierExternalId,
        });
        continue;
      }

      const minPrice = perf.price_range?.min_price;
      if (minPrice === undefined || minPrice === null || minPrice <= 0) {
        stats.skippedNoPrice++;
        unmatchedDetails.push({
          reason: "missing_price",
          slug: event.slug,
          helloTicketsId: mapping.supplierExternalId,
        });
        continue;
      }

      const affiliateUrl = appendAffiliate(perf.url);

      const offer = await Offer.findOneAndUpdate(
        {
          fixtureId: event._id,
          ownerType: "Supplier",
          ownerId: supplier._id,
          ticketType: "standard",
        },
        {
          $set: {
            price: minPrice,
            currency: perf.price_range?.currency || "EUR",
            isHospitality: false,
            isAvailable: true,
            notes: affiliateUrl || perf.url || undefined,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      if (offer.createdAt?.getTime() === offer.updatedAt?.getTime()) {
        stats.offersCreated++;
      } else {
        stats.offersUpdated++;
      }

      stats.matched++;
    }

    fs.writeFileSync(
      OUTPUT_SUMMARY,
      JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          stats,
          unmatched: unmatchedDetails,
        },
        null,
        2
      ),
      "utf8"
    );

    console.log("\n📊 Champions League Offers Summary");
    console.log("----------------------------------");
    console.log(`Total events scanned: ${stats.totalEvents}`);
    console.log(`Matched events: ${stats.matched}`);
    console.log(`Offers created: ${stats.offersCreated}`);
    console.log(`Offers updated: ${stats.offersUpdated}`);
    console.log(
      `Skipped - no performance mapping: ${stats.skippedNoPerformance}`
    );
    console.log(`Skipped - missing price: ${stats.skippedNoPrice}`);
    console.log(`Skipped - past events: ${stats.skippedPastEvent}`);
    console.log(`📁 Detailed summary: ${OUTPUT_SUMMARY}`);
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
