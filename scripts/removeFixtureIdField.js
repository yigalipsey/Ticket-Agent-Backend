import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Import models
import FootballEvent from "../src/models/FootballEvent.js";
import Team from "../src/models/Team.js";
import League from "../src/models/League.js";

async function removeFixtureIdField() {
  try {
    console.log("🔄 Connecting to MongoDB...");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    console.log("🔄 Removing fixtureId field from existing documents...");

    // Remove the fixtureId field from all documents
    const result = await FootballEvent.updateMany(
      { fixtureId: { $exists: true } },
      { $unset: { fixtureId: 1 } }
    );

    console.log(`🎉 Successfully removed fixtureId field from ${result.modifiedCount} documents`);

    // Show updated documents
    const updatedFixtures = await FootballEvent.find({})
      .populate("homeTeam", "name")
      .populate("awayTeam", "name")
      .populate("league", "name")
      .sort({ date: 1 });

    console.log("\n📋 Updated Fixtures (without fixtureId):");
    updatedFixtures.forEach((fixture) => {
      console.log(`  - ${fixture.slug} (${fixture.homeTeam.name} vs ${fixture.awayTeam.name}) - External ID: ${fixture.externalIds.apiFootball}`);
    });

    // Verify no documents have fixtureId field
    const fixturesWithFixtureId = await FootballEvent.countDocuments({
      fixtureId: { $exists: true }
    });

    console.log(`\n✅ Verification: ${fixturesWithFixtureId} documents still have fixtureId field (should be 0)`);

  } catch (error) {
    console.error("❌ Error removing fixtureId field:", error);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

// Run the update
removeFixtureIdField();
