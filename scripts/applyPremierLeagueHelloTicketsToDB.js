import "dotenv/config";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { fileURLToPath } from "url";

import FootballEvent from "../src/models/FootballEvent.js";
import Supplier from "../src/models/Supplier.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.resolve(
  __dirname,
  "../data/premier_league_matches_hellotickets.json"
);
const PREMIER_LEAGUE_ID = "68d6809aa0fb97844d2084b9";
const SUPPLIER_SLUG = "hellotickets";

function loadMatchesFromFile() {
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed.matches || !Array.isArray(parsed.matches)) {
    throw new Error("Invalid data file: missing matches array");
  }
  return {
    fetchedAt: parsed.fetched_at,
    matches: parsed.matches,
  };
}

function buildMetadata(match, fetchedAt) {
  const metadata = {
    helloTicketsUrl: match.helloTicketsUrl || null,
    helloTicketsAffiliateUrl: match.helloTicketsAffiliateUrl || null,
    minPrice: match.minPrice ?? null,
    maxPrice: match.maxPrice ?? null,
    currency: match.currency || null,
    ticketGroupsCount: match.ticketGroupsCount ?? null,
    helloTicketsEventId: match.helloTicketsEventId ?? null,
    sourceFileFetchedAt: fetchedAt || null,
    sourceFileEventDate: match.eventDate || null,
    localEventSlug: match.localEventSlug || null,
  };

  // Remove null values to keep metadata compact
  Object.keys(metadata).forEach((key) => {
    if (metadata[key] === null || metadata[key] === undefined) {
      delete metadata[key];
    }
  });

  return metadata;
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

    const { fetchedAt, matches } = loadMatchesFromFile();
    const now = new Date();

    const stats = {
      totalInFile: matches.length,
      eligible: 0,
      updated: 0,
      skippedPast: 0,
      skippedNoLocalId: 0,
      skippedNoMatchId: 0,
      notFoundInDB: 0,
      wrongLeague: 0,
      noChangesNeeded: 0,
    };

    console.log(
      `📄 Loaded ${matches.length} matches from file (fetched_at=${fetchedAt})`
    );

    for (const match of matches) {
      if (!match.localEventId) {
        stats.skippedNoLocalId++;
        continue;
      }
      if (!match.htPerformanceId) {
        stats.skippedNoMatchId++;
        continue;
      }

      const event = await FootballEvent.findById(match.localEventId);
      if (!event) {
        stats.notFoundInDB++;
        continue;
      }

      if (event.league?.toString() !== PREMIER_LEAGUE_ID) {
        stats.wrongLeague++;
        continue;
      }

      if (event.date < now) {
        stats.skippedPast++;
        continue;
      }

      stats.eligible++;

      const metadata = buildMetadata(match, fetchedAt);

      let changed = false;

      // Update supplierExternalIds
      let supplierExternalIds = event.supplierExternalIds || [];
      supplierExternalIds = supplierExternalIds.filter(
        (entry) => entry.supplierRef.toString() !== supplier._id.toString()
      );

      supplierExternalIds.push({
        supplierRef: supplier._id,
        supplierExternalId: match.htPerformanceId.toString(),
        metadata,
      });
      event.supplierExternalIds = supplierExternalIds;
      changed = true;

      // Update minPrice if available
      if (match.minPrice !== undefined && match.minPrice !== null) {
        event.minPrice = {
          amount: match.minPrice,
          currency: match.currency || "EUR",
          updatedAt: new Date(),
        };
        changed = true;
      }

      if (changed) {
        await event.save();
        stats.updated++;
      } else {
        stats.noChangesNeeded++;
      }
    }

    console.log("\n📊 Update Summary:");
    console.log("-------------------");
    console.log(`Total matches in file: ${stats.totalInFile}`);
    console.log(`Processed (future PL matches in DB): ${stats.eligible}`);
    console.log(`✅ Updated events: ${stats.updated}`);
    console.log(`⚠️  Skipped (past events): ${stats.skippedPast}`);
    console.log(`⚠️  Skipped (missing localEventId): ${stats.skippedNoLocalId}`);
    console.log(`⚠️  Skipped (missing HelloTickets ID): ${stats.skippedNoMatchId}`);
    console.log(`❌ Missing in DB: ${stats.notFoundInDB}`);
    console.log(`❌ Wrong league in DB: ${stats.wrongLeague}`);
    console.log(`ℹ️  No changes needed: ${stats.noChangesNeeded}`);
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

