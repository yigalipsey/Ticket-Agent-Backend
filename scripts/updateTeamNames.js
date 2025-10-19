import dotenv from "dotenv";
import mongoose from "mongoose";
import Team from "../src/models/Team.js";
import { logWithCheckpoint, logError } from "../src/utils/logger.js";

// Load environment variables
dotenv.config();

class TeamNameUpdater {
  constructor() {
    // Manual translations for teams without Hebrew names
    this.hebrewTranslations = {
      "Athletic Club": "אתלטיק בילבאו",
      "Bayern München": "באיירן מינכן",
      "Club Brugge KV": "קלאב ברוז'",
      "PSV Eindhoven": "פ.ס.ו איינדהובן",
      "FC Copenhagen": "קופנהגן",
      "Olympiakos Piraeus": "אולימפיאקוס פיראוס",
      "Slavia Praha": "סלאביה פראג",
      "Sporting CP": "ספורטינג ליסבון",
      "Bodo/Glimt": "בודו/גלימט",
      "Bayern Munich": "באיירן מינכן",
      Inter: "אינטר מילאן",
      Napoli: "נאפולי",
      Juventus: "יובנטוס",
      Atalanta: "אטאלנטה",
      Marseille: "מרסיי",
      Monaco: "מונקו",
      Benfica: "בנפיקה",
      Ajax: "אייאקס",
      Galatasaray: "גלאטסראיי",
      "Borussia Dortmund": "בורוסיה דורטמונד",
      "Eintracht Frankfurt": "איינטרכט פרנקפורט",
      "Bayer Leverkusen": "באייר לברקוזן",
      "Union St. Gilloise": "אוניון סן ז'ילואז",
      Qarabag: "קרבאג",
      "Paris Saint Germain": "פ.ס.ז'",
      Pafos: "פאפוס",
      "Kairat Almaty": "קאיראט אלמטי",
    };
  }

  // Check if a string is Hebrew
  isHebrew(text) {
    if (!text) return false;
    // Hebrew characters range: \u0590-\u05FF
    const hebrewRegex = /[\u0590-\u05FF]/;
    return hebrewRegex.test(text);
  }

  // Connect to database
  async connectToDatabase() {
    try {
      logWithCheckpoint("info", "Connecting to database", "TEAM_NAME_001");

      const mongoUri =
        process.env.MONGODB_URI || "mongodb://localhost:27017/ticketagent";
      await mongoose.connect(mongoUri);

      logWithCheckpoint(
        "info",
        "Successfully connected to database",
        "TEAM_NAME_002"
      );
    } catch (error) {
      logError(error, { operation: "connectToDatabase" });
      throw error;
    }
  }

  // Update all team names to Hebrew
  async updateAllTeamNames() {
    try {
      logWithCheckpoint(
        "info",
        "Starting to update team names to Hebrew",
        "TEAM_NAME_003"
      );

      // Get all teams
      const teams = await Team.find({}).lean();

      logWithCheckpoint(
        "info",
        `Found ${teams.length} teams to process`,
        "TEAM_NAME_004",
        { teamCount: teams.length }
      );

      let updatedCount = 0;
      let alreadyCorrectCount = 0;
      let errorCount = 0;
      const results = [];

      for (let i = 0; i < teams.length; i++) {
        const team = teams[i];

        try {
          logWithCheckpoint(
            "info",
            `Processing team ${i + 1}/${teams.length}`,
            "TEAM_NAME_005",
            {
              teamId: team._id,
              currentName: team.name,
              name_he: team.name_he,
              name_en: team.name_en,
              progress: `${i + 1}/${teams.length}`,
            }
          );

          // Determine the Hebrew name
          let hebrewName = null;

          // If name_he exists and is in Hebrew, use it
          if (team.name_he && this.isHebrew(team.name_he)) {
            hebrewName = team.name_he;
          }
          // If name_he exists but is NOT in Hebrew, try to translate it
          else if (team.name_he && !this.isHebrew(team.name_he)) {
            hebrewName = this.hebrewTranslations[team.name_he];
          }

          // If still no Hebrew name, try to translate name_en
          if (!hebrewName && team.name_en) {
            hebrewName = this.hebrewTranslations[team.name_en];
          }

          // If still no name, try current name
          if (!hebrewName && team.name) {
            hebrewName = this.hebrewTranslations[team.name];
            // If no translation found and current name is in Hebrew, use it
            if (!hebrewName && this.isHebrew(team.name)) {
              hebrewName = team.name;
            }
          }

          // Last resort - use English name if nothing else works
          if (!hebrewName) {
            hebrewName = team.name_en || team.name;
          }

          if (!hebrewName) {
            logWithCheckpoint("warn", "Team has no name", "TEAM_NAME_006", {
              teamId: team._id,
              slug: team.slug,
            });
            errorCount++;
            results.push({
              teamId: team._id,
              slug: team.slug,
              status: "error",
              error: "No name found",
            });
            continue;
          }

          // Check if name is already correct
          if (team.name === hebrewName) {
            logWithCheckpoint(
              "info",
              "Team name already correct",
              "TEAM_NAME_007",
              {
                teamId: team._id,
                slug: team.slug,
                name: team.name,
              }
            );
            alreadyCorrectCount++;
            results.push({
              teamId: team._id,
              slug: team.slug,
              status: "already_correct",
              name: team.name,
            });
            continue;
          }

          // Update the team name
          const updateData = {
            name: hebrewName,
          };

          // Also update name_he to match
          if (!team.name_he || team.name_he !== hebrewName) {
            updateData.name_he = hebrewName;
          }

          // Make sure name_en exists
          if (!team.name_en && team.name && team.name !== hebrewName) {
            updateData.name_en = team.name;
          }

          await Team.findByIdAndUpdate(team._id, updateData, {
            runValidators: true,
          });

          logWithCheckpoint(
            "info",
            "Successfully updated team name",
            "TEAM_NAME_008",
            {
              teamId: team._id,
              slug: team.slug,
              oldName: team.name,
              newName: hebrewName,
            }
          );

          updatedCount++;
          results.push({
            teamId: team._id,
            slug: team.slug,
            status: "updated",
            oldName: team.name,
            newName: hebrewName,
          });

          // Add small delay to avoid overwhelming the database
          if (i % 10 === 0 && i > 0) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        } catch (error) {
          errorCount++;
          logError(error, { operation: "updateTeamName", teamId: team._id });
          results.push({
            teamId: team._id,
            slug: team.slug,
            status: "error",
            error: error.message,
          });
        }
      }

      logWithCheckpoint(
        "info",
        "Completed updating team names",
        "TEAM_NAME_009",
        {
          totalTeams: teams.length,
          updatedCount,
          alreadyCorrectCount,
          errorCount,
        }
      );

      return {
        totalTeams: teams.length,
        updatedCount,
        alreadyCorrectCount,
        errorCount,
        results,
      };
    } catch (error) {
      logError(error, { operation: "updateAllTeamNames" });
      throw error;
    }
  }

