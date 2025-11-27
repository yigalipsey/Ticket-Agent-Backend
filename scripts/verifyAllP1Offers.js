import "dotenv/config";
import mongoose from "mongoose";
import Offer from "../src/models/Offer.js";
import Supplier from "../src/models/Supplier.js";
import FootballEvent from "../src/models/FootballEvent.js";
import Team from "../src/models/Team.js";
import League from "../src/models/League.js";

const AFFILIATE_LINK = "https://p1travel.prf.hn/click/camref:1100l5y3LS";
const AFFILIATE_REF = "camref:1100l5y3LS";

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
      .populate("fixtureId", "slug homeTeam awayTeam date league")
      .lean();

    console.log(`Found ${offers.length} P1 offers\n`);
    console.log("=".repeat(80));
    console.log("Verifying all P1 offers...");
    console.log("=".repeat(80));

    const results = {
      total: offers.length,
      valid: 0,
      missingUrl: 0,
      missingAffiliate: 0,
      generalPage: 0,
      noMatchPath: 0,
      issues: [],
    };

    for (const offer of offers) {
      const fixture = offer.fixtureId;
      const fixtureInfo = fixture
        ? `${fixture.slug || "N/A"}`
        : "No fixture";

      // Check 1: URL exists
      if (!offer.url || offer.url.trim() === "") {
        results.missingUrl++;
        results.issues.push({
          offerId: offer._id,
          fixture: fixtureInfo,
          issue: "Missing URL",
        });
        continue;
      }

      // Check 2: Contains affiliate link
      if (!offer.url.includes(AFFILIATE_REF)) {
        results.missingAffiliate++;
        results.issues.push({
          offerId: offer._id,
          fixture: fixtureInfo,
          issue: "Missing affiliate link",
          url: offer.url.substring(0, 100),
        });
        continue;
      }

      // Extract the actual P1 URL from the affiliate link
      // Support both formats: /destination:URL and ?url=URL
      let actualUrl = offer.url;
      let urlMatch = offer.url.match(/\/destination:(.+)$/);
      
      if (!urlMatch) {
        // Try old format: ?url=...
        urlMatch = offer.url.match(/[?&]url=([^&]+)/);
        if (urlMatch) {
          try {
            actualUrl = decodeURIComponent(urlMatch[1]);
          } catch (e) {
            results.noMatchPath++;
            results.issues.push({
              offerId: offer._id,
              fixture: fixtureInfo,
              issue: "Could not decode URL",
              url: offer.url.substring(0, 100),
            });
            continue;
          }
        } else {
          results.noMatchPath++;
          results.issues.push({
            offerId: offer._id,
            fixture: fixtureInfo,
            issue: "Could not extract URL from affiliate link",
            url: offer.url.substring(0, 100),
          });
          continue;
        }
      } else {
        // New format: /destination:URL (no encoding needed)
        actualUrl = urlMatch[1];
      }

      const url = actualUrl.toLowerCase();

      // Check 3: Not a general page
      const isGeneralPage =
        url === "https://www.p1travel.com/en" ||
        url === "https://p1travel.com/en" ||
        url === "https://www.p1travel.com/en/" ||
        url === "https://p1travel.com/en/" ||
        (url.includes("p1travel.com/en?") && !url.includes("/football/")) ||
        (url.includes("p1travel.com/en#") && !url.includes("/football/"));

      if (isGeneralPage) {
        results.generalPage++;
        results.issues.push({
          offerId: offer._id,
          fixture: fixtureInfo,
          issue: "General page (not specific match)",
          url: actualUrl,
        });
        continue;
      }

      // Check 4: Contains specific match path
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

      if (!hasMatchPath) {
        results.noMatchPath++;
        results.issues.push({
          offerId: offer._id,
          fixture: fixtureInfo,
          issue: "No specific match path",
          url: actualUrl,
        });
        continue;
      }

      // All checks passed
      results.valid++;
    }

    // Print summary
    console.log("\n" + "=".repeat(80));
    console.log("📊 Verification Results");
    console.log("=".repeat(80));
    console.log(`Total offers: ${results.total}`);
    console.log(`✅ Valid offers (with specific match URL + affiliate link): ${results.valid}`);
    console.log(`❌ Issues found: ${results.total - results.valid}`);
    console.log(`   - Missing URL: ${results.missingUrl}`);
    console.log(`   - Missing affiliate link: ${results.missingAffiliate}`);
    console.log(`   - General page: ${results.generalPage}`);
    console.log(`   - No match path: ${results.noMatchPath}`);

    // Print issues
    if (results.issues.length > 0) {
      console.log("\n" + "=".repeat(80));
      console.log("❌ Offers with issues:");
      console.log("=".repeat(80));
      results.issues.forEach((item, idx) => {
        console.log(`\n${idx + 1}. Fixture: ${item.fixture}`);
        console.log(`   Offer ID: ${item.offerId}`);
        console.log(`   Issue: ${item.issue}`);
        if (item.url) {
          console.log(`   URL: ${item.url.substring(0, 120)}`);
        }
      });
    }

    // Print success rate
    const successRate = ((results.valid / results.total) * 100).toFixed(2);
    console.log("\n" + "=".repeat(80));
    console.log(`✅ Success rate: ${successRate}%`);
    console.log("=".repeat(80));
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

