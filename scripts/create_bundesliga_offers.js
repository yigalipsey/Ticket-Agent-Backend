import "dotenv/config";
import mongoose from "mongoose";
import FootballEvent from "../src/models/FootballEvent.js";
import Supplier from "../src/models/Supplier.js";
import Offer from "../src/models/Offer.js";
import League from "../src/models/League.js";

const LEAGUE_SLUG = "bundesliga";
const LEAGUE_NAME = "Bundesliga";
const SUPPLIER_SLUG = "hellotickets";

async function connectDB() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined in .env");
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");
}

async function createBundesligaOffers() {
  try {
    console.log("================================================================================");
    console.log("🔍 Creating Bundesliga Offers");
    console.log("================================================================================");
    console.log("");

    // 1. Find HelloTickets supplier
    const supplier = await Supplier.findOne({ slug: SUPPLIER_SLUG });
    if (!supplier) {
      throw new Error(`Supplier "${SUPPLIER_SLUG}" not found`);
    }
    console.log(`✅ Found supplier: ${supplier.name} (${supplier._id})\n`);

    // 2. Find Bundesliga league
    const league = await League.findOne({ slug: LEAGUE_SLUG });
    if (!league) {
      throw new Error(`League "${LEAGUE_SLUG}" not found`);
    }
    console.log(`✅ Found league: ${league.name} (${league._id})\n`);

    // 3. Find all Bundesliga fixtures with HelloTickets mapping
    const now = new Date();
    const fixtures = await FootballEvent.find({
      league: league._id,
      date: { $gte: now }, // Only future matches
      "supplierExternalIds.supplierRef": supplier._id,
    })
      .select("slug date supplierExternalIds minPrice")
      .lean();

    console.log(
      `📊 Found ${fixtures.length} ${LEAGUE_NAME} fixtures with HelloTickets mapping (future matches only)\n`
    );

    const stats = {
      totalFixtures: fixtures.length,
      offersCreated: 0,
      offersUpdated: 0,
      skippedNoMapping: 0,
      skippedNoPrice: 0,
      skippedNoUrl: 0,
      skippedPastEvent: 0,
      errors: 0,
    };

    const errorDetails = [];

    console.log("================================================================================");
    console.log("📋 Processing fixtures...");
    console.log("================================================================================");
    console.log("");

    // 4. For each fixture, create/update offer
    for (let i = 0; i < fixtures.length; i++) {
      const fixture = fixtures[i];
      const fixtureNum = i + 1;

      try {
        // Skip past events
        if (new Date(fixture.date) < now) {
          stats.skippedPastEvent++;
          continue;
        }

        // Find HelloTickets mapping in supplierExternalIds
        const supplierIdStr = supplier._id.toString();
        const helloTicketsMapping = fixture.supplierExternalIds?.find(
          (mapping) => {
            const mappingSupplierId =
              mapping.supplierRef?._id?.toString() ||
              mapping.supplierRef?.toString();
            return mappingSupplierId === supplierIdStr;
          }
        );

        if (!helloTicketsMapping) {
          stats.skippedNoMapping++;
          console.log(
            `[${fixtureNum}/${fixtures.length}] ⚠️  Skipping ${fixture.slug}: No HelloTickets mapping`
          );
          continue;
        }

        // Get price - priority: minPrice from fixture > metadata price
        let price = null;
        let currency = "EUR";

        if (fixture.minPrice?.amount) {
          price = fixture.minPrice.amount;
          currency = fixture.minPrice.currency || "EUR";
        } else {
          // Try to get from metadata
          const metadata = helloTicketsMapping.metadata || {};
          if (metadata instanceof Map) {
            price = metadata.get("min_price") || metadata.get("price");
            currency = metadata.get("currency") || "EUR";
          } else {
            price = metadata.min_price || metadata.price;
            currency = metadata.currency || "EUR";
          }
        }

        if (!price || price <= 0) {
          stats.skippedNoPrice++;
          console.log(
            `[${fixtureNum}/${fixtures.length}] ⚠️  Skipping ${fixture.slug}: No valid price`
          );
          continue;
        }

        // Get affiliate URL from metadata
        const metadata = helloTicketsMapping.metadata || {};
        let affiliateUrl = null;

        if (metadata instanceof Map) {
          affiliateUrl =
            metadata.get("affiliateUrl") ||
            metadata.get("url") ||
            metadata.get("helloTicketsAffiliateUrl");
        } else {
          affiliateUrl =
            metadata.affiliateUrl ||
            metadata.url ||
            metadata.helloTicketsAffiliateUrl;
        }

        if (!affiliateUrl) {
          stats.skippedNoUrl++;
          console.log(
            `[${fixtureNum}/${fixtures.length}] ⚠️  Skipping ${fixture.slug}: No URL found`
          );
          continue;
        }

        // Check if offer already exists
        const existingOffer = await Offer.findOne({
          fixtureId: fixture._id,
          ownerType: "Supplier",
          ownerId: supplier._id,
        });

        if (existingOffer) {
          // Update existing offer if price or URL changed
          const needsUpdate =
            existingOffer.price !== price ||
            existingOffer.currency !== currency ||
            existingOffer.url !== affiliateUrl;

          if (needsUpdate) {
            await Offer.findByIdAndUpdate(
              existingOffer._id,
              {
                $set: {
                  price: price,
                  currency: currency,
                  url: affiliateUrl,
                  isAvailable: true,
                },
              },
              { new: true }
            );
            stats.offersUpdated++;
            console.log(
              `[${fixtureNum}/${fixtures.length}] 🔄 Updated: ${fixture.slug} - Price: ${price} ${currency}`
            );
          } else {
            console.log(
              `[${fixtureNum}/${fixtures.length}] ⏭️  Skipped: ${fixture.slug} (no changes needed)`
            );
          }
        } else {
          // Create new offer
          const newOffer = new Offer({
            fixtureId: fixture._id,
            ownerType: "Supplier",
            ownerId: supplier._id,
            price: price,
            currency: currency,
            ticketType: "standard",
            isHospitality: false,
            isAvailable: true,
            url: affiliateUrl,
          });

          await newOffer.save();
          stats.offersCreated++;
          console.log(
            `[${fixtureNum}/${fixtures.length}] ✅ Created: ${fixture.slug} - Price: ${price} ${currency}`
          );
        }
      } catch (error) {
        stats.errors++;
        const errorMsg = `Error processing ${fixture.slug}: ${error.message}`;
        console.error(`[${fixtureNum}/${fixtures.length}] ❌ ${errorMsg}`);
        errorDetails.push({
          slug: fixture.slug,
          error: error.message,
        });
      }
    }

    console.log("");
    console.log("================================================================================");
    console.log("📊 SUMMARY");
    console.log("================================================================================");
    console.log(`Total fixtures scanned: ${stats.totalFixtures}`);
    console.log(`✅ Offers created: ${stats.offersCreated}`);
    console.log(`🔄 Offers updated: ${stats.offersUpdated}`);
    console.log(`⏭️  Skipped - no mapping: ${stats.skippedNoMapping}`);
    console.log(`⏭️  Skipped - no price: ${stats.skippedNoPrice}`);
    console.log(`⏭️  Skipped - no URL: ${stats.skippedNoUrl}`);
    console.log(`⏭️  Skipped - past events: ${stats.skippedPastEvent}`);
    if (stats.errors > 0) {
      console.log(`❌ Errors: ${stats.errors}`);
      if (errorDetails.length > 0) {
        console.log("\nError details (first 10):");
        errorDetails.slice(0, 10).forEach((err) => {
          console.log(`   ${err.slug}: ${err.error}`);
        });
      }
    }
    console.log("");

    // Verification
    console.log("================================================================================");
    console.log("🔍 VERIFICATION");
    console.log("================================================================================");
    console.log("");

    const totalOffers = await Offer.countDocuments({
      fixtureId: { $in: fixtures.map((f) => f._id) },
      ownerType: "Supplier",
      ownerId: supplier._id,
    });
    console.log(`📊 Total offers for ${LEAGUE_NAME}: ${totalOffers}`);

    const offersWithUrl = await Offer.countDocuments({
      fixtureId: { $in: fixtures.map((f) => f._id) },
      ownerType: "Supplier",
      ownerId: supplier._id,
      url: { $exists: true, $ne: null },
    });
    console.log(`📊 Offers with URL: ${offersWithUrl}`);

    const offersWithPrice = await Offer.countDocuments({
      fixtureId: { $in: fixtures.map((f) => f._id) },
      ownerType: "Supplier",
      ownerId: supplier._id,
      price: { $gt: 0 },
    });
    console.log(`📊 Offers with price > 0: ${offersWithPrice}`);

    console.log("");
    console.log("================================================================================");
    console.log("✅ Done!");
    console.log("================================================================================");
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    throw error;
  }
}

async function run() {
  try {
    await connectDB();
    await createBundesligaOffers();
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
}

run();




