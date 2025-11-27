import "dotenv/config";
import mongoose from "mongoose";
import FootballEvent from "../src/models/FootballEvent.js";
import Supplier from "../src/models/Supplier.js";
import Offer from "../src/models/Offer.js";

// Set league ID here - can be Champions League or Premier League
const LEAGUE_ID = process.env.LEAGUE_ID || "68e257c87413ca349124a5e3"; // Default: Champions League
const LEAGUE_NAME = process.env.LEAGUE_NAME || "Champions League";
const SUPPLIER_SLUG = "hellotickets";

async function run() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined");
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");

  try {
    // 1. Find HelloTickets supplier
    const supplier = await Supplier.findOne({ slug: SUPPLIER_SLUG });
    if (!supplier) {
      throw new Error(`Supplier "${SUPPLIER_SLUG}" not found`);
    }
    console.log(`✅ Found supplier: ${supplier.name} (${supplier._id})\n`);

    // 2. Find all Champions League fixtures
    const fixtures = await FootballEvent.find({
      league: LEAGUE_ID,
    }).lean();

    console.log(`📊 Found ${fixtures.length} ${LEAGUE_NAME} fixtures\n`);

    let stats = {
      totalFixtures: fixtures.length,
      fixturesWithMapping: 0,
      fixturesWithoutMapping: 0,
      offersUpdated: 0,
      offersNotFound: 0,
      offersAlreadyHaveUrl: 0,
      errors: 0,
    };

    // 3. For each fixture, update offers with affiliate URL
    for (const fixture of fixtures) {
      try {
        // Find HelloTickets mapping in supplierExternalIds
        // Handle both ObjectId and string comparison
        const supplierIdStr = supplier._id.toString();
        const helloTicketsMapping = fixture.supplierExternalIds?.find(
          (mapping) => {
            const mappingSupplierId =
              mapping.supplierRef?._id?.toString() ||
              mapping.supplierRef?.toString();
            return mappingSupplierId === supplierIdStr;
          }
        );

        // Check for affiliate URL in metadata
        // Priority: helloTicketsAffiliateUrl > affiliateUrl > url
        const metadata = helloTicketsMapping?.metadata || {};
        const affiliateUrl =
          metadata.helloTicketsAffiliateUrl ||
          metadata.affiliateUrl ||
          metadata.url;

        if (!affiliateUrl) {
          stats.fixturesWithoutMapping++;
          if (helloTicketsMapping) {
            // Debug: show what fields exist
            console.log(
              `⚠️  Fixture ${fixture.slug} has mapping but no affiliate URL. Metadata keys:`,
              Object.keys(metadata)
            );
          }
          continue;
        }

        stats.fixturesWithMapping++;

        // Find offer for this fixture from HelloTickets supplier
        const offer = await Offer.findOne({
          fixtureId: fixture._id,
          ownerType: "Supplier",
          ownerId: supplier._id,
        });

        if (!offer) {
          stats.offersNotFound++;
          console.log(
            `⚠️  No offer found for fixture: ${fixture.slug} (${fixture._id})`
          );
          continue;
        }

        // Check if URL already exists and is the same
        if (offer.url === affiliateUrl) {
          stats.offersAlreadyHaveUrl++;
          continue;
        }

        // Update offer with affiliate URL
        await Offer.findByIdAndUpdate(offer._id, {
          $set: { url: affiliateUrl },
        });

        stats.offersUpdated++;
        console.log(
          `✅ Updated offer for ${fixture.slug}: ${affiliateUrl.substring(
            0,
            80
          )}...`
        );
      } catch (error) {
        stats.errors++;
        console.error(
          `❌ Error processing fixture ${fixture.slug}:`,
          error.message
        );
      }
    }

    // 4. Print summary
    console.log("\n📊 Update Summary");
    console.log("==================");
    console.log(`Total fixtures: ${stats.totalFixtures}`);
    console.log(
      `Fixtures with HelloTickets mapping: ${stats.fixturesWithMapping}`
    );
    console.log(`Fixtures without mapping: ${stats.fixturesWithoutMapping}`);
    console.log(`Offers updated: ${stats.offersUpdated}`);
    console.log(`Offers not found: ${stats.offersNotFound}`);
    console.log(`Offers already have URL: ${stats.offersAlreadyHaveUrl}`);
    console.log(`Errors: ${stats.errors}`);
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
}

run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
