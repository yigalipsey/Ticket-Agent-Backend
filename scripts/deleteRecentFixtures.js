import dotenv from "dotenv";
import mongoose from "mongoose";
import databaseConnection from "../src/config/database.js";
import FootballEvent from "../src/models/FootballEvent.js";

// Load environment variables
dotenv.config();

class FixtureCleaner {
  constructor() {
    this.mongoUri = process.env.MONGODB_URI;

    if (!this.mongoUri) {
      throw new Error("MONGODB_URI is required in environment variables");
    }
  }

  // Connect to MongoDB
  async connectToDatabase() {
    try {
      console.log("========================================");
      console.log("[CHECKPOINT 1] Connecting to MongoDB...");
      console.log("========================================\n");

      await databaseConnection.connect(this.mongoUri);

      if (!databaseConnection.isDatabaseConnected()) {
        throw new Error("Failed to connect to MongoDB");
      }

      console.log("✅ Connected to MongoDB successfully\n");
    } catch (error) {
      console.error("[ERROR] Database connection failed:", error.message);
      throw error;
    }
  }

  // Delete all football fixtures
  async deleteAllFixtures() {
    try {
      console.log("========================================");
      console.log("[CHECKPOINT 2] Deleting football fixtures...");
      console.log("========================================\n");

      // Count before deletion
      const countBefore = await FootballEvent.countDocuments();
      console.log(`Found ${countBefore} fixtures in database`);

      if (countBefore === 0) {
        console.log("No fixtures to delete.");
        return { deleted: 0 };
      }

      // Delete all fixtures
      const result = await FootballEvent.deleteMany({});

      console.log(`✅ Deleted ${result.deletedCount} fixtures\n`);

      return { deleted: result.deletedCount };
    } catch (error) {
      console.error("[ERROR] Failed to delete fixtures:", error.message);
      throw error;
    }
  }

  // Main function
  async run() {
    try {
      console.log("\n🗑️  DELETING ALL FOOTBALL FIXTURES 🗑️\n");

      // Connect to database
      await this.connectToDatabase();

      // Delete fixtures
      const result = await this.deleteAllFixtures();

      console.log("========================================");
      console.log("[CHECKPOINT 3] Summary");
      console.log("========================================");
      console.log(`Total fixtures deleted: ${result.deleted}`);
      console.log("========================================\n");

      console.log("✅ Process completed successfully!\n");
    } catch (error) {
      console.error("\n❌ Process failed:", error.message);
      throw error;
    } finally {
      // Disconnect from database
      await databaseConnection.disconnect();
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const cleaner = new FixtureCleaner();

  (async () => {
    try {
      await cleaner.run();
      process.exit(0);
    } catch (error) {
      console.error("❌ Process failed:", error.message);
      process.exit(1);
    }
  })();
}

export default FixtureCleaner;