  // Display summary of team names
  async displayTeamNamesSummary() {
    try {
      logWithCheckpoint(
        "info",
        "Generating team names summary",
        "TEAM_NAME_010"
      );

      const teams = await Team.find({})
        .sort({ name: 1 })
        .select("name name_he name_en slug")
        .lean();

      logWithCheckpoint(
        "info",
        `Found ${teams.length} teams`,
        "TEAM_NAME_011",
        {
          teamCount: teams.length,
        }
      );

      console.log(`\n=== סיכום שמות קבוצות ===`);
      console.log(`סה"כ קבוצות: ${teams.length}\n`);

      // Show first 20 teams
      console.log("--- 20 קבוצות ראשונות ---");
      teams.slice(0, 20).forEach((team) => {
        console.log(`${team.name} (${team.slug})`);
        if (team.name_he) {
          console.log(`  עברית: ${team.name_he}`);
        }
        if (team.name_en) {
          console.log(`  אנגלית: ${team.name_en}`);
        }
        console.log("");
      });

      if (teams.length > 20) {
        console.log(`... ועוד ${teams.length - 20} קבוצות`);
      }

      // Check for teams without Hebrew names
      const teamsWithoutHebrew = teams.filter((t) => !t.name_he);
      if (teamsWithoutHebrew.length > 0) {
        console.log(
          `\n=== קבוצות ללא שם עברי (${teamsWithoutHebrew.length}) ===`
        );
        teamsWithoutHebrew.slice(0, 10).forEach((team) => {
          console.log(`${team.slug}: ${team.name} (${team.name_en || "אין"})`);
        });
        if (teamsWithoutHebrew.length > 10) {
          console.log(`... ועוד ${teamsWithoutHebrew.length - 10} קבוצות`);
        }
      }
    } catch (error) {
      logError(error, { operation: "displayTeamNamesSummary" });
      throw error;
    }
  }

  // Main function to run the update
  async runUpdate(options = {}) {
    try {
      logWithCheckpoint(
        "info",
        "Starting team names update process",
        "TEAM_NAME_012",
        { options }
      );

      await this.connectToDatabase();

      const result = await this.updateAllTeamNames();

      if (options.showSummary) {
        await this.displayTeamNamesSummary();
      }

      logWithCheckpoint(
        "info",
        "Team names update process completed successfully",
        "TEAM_NAME_013",
        { result }
      );

      return result;
    } catch (error) {
      logError(error, { operation: "runUpdate", options });
      throw error;
    } finally {
      await mongoose.connection.close();
      logWithCheckpoint("info", "Database connection closed", "TEAM_NAME_014");
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const updater = new TeamNameUpdater();

  // Parse command line arguments
  const args = process.argv.slice(2);
  const options = {
    showSummary: args.includes("--summary") || !args.includes("--no-summary"),
  };

  (async () => {
    try {
      console.log("מתחיל עדכון שמות קבוצות לעברית...");

      const result = await updater.runUpdate(options);

      console.log("\n=== תוצאות ===");
      console.log(`סה"כ קבוצות: ${result.totalTeams}`);
      console.log(`עודכנו בהצלחה: ${result.updatedCount}`);
      console.log(`כבר תקינים: ${result.alreadyCorrectCount}`);
      console.log(`שגיאות: ${result.errorCount}`);

      console.log("\nהעדכון הושלם בהצלחה!");
    } catch (error) {
      console.error("העדכון נכשל:", error.message);
      process.exit(1);
    }
  })();
}

export default TeamNameUpdater;
