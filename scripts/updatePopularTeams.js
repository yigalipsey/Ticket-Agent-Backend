import dotenv from "dotenv";
import mongoose from "mongoose";
import Team from "../src/models/Team.js";
import Venue from "../src/models/Venue.js";
import League from "../src/models/League.js";
import { logWithCheckpoint, logError } from "../src/utils/logger.js";

// Load environment variables
dotenv.config();

/**
 * Script to mark popular teams in the database
 * Popular teams will have isPopular=true
 */
class PopularTeamsUpdater {
  constructor() {
    // List of popular teams (English names)
    this.popularTeams = [
      "Arsenal",
      "Manchester United",
      "Liverpool",
      "Chelsea",
      "Tottenham",
      "Tottenham Hotspur",
      "Manchester City",
      "Real Madrid",
      "Barcelona",
      "Bayern Munich",
      "Bayern München",
      "Milan",
      "AC Milan",
    ];
  }

  // Connect to database
  async connectToDatabase() {
    try {
      logWithCheckpoint("info", "Connecting to database", "POP_TEAM_001");

      const mongoUri =
        process.env.MONGODB_URI || "mongodb://localhost:27017/ticketagent";
      await mongoose.connect(mongoUri);

      logWithCheckpoint(
        "info",
        "Successfully connected to database",
        "POP_TEAM_002"
      );
    } catch (error) {
      logError(error, { operation: "connectToDatabase" });
      throw error;
    }
  }

  // First, reset all teams to isPopular=false
  async resetAllTeams() {
    try {
      logWithCheckpoint(
        "info",
        "Resetting all teams to isPopular=false",
        "POP_TEAM_003"
      );

      const result = await Team.updateMany(
        { isPopular: true },
        { $set: { isPopular: false } }
      );

      logWithCheckpoint(
        "info",
        `Reset ${result.modifiedCount} teams`,
        "POP_TEAM_004",
        { modifiedCount: result.modifiedCount }
      );

      return result.modifiedCount;
    } catch (error) {
      logError(error, { operation: "resetAllTeams" });
      throw error;
    }
  }

  // Update popular teams
  async updatePopularTeams() {
    try {
      logWithCheckpoint(
        "info",
        "Starting to mark popular teams",
        "POP_TEAM_005",
        { popularTeamsCount: this.popularTeams.length }
      );

      console.log("\n=== Marking Popular Teams ===\n");

      let updatedCount = 0;
      let notFoundCount = 0;
      const results = [];

      for (let i = 0; i < this.popularTeams.length; i++) {
        const teamName = this.popularTeams[i];

        try {
          logWithCheckpoint(
            "info",
            `Processing team ${i + 1}/${this.popularTeams.length}`,
            "POP_TEAM_006",
            {
              teamName,
              progress: `${i + 1}/${this.popularTeams.length}`,
            }
          );

          // Find team by name_en (case insensitive)
          const team = await Team.findOne({
            name_en: { $regex: new RegExp(`^${teamName}$`, "i") },
          });

          if (team) {
            // Update team to popular
            team.isPopular = true;
            await team.save();

            updatedCount++;
            console.log(`✓ ${i + 1}. ${teamName} - marked as popular`);

            logWithCheckpoint(
              "info",
              `Marked team as popular`,
              "POP_TEAM_007",
              {
                teamName,
                teamId: team._id,
                slug: team.slug,
              }
            );

            results.push({
              teamName,
              status: "updated",
              teamId: team._id,
              slug: team.slug,
            });
          } else {
            notFoundCount++;
            console.log(`✗ ${i + 1}. ${teamName} - NOT FOUND in database`);

            logWithCheckpoint(
              "warn",
              `Team not found in database`,
              "POP_TEAM_008",
              { teamName }
            );

            results.push({
              teamName,
              status: "not_found",
            });
          }
        } catch (error) {
          logError(error, { operation: "updatePopularTeam", teamName });
          console.log(`✗ ${i + 1}. ${teamName} - ERROR: ${error.message}`);

          results.push({
            teamName,
            status: "error",
            error: error.message,
          });
        }
      }

      logWithCheckpoint(
        "info",
        "Completed marking popular teams",
        "POP_TEAM_009",
        {
          totalTeams: this.popularTeams.length,
          updatedCount,
          notFoundCount,
        }
      );

      return {
        totalTeams: this.popularTeams.length,
        updatedCount,
        notFoundCount,
        results,
      };
    } catch (error) {
      logError(error, { operation: "updatePopularTeams" });
      throw error;
    }
  }

