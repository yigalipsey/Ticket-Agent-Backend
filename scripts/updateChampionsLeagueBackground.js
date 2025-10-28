import dotenv from "dotenv";
import databaseConnection from "../src/config/database.js";
import League from "../src/models/League.js";

// Load environment variables
dotenv.config();

class ChampionsLeagueBackgroundUpdater {
  constructor() {
    this.mongoUri = process.env.MONGODB_URI;

    if (!this.mongoUri) {
      throw new Error("MONGODB_URI is required in environment variables");
    }

    // Champions League background image
    this.backgroundImageUrl =
      "https://res.cloudinary.com/djgwgeeqr/image/upload/v1761573386/478fa22391cfeabbee17ffcdbeb02058157061cc_ahlxr6.jpg";

    this.stats = {
      updated: false,
      error: null,
    };
  }

  // Connect to MongoDB
  async connectToDatabase() {
    try {
      console.log("========================================");
      console.log("[CHECKPOINT 1] Connecting to database...");
      console.log("========================================\n");

      await databaseConnection.connect();
      console.log("✅ Connected to database successfully\n");
    } catch (error) {
      console.error("[ERROR] Database connection failed:", error.message);
      throw error;
    }
  }

  // Update Champions League background
  async updateChampionsLeagueBackground() {
    try {
      console.log("========================================");
      console.log("[CHECKPOINT 2] Updating Champions League background...");
      console.log("========================================\n");

      // Find Champions League by slug
      const league = await League.findOne({
        slug: "uefa-champions-league",
      });

      if (!league) {
        console.log("⚠️ UEFA Champions League not found in database\n");
        this.stats.error = "League not found";
        return;
      }

      console.log(`📋 Found league: ${league.name} (${league.nameHe})`);
      console.log(
        `🔗 Current background: ${league.backgroundImage || "None"}\n`
      );

      // Update background image
      league.backgroundImage = this.backgroundImageUrl;
      await league.save();

      this.stats.updated = true;

      console.log("✅ Successfully updated Champions League background");
      console.log(`🖼️ New background: ${this.backgroundImageUrl}\n`);
    } catch (error) {
      console.error("[ERROR] Failed to update league:", error.message);
      this.stats.error = error.message;
      throw error;
    }
  }

  // Display summary
  displaySummary() {
    console.log("========================================");
    console.log("[CHECKPOINT 3] Summary");
    console.log("========================================\n");

    if (this.stats.updated) {
      console.log("✅ Status: Updated successfully");
      console.log("🏆 League: UEFA Champions League");
      console.log(`🖼️ Background: ${this.backgroundImageUrl}`);
    } else {
      console.log("❌ Status: Update failed");
      if (this.stats.error) {
        console.log(`⚠️ Error: ${this.stats.error}`);
      }
    }

    console.log("\n========================================\n");
  }

  // Main function
  async run() {
    try {
      console.log("\n🏆 UPDATE CHAMPIONS LEAGUE BACKGROUND 🏆\n");

      // Connect to database
      await this.connectToDatabase();

      // Update Champions League
      await this.updateChampionsLeagueBackground();

      // Display summary
      this.displaySummary();

      console.log("✅ Process completed successfully!\n");
    } catch (error) {
      console.error("\n❌ Process failed:", error.message);
      this.displaySummary();
      throw error;
    } finally {
      // Disconnect from database
      await databaseConnection.disconnect();
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const updater = new ChampionsLeagueBackgroundUpdater();
  updater
    .run()
    .then(() => {
      console.log("Done!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}

export default ChampionsLeagueBackgroundUpdater;
