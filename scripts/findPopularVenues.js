import dotenv from "dotenv";
import mongoose from "mongoose";
import Venue from "../src/models/Venue.js";
import { logWithCheckpoint, logError } from "../src/utils/logger.js";

// Load environment variables
dotenv.config();

/**
 * Script to find popular venues in database and display their IDs
 * This helps verify venues exist before updating them
 */

// List of popular stadiums to search for
const popularStadiums = [
  // Required: Spanish League stadiums
  {
    searchTerms: ["Camp Nou", "Spotify Camp Nou"],
    city: "Barcelona",
    country: "Spain",
    apiFootballId: null,
    required: true,
  },
  {
    searchTerms: [
      "Estadio Santiago Bernabéu",
      "Santiago Bernabéu",
      "Santiago Bernabeu",
    ],
    city: "Madrid",
    country: "Spain",
    apiFootballId: 1456,
    required: true,
  },

  // Additional popular stadiums
  {
    searchTerms: ["Old Trafford"],
    city: "Manchester",
    country: "England",
    apiFootballId: null,
    required: false,
  },
  {
    searchTerms: ["Anfield"],
    city: "Liverpool",
    country: "England",
    apiFootballId: null,
    required: false,
  },
  {
    searchTerms: ["Emirates Stadium"],
    city: "London",
    country: "England",
    apiFootballId: null,
    required: false,
  },
  {
    searchTerms: ["Stamford Bridge"],
    city: "London",
    country: "England",
    apiFootballId: null,
    required: false,
  },
  {
    searchTerms: ["Allianz Arena"],
    city: "Munich",
    country: "Germany",
    apiFootballId: null,
    required: false,
  },
  {
    searchTerms: ["Signal Iduna Park", "BVB Stadion Dortmund"],
    city: "Dortmund",
    country: "Germany",
    apiFootballId: null,
    required: false,
  },
  {
    searchTerms: ["San Siro", "Stadio San Siro"],
    city: "Milan",
    country: "Italy",
    apiFootballId: null,
    required: false,
  },
  {
    searchTerms: ["Wembley Stadium"],
    city: "London",
    country: "England",
    apiFootballId: null,
    required: false,
  },
];

async function connectToDatabase() {
  try {
    logWithCheckpoint("info", "Connecting to MongoDB", "FIND_001");

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
    });

    logWithCheckpoint(
      "info",
      "Successfully connected to MongoDB",
      "FIND_002"
    );
  } catch (error) {
    logError(error, { operation: "connectToDatabase" });
    throw error;
  }
}

async function findVenuesInDatabase() {
  try {
    logWithCheckpoint(
      "info",
      "Searching for popular venues in database",
      "FIND_003"
    );

    const results = [];

    for (const stadium of popularStadiums) {
      let venue = null;
      let foundBy = "";

      // Try to find by API Football ID first (most reliable)
      if (stadium.apiFootballId) {
        venue = await Venue.findOne({
          "externalIds.apiFootball": stadium.apiFootballId,
        }).lean();
        if (venue) {
          foundBy = `API Football ID: ${stadium.apiFootballId}`;
        }
      }

      // If not found by ID, try by name and city
      if (!venue) {
        for (const searchTerm of stadium.searchTerms) {
          // Escape special regex characters
          const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const escapedCity = stadium.city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

          // Try exact match first
          venue = await Venue.findOne({
            name: { $regex: new RegExp(`^${escapedTerm}$`, "i") },
            city_en: { $regex: new RegExp(`^${escapedCity}$`, "i") },
          }).lean();

          if (venue) {
            foundBy = `Name: "${searchTerm}" in ${stadium.city}`;
            break;
          }

          // If not found, try partial match
          if (!venue) {
            venue = await Venue.findOne({
              name: { $regex: escapedTerm, $options: "i" },
              city_en: { $regex: escapedCity, $options: "i" },
            }).lean();

            if (venue) {
              foundBy = `Partial match: "${searchTerm}" in ${stadium.city}`;
              break;
            }
          }
        }
      }

      results.push({
        searchTerm: stadium.searchTerms[0],
        city: stadium.city,
        country: stadium.country,
        required: stadium.required || false,
        found: !!venue,
        venue: venue
          ? {
              _id: venue._id.toString(),
              name: venue.name,
              city_en: venue.city_en,
              country_en: venue.country_en,
              venueId: venue.venueId,
              apiFootballId: venue.externalIds?.apiFootball || null,
              isPopular: venue.isPopular || false,
              foundBy,
            }
          : null,
      });
    }

    return results;
  } catch (error) {
    logError(error, { operation: "findVenuesInDatabase" });
    throw error;
  }
}

