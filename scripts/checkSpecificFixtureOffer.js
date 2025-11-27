import "dotenv/config";
import mongoose from "mongoose";
import Offer from "../src/models/Offer.js";
import Supplier from "../src/models/Supplier.js";
import FootballEvent from "../src/models/FootballEvent.js";
import Team from "../src/models/Team.js";
import League from "../src/models/League.js";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");

  try {
    const fixtureId = "6926e33ca3a933930dad474a";
    const p1 = await Supplier.findOne({ slug: "p1-travel" });
    
    if (!p1) {
      throw new Error("P1 Travel supplier not found");
    }

    const fixture = await FootballEvent.findById(fixtureId)
      .populate("homeTeam", "name_en")
      .populate("awayTeam", "name_en")
      .populate("league", "name")
      .lean();

    if (!fixture) {
      console.log(`❌ Fixture not found: ${fixtureId}`);
      return;
    }

    console.log("Fixture:");
    console.log(`  ${fixture.homeTeam.name_en} vs ${fixture.awayTeam.name_en}`);
    console.log(`  League: ${fixture.league.name}`);
    console.log(`  Date: ${fixture.date}`);
    console.log(`  Slug: ${fixture.slug}`);

    console.log("\nP1 Offers:");
    const offers = await Offer.find({
      ownerType: "Supplier",
      ownerId: p1._id,
      fixtureId: fixtureId,
    }).lean();

    if (offers.length === 0) {
      console.log("  ❌ No P1 offers found for this fixture");
    } else {
      offers.forEach((offer, idx) => {
        console.log(`\nOffer ${idx + 1}:`);
        console.log(`  ID: ${offer._id}`);
        console.log(`  Price: ${offer.price} ${offer.currency}`);
        console.log(`  Full URL: ${offer.url}`);
        
        // Extract and decode the actual P1 URL
        const urlMatch = offer.url.match(/url=([^&]+)/);
        if (urlMatch) {
          try {
            const decodedUrl = decodeURIComponent(urlMatch[1]);
            console.log(`  Decoded URL: ${decodedUrl}`);
            
            // Check if it's a general page
            const isGeneral = 
              decodedUrl === "https://www.p1travel.com/en" ||
              decodedUrl === "https://p1travel.com/en" ||
              decodedUrl === "https://www.p1travel.com/en/" ||
              decodedUrl === "https://p1travel.com/en/" ||
              (decodedUrl.includes("p1travel.com/en?") && !decodedUrl.includes("/football/")) ||
              (decodedUrl.includes("p1travel.com/en#") && !decodedUrl.includes("/football/"));
            
            if (isGeneral) {
              console.log(`  ⚠️  WARNING: This is a GENERAL page, not a specific match page!`);
            } else {
              console.log(`  ✅ This is a specific match page`);
            }
          } catch (e) {
            console.log(`  ⚠️  Could not decode URL: ${e.message}`);
          }
        } else {
          console.log(`  ⚠️  Could not extract URL from affiliate link`);
        }
      });
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
}

run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});



