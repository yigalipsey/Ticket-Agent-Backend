import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function dropFixtureIdIndex() {
  try {
    console.log("🔄 Connecting to MongoDB...");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    console.log("🔄 Dropping fixtureId index...");

    // Get the collection directly
    const db = mongoose.connection.db;
    const collection = db.collection("footballevents");

    // List all indexes
    const indexes = await collection.indexes();
    console.log("📋 Current indexes:");
    indexes.forEach((index) => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });

    // Drop the fixtureId index
    try {
      await collection.dropIndex("fixtureId_1");
      console.log("✅ Dropped fixtureId_1 index");
    } catch (error) {
      console.log("⚠️  Index fixtureId_1 not found or already dropped");
    }

    // List indexes after dropping
    const indexesAfter = await collection.indexes();
    console.log("\n📋 Indexes after dropping:");
    indexesAfter.forEach((index) => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });
  } catch (error) {
    console.error("❌ Error dropping index:", error);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

// Run the script
dropFixtureIdIndex();
