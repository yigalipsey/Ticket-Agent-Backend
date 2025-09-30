import dotenv from "dotenv";
import mongoose from "mongoose";
import Team from "../src/models/Team.js";
import Venue from "../src/models/Venue.js";
import { logWithCheckpoint, logError } from "../src/utils/logger.js";

// Load environment variables
dotenv.config();

const MONGODB_URI =
  "mongodb+srv://yigalipsey:iGyGLlIePMRXMzO1@ticketagentcluster.koqkrqx.mongodb.net/ticket-agent?retryWrites=true&w=majority&appName=TicketAgentCluster";

// Team to venue mapping based on API data
const teamVenueMapping = {
  "Manchester United": "Old Trafford",
  Newcastle: "St. James' Park",
  Bournemouth: "Vitality Stadium",
  Fulham: "Craven Cottage",
  Wolves: "Molineux Stadium",
  Liverpool: "Anfield",
  Southampton: "St. Mary's Stadium",
  Arsenal: "Emirates Stadium",
  Everton: "Hill Dickinson Stadium",
  Leicester: "King Power Stadium",
  Tottenham: "Tottenham Hotspur Stadium",
  "West Ham": "London Stadium",
  Chelsea: "Stamford Bridge",
  "Manchester City": "Etihad Stadium",
  Brighton: "American Express Stadium",
  "Crystal Palace": "Selhurst Park",
  Brentford: "Gtech Community Stadium",
  Leeds: "Elland Road",
  "Nottingham Forest": "The City Ground",
  "Aston Villa": "Villa Park",
};

async function updateTeamsWithVenues() {
  try {
    logWithCheckpoint("info", "Starting teams-venues update", "UPDATE_001");

    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    logWithCheckpoint("info", "Connected to MongoDB", "UPDATE_002");

    let teamsUpdated = 0;
    let teamsNotFound = 0;
    let venuesNotFound = 0;

    for (const [teamName, venueName] of Object.entries(teamVenueMapping)) {
      try {
        // Find team
        const team = await Team.findOne({ name: teamName });
        if (!team) {
          logWithCheckpoint(
            "warn",
            `Team not found: ${teamName}`,
            "UPDATE_003"
          );
          teamsNotFound++;
          continue;
        }

        // Find venue
        const venue = await Venue.findOne({ name: venueName });
        if (!venue) {
          logWithCheckpoint(
            "warn",
            `Venue not found: ${venueName}`,
            "UPDATE_004"
          );
          venuesNotFound++;
          continue;
        }

        // Update team with venue reference
        await Team.findByIdAndUpdate(team._id, { venueId: venue._id });
        teamsUpdated++;

        logWithCheckpoint(
          "info",
          `Updated team: ${teamName} -> ${venueName}`,
          "UPDATE_005"
        );
      } catch (error) {
        logError(error, { team: teamName, venue: venueName });
      }
    }

    logWithCheckpoint("info", "Update completed", "UPDATE_006", {
      teamsUpdated,
      teamsNotFound,
      venuesNotFound,
    });

    console.log("\n🎉 Teams-Venues Update Results:");
    console.log(`✅ Teams updated: ${teamsUpdated}`);
    console.log(`❌ Teams not found: ${teamsNotFound}`);
    console.log(`❌ Venues not found: ${venuesNotFound}`);

    // Show some examples
    const teamsWithVenues = await Team.find({ venueId: { $exists: true } })
      .populate("venueId", "name city capacity")
      .limit(5);

    console.log("\n📋 Sample teams with venues:");
    teamsWithVenues.forEach((team) => {
      console.log(
        `${team.name} -> ${team.venueId.name} (${team.venueId.city})`
      );
    });
  } catch (error) {
    logError(error, { operation: "updateTeamsWithVenues" });
    console.error("❌ Update failed:", error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    logWithCheckpoint("info", "Disconnected from MongoDB", "UPDATE_007");
    process.exit(0);
  }
}

// Run the update
updateTeamsWithVenues();