async function main() {
  try {
    // Connect to database
    await connectToDatabase();

    // Find venues
    const results = await findVenuesInDatabase();

    // Display results
    console.log("\n" + "=".repeat(80));
    console.log("🔍 SEARCH RESULTS FOR POPULAR VENUES");
    console.log("=".repeat(80) + "\n");

    const foundVenues = results.filter((r) => r.found);
    const notFoundVenues = results.filter((r) => !r.found);

    // Display found venues
    console.log(`✅ Found ${foundVenues.length} venues:\n`);
    foundVenues.forEach((result, index) => {
      const venue = result.venue;
      const marker = result.required ? "⭐" : "  ";
      console.log(`${marker} ${index + 1}. ${result.searchTerm}`);
      console.log(`   Location: ${result.city}, ${result.country}`);
      console.log(`   Database ID: ${venue._id}`);
      console.log(`   Venue Name (DB): ${venue.name}`);
      console.log(`   City (DB): ${venue.city_en}`);
      console.log(`   Country (DB): ${venue.country_en}`);
      console.log(`   Venue ID: ${venue.venueId}`);
      if (venue.apiFootballId) {
        console.log(`   API Football ID: ${venue.apiFootballId}`);
      }
      console.log(`   isPopular (current): ${venue.isPopular}`);
      console.log(`   Found by: ${venue.foundBy}`);
      console.log();
    });

    // Display not found venues
    if (notFoundVenues.length > 0) {
      console.log(`\n❌ Not found ${notFoundVenues.length} venues:\n`);
      notFoundVenues.forEach((result, index) => {
        const marker = result.required ? "⭐ REQUIRED" : "  ";
        console.log(`${marker} ${index + 1}. ${result.searchTerm}`);
        console.log(`   Location: ${result.city}, ${result.country}`);
        console.log();
      });
    }

    // Summary
    console.log("\n" + "=".repeat(80));
    console.log("📊 SUMMARY");
    console.log("=".repeat(80));
    console.log(`Total searched: ${results.length}`);
    console.log(`Found: ${foundVenues.length}`);
    console.log(`Not found: ${notFoundVenues.length}`);
    
    const requiredFound = foundVenues.filter((r) => r.required).length;
    const requiredNotFound = notFoundVenues.filter((r) => r.required).length;
    
    console.log(`\nRequired venues (Camp Nou & Bernabéu):`);
    console.log(`  Found: ${requiredFound}/2`);
    console.log(`  Not found: ${requiredNotFound}/2`);

    if (requiredNotFound > 0) {
      console.log("\n⚠️  WARNING: Some required venues were not found!");
    }

    // List of IDs for easy copy-paste
    if (foundVenues.length > 0) {
      console.log("\n" + "=".repeat(80));
      console.log("📋 VENUE IDs (for reference):");
      console.log("=".repeat(80));
      foundVenues.forEach((result) => {
        const venue = result.venue;
        console.log(`${venue.name}: ${venue._id}`);
      });
    }

    console.log();
  } catch (error) {
    logError(error, { operation: "main" });
    console.error("❌ Error searching venues:", error.message);
    process.exit(1);
  } finally {
    // Disconnect from database
    await mongoose.disconnect();
    logWithCheckpoint("info", "Disconnected from MongoDB", "FIND_010");
  }
}

// Run the script
main();

