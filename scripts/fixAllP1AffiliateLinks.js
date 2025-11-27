import "dotenv/config";
import mongoose from "mongoose";
import Offer from "../src/models/Offer.js";
import Supplier from "../src/models/Supplier.js";

const AFFILIATE_LINK_BASE = "https://p1travel.prf.hn/click/camref:1100l5y3LS";
const OLD_PATTERN = /camref:1100l5y3LS[?&]url=([^&]+)/;
const OLD_PATTERN_ALT = /camref:1100l5y3LS\?url=(.+)/;

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");

  try {
    const p1 = await Supplier.findOne({ slug: "p1-travel" });
    if (!p1) {
      throw new Error("P1 Travel supplier not found");
    }

    const offers = await Offer.find({
      ownerType: "Supplier",
      ownerId: p1._id,
    }).lean();

    console.log(`Found ${offers.length} P1 offers\n`);
    console.log("=".repeat(80));
    console.log("Fixing affiliate links...");
    console.log("=".repeat(80));

    let fixed = 0;
    let alreadyCorrect = 0;
    let errors = 0;

    for (const offer of offers) {
      try {
        if (!offer.url) {
          continue;
        }

        // Check if already in correct format
        if (offer.url.includes("/destination:")) {
          alreadyCorrect++;
          continue;
        }

        // Extract the original P1 URL from old format
        let originalUrl = null;
        
        // Try pattern 1: ?url=...
        const match1 = offer.url.match(/url=([^&]+)/);
        if (match1) {
          try {
            originalUrl = decodeURIComponent(match1[1]);
          } catch (e) {
            console.warn(`Could not decode URL for offer ${offer._id}: ${e.message}`);
            errors++;
            continue;
          }
        } else {
          // Try to extract from other patterns
          const match2 = offer.url.match(/p1travel\.com[^&]*/);
          if (match2) {
            originalUrl = match2[0];
            if (!originalUrl.startsWith("http")) {
              originalUrl = "https://www." + originalUrl;
            }
          }
        }

        if (!originalUrl || !originalUrl.includes("p1travel.com")) {
          console.warn(`Could not extract original URL for offer ${offer._id}`);
          errors++;
          continue;
        }

        // Build new affiliate link with destination: format
        const newUrl = `${AFFILIATE_LINK_BASE}/destination:${originalUrl}`;

        // Update offer
        await Offer.updateOne(
          { _id: offer._id },
          { $set: { url: newUrl } }
        );

        fixed++;
        
        if (fixed % 50 === 0) {
          console.log(`Fixed ${fixed} offers...`);
        }
      } catch (error) {
        console.error(`Error fixing offer ${offer._id}:`, error.message);
        errors++;
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log("📊 Results");
    console.log("=".repeat(80));
    console.log(`Total offers: ${offers.length}`);
    console.log(`✅ Fixed: ${fixed}`);
    console.log(`✅ Already correct: ${alreadyCorrect}`);
    console.log(`❌ Errors: ${errors}`);

    // Show sample of fixed URLs
    if (fixed > 0) {
      console.log("\n" + "=".repeat(80));
      console.log("Sample of fixed URLs:");
      console.log("=".repeat(80));
      const sampleOffers = await Offer.find({
        ownerType: "Supplier",
        ownerId: p1._id,
        url: { $regex: "/destination:" },
      })
        .limit(5)
        .lean();
      
      sampleOffers.forEach((offer, idx) => {
        console.log(`\n${idx + 1}. Offer ID: ${offer._id}`);
        console.log(`   URL: ${offer.url.substring(0, 120)}...`);
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



