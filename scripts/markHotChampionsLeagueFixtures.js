import dotenv from "dotenv";
import mongoose from "mongoose";
import databaseConnection from "../src/config/database.js";
import FootballEvent from "../src/models/FootballEvent.js";
import Team from "../src/models/Team.js";
import League from "../src/models/League.js";

// Load environment variables
dotenv.config();

class HotChampionsLeagueMarker {
  constructor() {
    this.mongoUri = process.env.MONGODB_URI;
    this.championsLeagueId = 2;

    // Stats
    this.stats = {
      marked: 0,
      errors: [],
    };
  }

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

  async markHotFixtures() {
    try {
      console.log("========================================");
      console.log("[CHECKPOINT 2] Finding Champions League...");
      console.log("========================================\n");

      // Find Champions League
      const league = await League.findOne({
        "externalIds.apiFootball": this.championsLeagueId,
      });

      if (!league) {
        throw new Error("Champions League not found in database");
      }

      console.log(`✅ Found league: ${league.name}\n`);

      // Find teams
      const barcelona = await Team.findOne({ teamId: 529 });
      const realMadrid = await Team.findOne({ teamId: 541 });

      if (!barcelona || !realMadrid) {
        throw new Error("Barcelona or Real Madrid not found in database");
      }

      console.log(`✅ Found Barcelona (ID: ${barcelona._id})`);
      console.log(`✅ Found Real Madrid (ID: ${realMadrid._id})\n`);

      console.log("========================================");
      console.log("[CHECKPOINT 3] Marking hot fixtures...");
      console.log("========================================\n");

      // Define hot fixtures - top teams playing against Barcelona or Real Madrid
      const hotOpponents = {
        barcelona: ["Chelsea", "Club Brugge", "Eintracht Frankfurt"],
        realMadrid: ["Juventus", "Liverpool", "Manchester City"],
      };

      let markedCount = 0;

      // Mark Barcelona hot fixtures
      console.log("🔥 Marking Barcelona hot fixtures:\n");
      for (const opponentName of hotOpponents.barcelona) {
        const opponent = await Team.findOne({
          $or: [
            { name_en: { $regex: new RegExp(opponentName, "i") } },
            {
              name_en: {
                $regex: new RegExp(opponentName.replace(" ", ""), "i"),
              },
            },
          ],
        });

        if (opponent) {
          // Find fixture with Barcelona and opponent
          const fixture = await FootballEvent.findOne({
            league: league._id,
            $or: [
              { homeTeam: barcelona._id, awayTeam: opponent._id },
              { homeTeam: opponent._id, awayTeam: barcelona._id },
            ],
          }).populate("homeTeam awayTeam");

          if (fixture) {
            await FootballEvent.updateOne(
              { _id: fixture._id },
              { $set: { isHot: true, isPopular: true } }
            );
            console.log(
              `   ✅ Marked: ${fixture.homeTeam.name_en} vs ${fixture.awayTeam.name_en}`
            );
            markedCount++;
          } else {
            console.log(
              `   ⚠️  Fixture not found: Barcelona vs ${opponentName}`
            );
          }
        } else {
          console.log(`   ⚠️  Team not found: ${opponentName}`);
        }
      }

      console.log("\n🔥 Marking Real Madrid hot fixtures:\n");
      // Mark Real Madrid hot fixtures
      for (const opponentName of hotOpponents.realMadrid) {
        const opponent = await Team.findOne({
          $or: [
            { name_en: { $regex: new RegExp(opponentName, "i") } },
            {
              name_en: {
                $regex: new RegExp(opponentName.replace(" ", ""), "i"),
              },
            },
          ],
        });

        if (opponent) {
          // Find fixture with Real Madrid and opponent
          const fixture = await FootballEvent.findOne({
            league: league._id,
            $or: [
              { homeTeam: realMadrid._id, awayTeam: opponent._id },
              { homeTeam: opponent._id, awayTeam: realMadrid._id },
            ],
          }).populate("homeTeam awayTeam");

          if (fixture) {
            await FootballEvent.updateOne(
              { _id: fixture._id },
              { $set: { isHot: true, isPopular: true } }
            );
            console.log(
              `   ✅ Marked: ${fixture.homeTeam.name_en} vs ${fixture.awayTeam.name_en}`
            );
            markedCount++;
          } else {
            console.log(
              `   ⚠️  Fixture not found: Real Madrid vs ${opponentName}`
            );
          }
        } else {
          console.log(`   ⚠️  Team not found: ${opponentName}`);
        }
      }

      this.stats.marked = markedCount;
      console.log("\n✅ All hot fixtures marked\n");
    } catch (error) {
      console.error("[ERROR] Failed to mark fixtures:", error.message);
      throw error;
    }
  }

  displaySummary() {
    console.log("========================================");
    console.log("[CHECKPOINT 4] Summary");
    console.log("========================================");
    console.log(`Total fixtures marked as HOT: ${this.stats.marked}`);
    console.log("========================================\n");
  }

  async run() {
    try {
      console.log("\n🔥 MARKING HOT CHAMPIONS LEAGUE FIXTURES 🔥\n");

      // Connect to database
      await this.connectToDatabase();

      // Mark hot fixtures
      await this.markHotFixtures();

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
  const marker = new HotChampionsLeagueMarker();

  (async () => {
    try {
      await marker.run();
      process.exit(0);
    } catch (error) {
      console.error("❌ Process failed:", error.message);
      process.exit(1);
    }
  })();
}

export default HotChampionsLeagueMarker;