  // Display all popular teams
  async displayPopularTeams() {
    try {
      logWithCheckpoint("info", "Displaying all popular teams", "POP_TEAM_010");

      const popularTeams = await Team.find({ isPopular: true })
        .populate("venueId", "name")
        .populate("leagueIds", "name")
        .sort({ name_en: 1 })
        .lean();

      console.log("\n=== Popular Teams in Database ===\n");

      if (popularTeams.length === 0) {
        console.log("No popular teams found in database.");
        return [];
      }

      popularTeams.forEach((team, index) => {
        console.log(`${index + 1}. ${team.name_en}`);
        console.log(`   Hebrew: ${team.name_he || "N/A"}`);
        console.log(`   Code: ${team.code}`);
        console.log(`   Slug: ${team.slug}`);
        console.log(`   Country: ${team.country_en}`);
        if (team.venueId) {
          console.log(`   Venue: ${team.venueId.name || team.venueId}`);
        }
        if (team.leagueIds && team.leagueIds.length > 0) {
          const leagueNames = team.leagueIds.map((l) => l.name || l).join(", ");
          console.log(`   Leagues: ${leagueNames}`);
        }
        console.log("");
      });

      console.log(`Total popular teams: ${popularTeams.length}\n`);

      logWithCheckpoint(
        "info",
        `Found ${popularTeams.length} popular teams`,
        "POP_TEAM_011",
        { popularTeamsCount: popularTeams.length }
      );

      return popularTeams;
    } catch (error) {
      logError(error, { operation: "displayPopularTeams" });
      throw error;
    }
  }

  // Main function to run the update
  async runUpdate(options = {}) {
    try {
      logWithCheckpoint(
        "info",
        "Starting popular teams update process",
        "POP_TEAM_012",
        { options }
      );

      await this.connectToDatabase();

      // Reset all teams if requested
      if (options.resetFirst) {
        await this.resetAllTeams();
      }

      // Update popular teams
      const result = await this.updatePopularTeams();

      // Display summary if requested
      if (options.showSummary !== false) {
        await this.displayPopularTeams();
      }

      logWithCheckpoint(
        "info",
        "Popular teams update process completed successfully",
        "POP_TEAM_013",
        { result }
      );

      return result;
    } catch (error) {
      logError(error, { operation: "runUpdate", options });
      throw error;
    } finally {
      await mongoose.connection.close();
      logWithCheckpoint("info", "Database connection closed", "POP_TEAM_014");
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const updater = new PopularTeamsUpdater();

  // Parse command line arguments
  const args = process.argv.slice(2);
  const options = {
    resetFirst: args.includes("--reset"),
    showSummary: !args.includes("--no-summary"),
  };

  (async () => {
    try {
      console.log("=== Popular Teams Updater ===");
      console.log("Starting update process...\n");

      if (options.resetFirst) {
        console.log("Mode: Reset all teams first, then mark popular teams");
      } else {
        console.log("Mode: Mark popular teams only");
      }

      const result = await updater.runUpdate(options);

      console.log("\n=== Results ===");
      console.log(`Total teams to mark: ${result.totalTeams}`);
      console.log(`Successfully marked: ${result.updatedCount}`);
      console.log(`Not found: ${result.notFoundCount}`);

      if (result.notFoundCount > 0) {
        console.log("\n⚠️  Some teams were not found. Please check:");
        result.results
          .filter((r) => r.status === "not_found")
          .forEach((r) => {
            console.log(`   - ${r.teamName}`);
          });
      }

      console.log("\n✅ Update completed successfully!");
      process.exit(0);
    } catch (error) {
      console.error("\n❌ Update failed:", error.message);
      process.exit(1);
    }
  })();
}

export default PopularTeamsUpdater;
