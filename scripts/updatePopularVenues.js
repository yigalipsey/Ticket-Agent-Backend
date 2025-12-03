import dotenv from "dotenv";
import mongoose from "mongoose";
import Venue from "../src/models/Venue.js";
import { logWithCheckpoint, logError } from "../src/utils/logger.js";

// Load environment variables
dotenv.config();

/**
 * Script to update isPopular field to true for 9 popular stadiums
 * Including Camp Nou and Santiago Bernabéu from Spanish League
 */

// List of popular stadiums to update
// Using direct MongoDB IDs found in database
const venueIds = [
  // Bernabéu (Madrid, Spain) - Required
  "68da78c817271b236307d188",
  
  // Old Trafford (Manchester, England)
  "68da79e4d3dea7a7449ef97f",
  
  // Anfield (Liverpool, England)
  "68da79e4d3dea7a7449ef98e",
  
  // Emirates Stadium (London, England)
  "68da79e4d3dea7a7449ef991",
  
  // Stamford Bridge (London, England)
  "68da79e5d3dea7a7449ef9a0",
  
  // Allianz Arena (Munich, Germany)
  "68e25b320d7b31dba56dddff",
  
  // BVB Stadion Dortmund (Dortmund, Germany)
  "68e25b330d7b31dba56dde20",
  
  // San Siro (Milan, Italy)
  "68e25b320d7b31dba56dde12",
  
  // Wembley Stadium (London, England)
  "68da79e5d3dea7a7449ef99d",
];

// Note: Camp Nou was not found in the database
// If you want to add it, you'll need to create it first or find it by a different name

async function connectToDatabase() {
  try {
    logWithCheckpoint("info", "Connecting to MongoDB", "SCRIPT_001");

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
    });

    logWithCheckpoint(
      "info",
      "Successfully connected to MongoDB",
      "SCRIPT_002"
    );
  } catch (error) {
    logError(error, { operation: "connectToDatabase" });
    throw error;
  }
}

async function findVenuesByIds() {
  try {
    logWithCheckpoint(
      "info",
      "Finding venues by MongoDB IDs",
      "SCRIPT_003"
    );

    const foundVenues = [];

    for (const venueId of venueIds) {
      const venue = await Venue.findById(venueId).lean();

      if (venue) {
        foundVenues.push({
          _id: venue._id,
          name: venue.name,
          city: venue.city_en,
          country: venue.country_en,
          isPopular: venue.isPopular || false,
        });
        logWithCheckpoint(
          "info",
          `Found venue: ${venue.name} in ${venue.city_en}`,
          "SCRIPT_004",
          { venueId: venue._id }
        );
      } else {
        logWithCheckpoint(
          "warn",
          `Venue not found with ID: ${venueId}`,
          "SCRIPT_004"
        );
      }
    }

    return foundVenues;
  } catch (error) {
    logError(error, { operation: "findVenuesByIds" });
    throw error;
  }
}

async function updateVenuesToPopular(venueIds) {
  try {
    logWithCheckpoint(
      "info",
      `Updating ${venueIds.length} venues to isPopular: true`,
      "SCRIPT_005"
    );

    const result = await Venue.updateMany(
      { _id: { $in: venueIds } },
      { $set: { isPopular: true } },
      { runValidators: true }
    );

    logWithCheckpoint(
      "info",
      `Successfully updated ${result.modifiedCount} venues`,
      "SCRIPT_006",
      {
        matched: result.matchedCount,
        modified: result.modifiedCount,
      }
    );

    return result;
  } catch (error) {
    logError(error, { operation: "updateVenuesToPopular" });
    throw error;
  }
}

async function main() {
  try {
    // Connect to database
    await connectToDatabase();

    // Find venues by IDs
    const foundVenues = await findVenuesByIds();

    if (foundVenues.length === 0) {
      logWithCheckpoint(
        "warn",
        "No venues found with the provided IDs",
        "SCRIPT_007"
      );
      return;
    }

    if (foundVenues.length < venueIds.length) {
      logWithCheckpoint(
        "warn",
        `Only found ${foundVenues.length} out of ${venueIds.length} venues`,
        "SCRIPT_008",
        {
          found: foundVenues.length,
          expected: venueIds.length,
        }
      );
    }

    logWithCheckpoint(
      "info",
      `Found ${foundVenues.length} venues to update`,
      "SCRIPT_008",
      {
        venues: foundVenues.map((v) => ({
          name: v.name,
          city: v.city,
          country: v.country,
        })),
      }
    );

    const venuesToUpdate = foundVenues;
    const idsToUpdate = venuesToUpdate.map((v) => v._id);

    // Update venues
    await updateVenuesToPopular(idsToUpdate);

    // Display updated venues
    logWithCheckpoint(
      "info",
      "Successfully updated venues to isPopular: true",
      "SCRIPT_009",
      {
        updatedVenues: venuesToUpdate.map((v) => ({
          name: v.name,
          city: v.city,
          country: v.country,
        })),
      }
    );

    console.log("\n✅ Successfully updated venues to isPopular: true:");
    venuesToUpdate.forEach((venue, index) => {
      console.log(
        `${index + 1}. ${venue.name} - ${venue.city}, ${venue.country}`
      );
      console.log(`   ID: ${venue._id}`);
    });
    console.log(`\nTotal: ${venuesToUpdate.length} venues updated`);
    
    if (venuesToUpdate.length < 9) {
      console.log("\n⚠️  Note: Camp Nou was not found in the database.");
      console.log("   If you need to add it, you'll need to create it first.");
    }
  } catch (error) {
    logError(error, { operation: "main" });
    console.error("❌ Error updating venues:", error.message);
    process.exit(1);
  } finally {
    // Disconnect from database
    await mongoose.disconnect();
    logWithCheckpoint("info", "Disconnected from MongoDB", "SCRIPT_010");
  }
}

// Run the script
main();

