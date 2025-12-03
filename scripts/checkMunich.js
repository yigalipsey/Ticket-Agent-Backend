import dotenv from "dotenv";
import mongoose from "mongoose";
import Venue from "../src/models/Venue.js";

dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const venues = await Venue.find({
    city_en: { $regex: /Munich|München/i }
  }).lean();
  
  console.log('\n📍 Munich venues:');
  if (venues.length === 0) {
    console.log('  No venues found');
  } else {
    venues.forEach(v => {
      console.log(`- ${v.name}`);
      console.log(`  ID: ${v._id}`);
      console.log(`  Venue ID: ${v.venueId}`);
      if (v.externalIds?.apiFootball) {
        console.log(`  API Football ID: ${v.externalIds.apiFootball}`);
      }
      console.log();
    });
  }
  
  await mongoose.disconnect();
}

main().catch(console.error);

