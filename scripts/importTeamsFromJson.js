import mongoose from "mongoose";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import models
import Team from "../src/models/Team.js";
import Venue from "../src/models/Venue.js";

async function importTeamsFromJson() {
  try {
    console.log("🔄 Connecting to MongoDB...");
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    console.log("🔄 Reading teams data from JSON...");
    
    // Read teams data from JSON
    const dataDir = path.join(__dirname, "../src/data");
    const teamsFilePath = path.join(dataDir, "teams.json");
    
    const teamsFileContent = await fs.readFile(teamsFilePath, "utf8");
    const teamsData = JSON.parse(teamsFileContent);
    
    console.log(`📊 Found ${teamsData.teams.length} teams in JSON`);

    // Clear existing teams
    console.log("🔄 Clearing existing teams...");
    await Team.deleteMany({});
    console.log("✅ Existing teams cleared");

    // Import teams
    console.log("🔄 Importing teams...");
    
    const importedTeams = [];
    
    for (const teamData of teamsData.teams) {
      try {
        // Create team document
        const team = new Team({
          name: teamData.name,
          code: teamData.code,
          slug: teamData.slug,
          country: teamData.country,
          logoUrl: teamData.logoUrl,
          teamId: teamData.teamId,
          venueId: teamData.venueId ? teamData.venueId._id : null,
          externalIds: teamData.externalIds,
          createdAt: teamData.createdAt,
          updatedAt: teamData.updatedAt,
        });

        await team.save();
        importedTeams.push(team);
        
        console.log(`✅ Imported: ${team.name} (${team.code})`);
      } catch (error) {
        console.error(`❌ Failed to import team ${teamData.name}:`, error.message);
      }
    }

    console.log(`🎉 Successfully imported ${importedTeams.length} teams`);
    
    // Show statistics
    const totalTeams = await Team.countDocuments();
    console.log(`📈 Total teams in database: ${totalTeams}`);

    // Show some examples
    const sampleTeams = await Team.find({}).limit(3).select("name code country");
    console.log("📋 Sample teams:");
    sampleTeams.forEach(team => {
      console.log(`  - ${team.name} (${team.code}) - ${team.country}`);
    });

  } catch (error) {
    console.error("❌ Error importing teams:", error);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

// Run the import
importTeamsFromJson();
