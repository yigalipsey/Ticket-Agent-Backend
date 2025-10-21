import dotenv from "dotenv";
import mongoose from "mongoose";
import databaseConnection from "../src/config/database.js";
import League from "../src/models/League.js";

// Load environment variables
dotenv.config();

class BundesligaLeagueOnlyCreator {
  constructor() {
    this.mongoUri = process.env.MONGODB_URI;

    if (!this.mongoUri) {
      throw new Error("MONGODB_URI is required in environment variables");
    }

    // Bundesliga league ID in API Football
    this.bundesligaId = 78;

    // Stats
    this.stats = {
      league: { created: 0, updated: 0 },
      errors: [],
    };
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

  // Create slug from name
  createSlug(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim("-");
  }

  // Create or update league
  async createOrUpdateLeague() {
    try {
      console.log("========================================");
      console.log("[CHECKPOINT 2] Creating/Updating Bundesliga League...");
      console.log("========================================\n");

      const leagueInfo = {
        leagueId: this.bundesligaId,
        name: "Bundesliga",
        nameHe: "בונדסליגה",
        slug: this.createSlug("Bundesliga"),
        country: "Germany",
        countryHe: "גרמניה",
        logoUrl: "https://media.api-sports.io/football/leagues/78.png",
        type: "League",
        isPopular: true, // Bundesliga is popular
        months: [
          "2025-08",
          "2025-09",
          "2025-10",
          "2025-11",
          "2025-12",
          "2026-01",
          "2026-02",
          "2026-03",
          "2026-04",
          "2026-05",
        ],
        externalIds: {
          apiFootball: this.bundesligaId,
        },
      };

      // Check if league already exists
      const existingLeague = await League.findOne({
        "externalIds.apiFootball": this.bundesligaId,
      });

      if (existingLeague) {
        await League.updateOne(
          { _id: existingLeague._id },
          { $set: leagueInfo }
        );
        this.stats.league.updated++;
        console.log(
          `🔄 Updated league: ${leagueInfo.name} (${leagueInfo.nameHe})\n`
        );
        return existingLeague._id;
      } else {
        const newLeague = new League(leagueInfo);
        await newLeague.save();
        this.stats.league.created++;
        console.log(
          `✅ Created league: ${leagueInfo.name} (${leagueInfo.nameHe})\n`
        );
        return newLeague._id;
      }
    } catch (error) {
      console.error("[ERROR] Failed to create/update league:", error.message);
      this.stats.errors.push({
        type: "league",
        reason: error.message,
      });
      throw error;
    }
  }

  // Display summary
  displaySummary() {
    console.log("========================================");
    console.log("[CHECKPOINT 3] Summary");
    console.log("========================================");
    console.log(`League: Bundesliga (${this.bundesligaId})`);
    console.log(`✅ League created: ${this.stats.league.created}`);
    console.log(`🔄 League updated: ${this.stats.league.updated}`);
    console.log(`❌ Errors: ${this.stats.errors.length}`);
    console.log("========================================\n");

    if (this.stats.errors.length > 0) {
      console.log("========================================");
      console.log("Error Details:");
      console.log("========================================");

      this.stats.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. [${error.type}] ${error.reason}`);
      });
      console.log("\n========================================\n");
    }
  }

  // Main function
  async run() {
    try {
      console.log("\n🇩🇪 BUNDESLIGA LEAGUE CREATION ONLY 🇩🇪\n");

      // Connect to database
      await this.connectToDatabase();

      // Create league
      await this.createOrUpdateLeague();

      // Display summary
      this.displaySummary();

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
  const creator = new BundesligaLeagueOnlyCreator();

  (async () => {
    try {
      await creator.run();
      process.exit(0);
    } catch (error) {
      console.error("❌ Process failed:", error.message);
      process.exit(1);
    }
  })();
}

export default BundesligaLeagueOnlyCreator;
