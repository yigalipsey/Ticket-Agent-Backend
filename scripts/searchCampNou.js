import dotenv from "dotenv";
import mongoose from "mongoose";
import Venue from "../src/models/Venue.js";
import { logWithCheckpoint } from "../src/utils/logger.js";

dotenv.config();

async function connectToDatabase() {
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
  });
  logWithCheckpoint("info", "Connected to MongoDB", "SEARCH_001");
}

async function searchCampNou() {
  // Try different search patterns for Camp Nou
  const searchPatterns = [
    { name: { $regex: /Camp Nou/i } },
    { name: { $regex: /Camp Nou/i }, city_en: { $regex: /Barcelona/i } },
    { name: { $regex: /Spotify/i }, city_en: { $regex: /Barcelona/i } },
    { city_en: { $regex: /Barcelona/i } },
  ];

  console.log("\n🔍 Searching for Camp Nou in database...\n");

  for (const pattern of searchPatterns) {
    const venues = await Venue.find(pattern).lean();
    
    if (venues.length > 0) {
      console.log(`Found ${venues.length} venue(s) with pattern:`, pattern);
      venues.forEach((venue) => {
        console.log("\n  Venue Details:");
        console.log(`  - _id: ${venue._id}`);
        console.log(`  - name: ${venue.name}`);
        console.log(`  - city_en: ${venue.city_en}`);
        console.log(`  - country_en: ${venue.country_en || "N/A"}`);
        console.log(`  - venueId: ${venue.venueId}`);
        console.log(`  - apiFootballId: ${venue.externalIds?.apiFootball || "N/A"}`);
        console.log(`  - isPopular: ${venue.isPopular || false}`);
      });
      console.log();
    }
  }

  // Also search all Barcelona venues
  console.log("\n📋 All venues in Barcelona:\n");
  const barcelonaVenues = await Venue.find({
    city_en: { $regex: /Barcelona/i },
  }).lean();
  
  if (barcelonaVenues.length > 0) {
    barcelonaVenues.forEach((venue, index) => {
      console.log(`${index + 1}. ${venue.name}`);
      console.log(`   ID: ${venue._id}`);
      console.log(`   City: ${venue.city_en}`);
      console.log(`   Venue ID: ${venue.venueId}`);
      if (venue.externalIds?.apiFootball) {
        console.log(`   API Football ID: ${venue.externalIds.apiFootball}`);
      }
      console.log();
    });
  } else {
    console.log("  No venues found in Barcelona");
  }
}

async function main() {
  try {
    await connectToDatabase();
    await searchCampNou();
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

main();

