import dotenv from "dotenv";
import mongoose from "mongoose";
import Team from "../src/models/Team.js";
import Venue from "../src/models/Venue.js";
import { logWithCheckpoint, logError } from "../src/utils/logger.js";

dotenv.config();

async function run() {
  try {
    logWithCheckpoint("info", "Starting teamId backfill", "MIG_001");
    await mongoose.connect(process.env.MONGODB_URI);
    logWithCheckpoint("info", "Connected to MongoDB", "MIG_002");

    // 1) shortName -> code למסמכים ישנים (אם נשארו)
    const renameRes = await Team.updateMany({ shortName: { $exists: true } }, [
      { $set: { code: "$shortName" } },
      { $unset: "shortName" },
    ]);
    logWithCheckpoint("info", "Renamed shortName -> code", "MIG_003", {
      matched: renameRes.matchedCount,
      modified: renameRes.modifiedCount,
    });

    // 2) מילוי teamId מתוך externalIds.apiFootball
    const teams = await Team.find({
      teamId: { $exists: false },
      "externalIds.apiFootball": { $exists: true },
    }).lean();

    let updatedTeamIds = 0;
    for (const t of teams) {
      const teamId = Number(t.externalIds.apiFootball);
      if (!Number.isNaN(teamId)) {
        await Team.updateOne({ _id: t._id }, { $set: { teamId } });
        updatedTeamIds++;
      }
    }
    logWithCheckpoint("info", "Backfilled teamId", "MIG_004", {
      updatedTeamIds,
    });

    // 3) וידוא venueId (כבר אמור להיות קיים, נשאיר בדיקה בלבד)
    const missingVenue = await Team.find({
      $or: [{ venueId: { $exists: false } }, { venueId: null }],
    }).countDocuments();
    logWithCheckpoint("info", "Checked venue links", "MIG_005", {
      missingVenue,
    });

    // 4) דוגמה
    const sample = await Team.find({})
      .select("name code teamId venueId")
      .populate("venueId", "name city")
      .limit(5)
      .lean();

    console.log("\nSample teams:");
    sample.forEach((s) =>
      console.log(
        `${s.name} (${s.code}) teamId=${s.teamId} -> venue=${
          s.venueId?.name || "N/A"
        }`
      )
    );

    logWithCheckpoint("info", "Migration done", "MIG_006");
  } catch (err) {
    logError(err, { operation: "migrateTeamId" });
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

run();
