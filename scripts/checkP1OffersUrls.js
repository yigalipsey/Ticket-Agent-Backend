import "dotenv/config";
import mongoose from "mongoose";
import Offer from "../src/models/Offer.js";
import Supplier from "../src/models/Supplier.js";
import FootballEvent from "../src/models/FootballEvent.js";

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
    })
      .populate("fixtureId", "slug homeTeam awayTeam date")
      .lean();

    console.log(`Found ${offers.length} P1 offers\n`);
    console.log("=".repeat(80));
    console.log("Checking URLs...");
    console.log("=".repeat(80));

    const badUrls = [];
    const goodUrls = [];

    offers.forEach((offer) => {
      if (!offer.url) {
        badUrls.push({
          offerId: offer._id,
          fixture: offer.fixtureId?.slug || "N/A",
          reason: "No URL",
        });
        return;
      }

      // Extract the actual P1 URL from the affiliate link
      let actualUrl = offer.url;
      const urlMatch = offer.url.match(/url=([^&]+)/);
      if (urlMatch) {
        try {
          actualUrl = decodeURIComponent(urlMatch[1]);
        } catch (e) {
          // If decoding fails, use original URL
        }
      }

      const url = actualUrl.toLowerCase();

      // Check if it's a general page (not a specific match page)
      const isGeneralPage =
        url === "https://www.p1travel.com/en" ||
        url === "https://p1travel.com/en" ||
        url === "https://www.p1travel.com/en/" ||
        url === "https://p1travel.com/en/" ||
        (url.includes("p1travel.com/en?") && !url.includes("/football/")) ||
        (url.includes("p1travel.com/en#") && !url.includes("/football/"));

      // Check if it contains a specific match path (not just ending with /)
      const hasMatchPath =
        (url.includes("/football/") ||
          url.includes("/en/football/") ||
          url.includes("/bundesliga/") ||
          url.includes("/premier-league/") ||
          url.includes("/champions-league/") ||
          url.includes("/la-liga/") ||
          url.includes("/serie-a/") ||
          url.includes("/ligue-1/") ||
          url.includes("/eredivisie/") ||
          url.includes("/primeira-liga/")) &&
        !url.endsWith("/football/") &&
        !url.endsWith("/champions-league/") &&
        !url.endsWith("/premier-league/") &&
        !url.endsWith("/bundesliga/") &&
        !url.endsWith("/la-liga/") &&
        !url.endsWith("/serie-a/") &&
        !url.endsWith("/ligue-1/");

      if (isGeneralPage || !hasMatchPath) {
        badUrls.push({
          offerId: offer._id,
          fixture: offer.fixtureId?.slug || "N/A",
          url: actualUrl.substring(0, 120),
          reason: isGeneralPage ? "General page" : "No match path",
        });
      } else {
        goodUrls.push({
          offerId: offer._id,
          fixture: offer.fixtureId?.slug || "N/A",
          url: actualUrl.substring(0, 100),
        });
      }
    });

    console.log(`\n📊 Results:`);
    console.log(`✅ Good URLs (specific match pages): ${goodUrls.length}`);
    console.log(`❌ Bad URLs (general pages or missing): ${badUrls.length}`);

    if (badUrls.length > 0) {
      console.log("\n" + "=".repeat(80));
      console.log("❌ Offers with bad URLs:");
      console.log("=".repeat(80));
      badUrls.forEach((item, idx) => {
        console.log(`\n${idx + 1}. Fixture: ${item.fixture}`);
        console.log(`   Offer ID: ${item.offerId}`);
        console.log(`   URL: ${item.url}`);
        console.log(`   Reason: ${item.reason}`);
      });
    }

    // Show sample of good URLs
    if (goodUrls.length > 0) {
      console.log("\n" + "=".repeat(80));
      console.log("✅ Sample of good URLs (first 5):");
      console.log("=".repeat(80));
      goodUrls.slice(0, 5).forEach((item, idx) => {
        console.log(`\n${idx + 1}. Fixture: ${item.fixture}`);
        console.log(`   URL: ${item.url}...`);
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
