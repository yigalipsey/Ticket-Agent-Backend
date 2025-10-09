import dotenv from "dotenv";
import mongoose from "mongoose";
import databaseConnection from "../src/config/database.js";
import Team from "../src/models/Team.js";
import Venue from "../src/models/Venue.js";
import League from "../src/models/League.js";

// Load environment variables
dotenv.config();

class LaLigaChecker {
  constructor() {
    this.mongoUri = process.env.MONGODB_URI;
    this.laLigaId = 140;
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

  async checkLaLiga() {
    try {
      console.log("========================================");
      console.log("LA LIGA - DATABASE CHECK");
      console.log("========================================\n");

      // Find La Liga
      const league = await League.findOne({
        "externalIds.apiFootball": this.laLigaId,
      });

      if (!league) {
        console.log("❌ La Liga not found in database!");
        return;
      }

      console.log(`✅ League: ${league.name} (${league.nameHe})`);
      console.log(`   League ID: ${league._id}`);
      console.log(`   API Football ID: ${league.externalIds.apiFootball}\n`);

      // Find teams in La Liga
      const teams = await Team.find({
        leagueIds: league._id,
      }).populate("venueId");

      console.log("========================================");
      console.log(`TEAMS IN LA LIGA: ${teams.length}`);
      console.log("========================================\n");

      teams.forEach((team, index) => {
        console.log(`${index + 1}. ${team.name_en} (${team.name_he || "N/A"})`);
        console.log(`   Team ID: ${team.teamId}`);
        console.log(
          `   API Football ID: ${team.externalIds.apiFootball || "N/A"}`
        );
        console.log(`   Venue: ${team.venueId?.name_en || "Unknown"}`);
        console.log(
          `   Venue API ID: ${
            team.venueId?.externalIds?.apiFootball || "N/A"
          }\n`
        );
      });

      // Find all Spanish venues
      const venues = await Venue.find({
        country_en: "Spain",
      });

      console.log("========================================");
      console.log(`SPANISH VENUES: ${venues.length}`);
      console.log("========================================\n");

      venues.forEach((venue, index) => {
        console.log(`${index + 1}. ${venue.name_en}`);
        console.log(`   Venue ID: ${venue.venueId}`);
        console.log(
          `   API Football ID: ${venue.externalIds?.apiFootball || "N/A"}`
        );
        console.log(`   City: ${venue.city_en}\n`);
      });

      console.log("========================================");
      console.log("SUMMARY");
      console.log("========================================");
      console.log(`La Liga Teams: ${teams.length} (should be 20)`);
      console.log(`Spanish Venues: ${venues.length}`);
      console.log("========================================\n");
    } catch (error) {
      console.error("ERROR:", error.message);
      throw error;
    }
  }

  async run() {
    try {
      await this.connectToDatabase();
      await this.checkLaLiga();
    } catch (error) {
      console.error("\n❌ Check failed:", error.message);
      throw error;
    } finally {
      await databaseConnection.disconnect();
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const checker = new LaLigaChecker();

  (async () => {
    try {
      await checker.run();
      process.exit(0);
    } catch (error) {
      console.error("❌ Failed:", error.message);
      process.exit(1);
    }
  })();
}

export default LaLigaChecker;
