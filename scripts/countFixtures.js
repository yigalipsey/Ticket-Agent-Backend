import dotenv from "dotenv";
import mongoose from "mongoose";
import databaseConnection from "../src/config/database.js";
import FootballEvent from "../src/models/FootballEvent.js";
import League from "../src/models/League.js";

// Load environment variables
dotenv.config();

class FixtureCounter {
  constructor() {
    this.mongoUri = process.env.MONGODB_URI;
  }

  async connectToDatabase() {
    try {
      console.log("Connecting to MongoDB...\n");
      await databaseConnection.connect(this.mongoUri);
      if (!databaseConnection.isDatabaseConnected()) {
        throw new Error("Failed to connect to MongoDB");
      }
      console.log("✅ Connected to MongoDB\n");
    } catch (error) {
      console.error("ERROR:", error.message);
      throw error;
    }
  }

  async countFixtures() {
    try {
      console.log("========================================");
      console.log("FOOTBALL FIXTURES IN DATABASE");
      console.log("========================================\n");

      // Get all leagues
      const leagues = await League.find({});

      for (const league of leagues) {
        const count = await FootballEvent.countDocuments({
          league: league._id,
        });

        console.log(`${league.name} (${league.nameHe || "N/A"})`);
        console.log(`  Total fixtures: ${count}`);

        if (count > 0) {
          // Get date range
          const firstFixture = await FootballEvent.findOne({
            league: league._id,
          }).sort({ date: 1 });

          const lastFixture = await FootballEvent.findOne({
            league: league._id,
          }).sort({ date: -1 });

          console.log(
            `  First match: ${firstFixture.date.toISOString().split("T")[0]}`
          );
          console.log(
            `  Last match: ${lastFixture.date.toISOString().split("T")[0]}`
          );
        }
        console.log();
      }

      // Total count
      const totalCount = await FootballEvent.countDocuments();
      console.log("========================================");
      console.log(`TOTAL FIXTURES: ${totalCount}`);
      console.log("========================================\n");
    } catch (error) {
      console.error("ERROR:", error.message);
      throw error;
    }
  }

  async run() {
    try {
      await this.connectToDatabase();
      await this.countFixtures();
    } catch (error) {
      console.error("\n❌ Failed:", error.message);
      throw error;
    } finally {
      await databaseConnection.disconnect();
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const counter = new FixtureCounter();

  (async () => {
    try {
      await counter.run();
      process.exit(0);
    } catch (error) {
      console.error("❌ Failed:", error.message);
      process.exit(1);
    }
  })();
}

export default FixtureCounter;
