import dotenv from "dotenv";
import mongoose from "mongoose";
import Venue from "../src/models/Venue.js";

dotenv.config();

const citiesToSearch = [
  { city: "Barcelona", country: "Spain" },
  { city: "Madrid", country: "Spain" },
  { city: "Manchester", country: "England" },
  { city: "Liverpool", country: "England" },
  { city: "London", country: "England" },
  { city: "Munich", country: "Germany" },
  { city: "Milan", country: "Italy" },
  { city: "Dortmund", country: "Germany" },
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("\n🔍 Searching for venues in key cities...\n");

  for (const { city, country } of citiesToSearch) {
    const venues = await Venue.find({
      city_en: { $regex: new RegExp(city, "i") },
    }).lean();

    if (venues.length > 0) {
      console.log(`\n📍 ${city}, ${country} (${venues.length} venue(s)):`);
      venues.forEach((venue) => {
        console.log(`  - ${venue.name}`);
        console.log(`    ID: ${venue._id}`);
        console.log(`    Venue ID: ${venue.venueId}`);
        if (venue.externalIds?.apiFootball) {
          console.log(`    API Football ID: ${venue.externalIds.apiFootball}`);
        }
        console.log();
      });
    }
  }

  await mongoose.disconnect();
}

main().catch(console.error);

