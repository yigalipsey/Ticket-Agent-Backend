import "dotenv/config";
import mongoose from "mongoose";
import FootballEvent from "../src/models/FootballEvent.js";
import Supplier from "../src/models/Supplier.js";
import Offer from "../src/models/Offer.js";

const LEAGUE_ID = "68d6809aa0fb97844d2084b9"; // Premier League
const LEAGUE_NAME = "Premier League";
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

    // 2. Find all Premier League fixtures with HelloTickets mapping
    const fixtures = await FootballEvent.find({
      league: LEAGUE_ID,
      "supplierExternalIds.supplierRef": supplier._id,
    }).lean();

    console.log(
      `📊 Found ${fixtures.length} ${LEAGUE_NAME} fixtures with HelloTickets mapping\n`
    );

    let stats = {
      totalFixtures: fixtures.length,
      offersCreated: 0,
      offersUpdated: 0,
      skippedNoPrice: 0,
      skippedNoUrl: 0,
      errors: 0,
    };

    // 3. For each fixture, create/update offer with lowest price and URL
    for (const fixture of fixtures) {
      try {
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
          continue;
        }

        // Get price and URL from metadata
        const metadata = helloTicketsMapping.metadata || {};

        // Get minimum price (priority: minPrice > price)
        const minPrice = metadata.minPrice || metadata.price;

        if (!minPrice || minPrice <= 0) {
          stats.skippedNoPrice++;
          console.log(`⚠️  Skipping ${fixture.slug}: No valid price found`);
          continue;
        }

        // Get affiliate URL (priority: helloTicketsAffiliateUrl > affiliateUrl > url)
        const affiliateUrl =
          metadata.helloTicketsAffiliateUrl ||
          metadata.affiliateUrl ||
          metadata.url ||
          metadata.helloTicketsUrl;

        if (!affiliateUrl) {
          stats.skippedNoUrl++;
          console.log(`⚠️  Skipping ${fixture.slug}: No URL found`);
          continue;
        }

        // Get currency (default: EUR)
        const currency = metadata.currency || "EUR";

        // Check if offer already exists
        const existingOffer = await Offer.findOne({
          fixtureId: fixture._id,
          ownerType: "Supplier",
          ownerId: supplier._id,
        });

        if (existingOffer) {
          // Update existing offer if price or URL changed
          const needsUpdate =
            existingOffer.price !== minPrice ||
            existingOffer.currency !== currency ||
            existingOffer.url !== affiliateUrl;

          if (needsUpdate) {
            await Offer.findByIdAndUpdate(existingOffer._id, {
              $set: {
                price: minPrice,
                currency: currency,
                url: affiliateUrl,
                isAvailable: true,
              },
            });
            stats.offersUpdated++;
            console.log(
              `✅ Updated offer for ${
                fixture.slug
              }: ${currency} ${minPrice} - ${affiliateUrl.substring(0, 60)}...`
            );
          }
        } else {
          // Create new offer
          const newOffer = new Offer({
            fixtureId: fixture._id,
            ownerType: "Supplier",
            ownerId: supplier._id,
            price: minPrice,
            currency: currency,
            ticketType: "standard",
            isHospitality: false,
            isAvailable: true,
            url: affiliateUrl,
          });

          await newOffer.save();
          stats.offersCreated++;
          console.log(
            `✅ Created offer for ${
              fixture.slug
            }: ${currency} ${minPrice} - ${affiliateUrl.substring(0, 60)}...`
          );
        }
      } catch (error) {
        stats.errors++;
        console.error(
          `❌ Error processing fixture ${fixture.slug}:`,
          error.message
        );
      }
    }

    // 4. Print summary
    console.log(`\n📊 ${LEAGUE_NAME} Offers Summary`);
    console.log("==================");
    console.log(`Total fixtures with mapping: ${stats.totalFixtures}`);
    console.log(`Offers created: ${stats.offersCreated}`);
    console.log(`Offers updated: ${stats.offersUpdated}`);
    console.log(`Skipped (no price): ${stats.skippedNoPrice}`);
    console.log(`Skipped (no URL): ${stats.skippedNoUrl}`);
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



