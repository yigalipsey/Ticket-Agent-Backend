import dotenv from "dotenv";
import mongoose from "mongoose";
import Venue from "../src/models/Venue.js";
import { logWithCheckpoint, logError } from "../src/utils/logger.js";

dotenv.config();

async function run() {
  try {
    logWithCheckpoint("info", "Starting venueId backfill", "VENUE_MIG_001");
    await mongoose.connect(process.env.MONGODB_URI);
    logWithCheckpoint("info", "Connected to MongoDB", "VENUE_MIG_002");

    // 1) מילוי venueId מתוך externalIds.apiFootball
    const venues = await Venue.find({
      venueId: { $exists: false },
      "externalIds.apiFootball": { $exists: true }
    }).lean();

    let updatedVenueIds = 0;
    for (const v of venues) {
      const venueId = Number(v.externalIds.apiFootball);
      if (!Number.isNaN(venueId)) {
        await Venue.updateOne({ _id: v._id }, { $set: { venueId } });
        updatedVenueIds++;
      }
    }
    logWithCheckpoint("info", "Backfilled venueId", "VENUE_MIG_003", {
      updatedVenueIds,
    });

    // 2) המרת externalIds.apiFootball מ-String ל-Number
    const stringVenues = await Venue.find({
      "externalIds.apiFootball": { $type: "string" }
    }).lean();

    let convertedExternalIds = 0;
    for (const v of stringVenues) {
      const numericId = Number(v.externalIds.apiFootball);
      if (!Number.isNaN(numericId)) {
        await Venue.updateOne(
          { _id: v._id },
          { $set: { "externalIds.apiFootball": numericId } }
        );
        convertedExternalIds++;
      }
    }
    logWithCheckpoint("info", "Converted externalIds to Number", "VENUE_MIG_004", {
      convertedExternalIds,
    });

    // 3) דוגמה
    const sample = await Venue.find({})
      .select("name city capacity venueId externalIds")
      .limit(5)
      .lean();

    console.log("\nSample venues:");
    sample.forEach((s) =>
      console.log(
        `${s.name} (${s.city}) venueId=${s.venueId} externalId=${s.externalIds?.apiFootball}`
      )
    );

    logWithCheckpoint("info", "Venue migration done", "VENUE_MIG_005");
  } catch (err) {
    logError(err, { operation: "migrateVenueId" });
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

run();
