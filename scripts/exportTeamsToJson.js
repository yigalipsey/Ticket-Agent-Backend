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

async function exportTeamsToJson() {
  try {
    console.log("🔄 Connecting to MongoDB...");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    console.log("🔄 Fetching all teams...");

    // Fetch all teams with venue population
    const teams = await Team.find({})
      .populate("venueId", "name city capacity")
      .lean();

    console.log(`📊 Found ${teams.length} teams`);

    // Create data directory if it doesn't exist
    const dataDir = path.join(__dirname, "../src/data");
    await fs.mkdir(dataDir, { recursive: true });

    // Prepare teams data for JSON
    const teamsData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        totalTeams: teams.length,
        version: "1.0.0",
      },
      teams: teams.map((team) => ({
        _id: team._id.toString(),
        name: team.name,
        code: team.code,
        slug: team.slug,
        country: team.country,
        logoUrl: team.logoUrl,
        teamId: team.teamId,
        venueId: team.venueId
          ? {
              _id: team.venueId._id.toString(),
              name: team.venueId.name,
              city: team.venueId.city,
              capacity: team.venueId.capacity,
            }
          : null,
        externalIds: team.externalIds,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
      })),
    };

    // Write to JSON file
    const jsonFilePath = path.join(dataDir, "teams.json");
    await fs.writeFile(jsonFilePath, JSON.stringify(teamsData, null, 2));

    console.log(`✅ Teams exported to: ${jsonFilePath}`);
    console.log(`📈 Total teams: ${teams.length}`);

    // Create index for faster lookups
    const indexData = {
      byId: {},
      byTeamId: {},
      bySlug: {},
      byCode: {},
      byCountry: {},
    };

    teamsData.teams.forEach((team) => {
      indexData.byId[team._id] = team;
      indexData.byTeamId[team.teamId] = team;
      indexData.bySlug[team.slug] = team;
      indexData.byCode[team.code] = team;

      if (!indexData.byCountry[team.country]) {
        indexData.byCountry[team.country] = [];
      }
      indexData.byCountry[team.country].push(team);
    });

    const indexFilePath = path.join(dataDir, "teams-index.json");
    await fs.writeFile(indexFilePath, JSON.stringify(indexData, null, 2));

    console.log(`✅ Teams index created: ${indexFilePath}`);

    // Show some statistics
    const countries = Object.keys(indexData.byCountry);
    console.log(`🌍 Countries: ${countries.length}`);
    console.log(`📋 Countries: ${countries.join(", ")}`);
  } catch (error) {
    console.error("❌ Error exporting teams:", error);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

// Run the export
exportTeamsToJson();
