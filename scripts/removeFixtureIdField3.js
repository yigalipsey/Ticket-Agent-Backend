import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function removeFixtureIdField() {
  try {
    console.log("🔄 Connecting to MongoDB...");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    console.log("🔄 Removing fixtureId field and index...");

    // Get the collection directly
    const db = mongoose.connection.db;
    const collection = db.collection('footballevents');

    // First, drop the fixtureId index
    try {
      await collection.dropIndex('fixtureId_1');
      console.log("✅ Dropped fixtureId index");
    } catch (error) {
      console.log("⚠️  Index fixtureId_1 not found or already dropped");
    }

    // Remove the fixtureId field from all documents
    const result = await collection.updateMany(
      { fixtureId: { $exists: true } },
      { $unset: { fixtureId: 1 } }
    );

    console.log(`🎉 Successfully removed fixtureId field from ${result.modifiedCount} documents`);

    // Verify no documents have fixtureId field
    const fixturesWithFixtureId = await collection.countDocuments({
      fixtureId: { $exists: true }
    });

    console.log(`✅ Verification: ${fixturesWithFixtureId} documents still have fixtureId field (should be 0)`);

    // Show a sample document
    const sampleDoc = await collection.findOne({});
    console.log("\n📋 Sample document structure:");
    console.log(JSON.stringify(sampleDoc, null, 2));

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
