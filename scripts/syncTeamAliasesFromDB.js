import mongoose from "mongoose";
import { readFile, writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Team from "../src/models/Team.js";
import { logWithCheckpoint, logError } from "../src/utils/logger.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({
  path: join(dirname(fileURLToPath(import.meta.url)), "../.env"),
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function connectToDatabase() {
  try {
    logWithCheckpoint("info", "Connecting to MongoDB", "SYNC_001");

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
    });

    logWithCheckpoint("info", "Successfully connected to MongoDB", "SYNC_002");
  } catch (error) {
    logError(error, { operation: "connectToDatabase" });
    throw error;
  }
}

async function syncTeamAliases() {
  try {
    // Read existing aliases file
    const aliasesFilePath = join(__dirname, "../data/teams/team_aliases.json");
    let existingAliases = [];
    try {
      const fileContent = await readFile(aliasesFilePath, "utf-8");
      existingAliases = JSON.parse(fileContent);
      logWithCheckpoint("info", "Loaded existing aliases", "SYNC_003", {
        count: existingAliases.length,
      });
    } catch (error) {
      logWithCheckpoint(
        "warn",
        "Could not read existing aliases file, starting fresh",
        "SYNC_004"
      );
    }

    // Create a map of existing aliases by ID for quick lookup
    const existingAliasesMap = new Map();
    existingAliases.forEach((team) => {
      existingAliasesMap.set(team.id, team);
    });

    // Fetch all teams from database
    logWithCheckpoint("info", "Fetching all teams from database", "SYNC_005");
    const allTeams = await Team.find({}).select("_id name slug").lean();

    logWithCheckpoint("info", "Found teams in database", "SYNC_006", {
      count: allTeams.length,
    });

    // Process each team
    const updatedAliases = [];
    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const team of allTeams) {
      const teamId = team._id.toString();
      const existingTeam = existingAliasesMap.get(teamId);

      if (existingTeam) {
        // Team already exists - keep existing aliases but update name/slug if changed
        updatedAliases.push({
          id: teamId,
          name_he: team.name || existingTeam.name_he,
          slug: team.slug || existingTeam.slug,
          aliases: existingTeam.aliases || [],
        });
        if (
          team.name !== existingTeam.name_he ||
          team.slug !== existingTeam.slug
        ) {
          updatedCount++;
        } else {
          skippedCount++;
        }
      } else {
        // New team - add with basic aliases
        const basicAliases = [team.name];
        if (team.slug && team.slug !== team.name) {
          basicAliases.push(team.slug);
        }
        updatedAliases.push({
          id: teamId,
          name_he: team.name,
          slug: team.slug,
          aliases: basicAliases,
        });
        addedCount++;
      }
    }

    // Sort by name_he for better readability
    updatedAliases.sort((a, b) => {
      return (a.name_he || "").localeCompare(b.name_he || "", "he");
    });

    // Write updated aliases to file
    await writeFile(
      aliasesFilePath,
      JSON.stringify(updatedAliases, null, 2),
      "utf-8"
    );

    logWithCheckpoint("info", "Successfully synced team aliases", "SYNC_007", {
      total: updatedAliases.length,
      added: addedCount,
      updated: updatedCount,
      skipped: skippedCount,
      file: aliasesFilePath,
    });

    console.log("\n✅ Sync completed!");
    console.log(`📊 Total teams: ${updatedAliases.length}`);
    console.log(`➕ Added: ${addedCount}`);
    console.log(`🔄 Updated: ${updatedCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`📁 File: ${aliasesFilePath}\n`);

    return {
      success: true,
      total: updatedAliases.length,
      added: addedCount,
      updated: updatedCount,
      skipped: skippedCount,
    };
  } catch (error) {
    logError(error, { operation: "syncTeamAliases" });
    throw error;
  }
}

async function main() {
  try {
    await connectToDatabase();
    await syncTeamAliases();
    await mongoose.disconnect();
    logWithCheckpoint("info", "Disconnected from MongoDB", "SYNC_008");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

main();
