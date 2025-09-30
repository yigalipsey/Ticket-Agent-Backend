import mongoose from "mongoose";
import { config } from "dotenv";
import Team from "../src/models/Team.js";

config();

async function connectToDatabase() {
  try {
    const mongoUri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/ticketagent";
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ Error connecting to MongoDB:", error);
    process.exit(1);
  }
}

async function migrateTeamFields() {
  await connectToDatabase();

  try {
    console.log("🚀 Starting to migrate team fields...");

    // Get all teams
    const teams = await Team.find({}).lean();
    console.log(`📊 Found ${teams.length} teams to process`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const team of teams) {
      let hasUpdates = false;
      const updateData = {};

      // Check if name exists but name_en doesn't
      if (team.name && !team.name_en) {
        updateData.name_en = team.name;
        hasUpdates = true;
        console.log(`🏷️  Adding name_en for ${team.slug}: ${team.name}`);
      }

      // Check if country exists but country_en doesn't
      if (team.country && !team.country_en) {
        updateData.country_en = team.country;
        hasUpdates = true;
        console.log(`🌍 Adding country_en for ${team.slug}: ${team.country}`);
      }

      if (hasUpdates) {
        await Team.updateOne({ _id: team._id }, { $set: updateData });
        console.log(`✅ Updated team: ${team.slug}`);
        updatedCount++;
      } else {
        skippedCount++;
      }
    }

    console.log("\n📈 Summary:");
    console.log(`✅ Successfully updated: ${updatedCount} teams`);
    console.log(`⚠️  Skipped (no updates needed): ${skippedCount} teams`);
    console.log(`📊 Total processed: ${teams.length} teams`);
    console.log("\n🎉 Migration completed successfully!");
  } catch (error) {
    console.error("❌ Error migrating team fields:", error);
  } finally {
    await mongoose.disconnect();
    console.log("👋 Disconnected from MongoDB");
  }
}

migrateTeamFields();
