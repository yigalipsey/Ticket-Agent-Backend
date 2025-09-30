import dotenv from "dotenv";
import mongoose from "mongoose";
import Team from "../src/models/Team.js";
import { logWithCheckpoint, logError } from "../src/utils/logger.js";

dotenv.config();

async function run() {
  try {
    logWithCheckpoint("info", "Starting team externalIds fix", "TEAM_FIX_001");
    await mongoose.connect(process.env.MONGODB_URI);
    logWithCheckpoint("info", "Connected to MongoDB", "TEAM_FIX_002");

    // המרת externalIds.apiFootball מ-String ל-Number
    const stringTeams = await Team.find({
      "externalIds.apiFootball": { $type: "string" }
    }).lean();

    let convertedExternalIds = 0;
    for (const t of stringTeams) {
      const numericId = Number(t.externalIds.apiFootball);
      if (!Number.isNaN(numericId)) {
        await Team.updateOne(
          { _id: t._id },
          { $set: { "externalIds.apiFootball": numericId } }
        );
        convertedExternalIds++;
      }
    }
    logWithCheckpoint("info", "Converted team externalIds to Number", "TEAM_FIX_003", {
      convertedExternalIds,
    });

    // דוגמה
    const sample = await Team.find({})
      .select("name code teamId externalIds")
      .limit(5)
      .lean();

    console.log("\nSample teams:");
    sample.forEach((s) =>
      console.log(
        `${s.name} (${s.code}) teamId=${s.teamId} externalId=${s.externalIds?.apiFootball}`
      )
    );

    logWithCheckpoint("info", "Team externalIds fix done", "TEAM_FIX_004");
  } catch (err) {
    logError(err, { operation: "fixTeamExternalIds" });
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

run();
