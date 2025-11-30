import dotenv from "dotenv";
import databaseConnection from "./src/config/database.js";
import FootballEvent from "./src/models/FootballEvent.js";
import Offer from "./src/models/Offer.js";
import { logWithCheckpoint, logError } from "./src/utils/logger.js";

dotenv.config();

async function updateAllMinPrices() {
  try {
    logWithCheckpoint(
      "info",
      "Starting to update min prices for all fixtures",
      "UPDATE_MIN_PRICES_001"
    );

    // Connect to database
    await databaseConnection.connect(process.env.MONGODB_URI);

    logWithCheckpoint(
      "info",
      "Database connected successfully",
      "UPDATE_MIN_PRICES_002"
    );

    // Find ALL fixtures (not just those with minPrice)
    const allFixtures = await FootballEvent.find({}).lean();

    console.log(`\n📊 Found ${allFixtures.length} total fixtures to process`);

    let updated = 0;
    let deleted = 0;
    let unchanged = 0;
    let errors = 0;
    let noOffers = 0;

    for (const fixture of allFixtures) {
      try {
        const fixtureId = fixture._id.toString();

        // Find all available offers for this fixture
        const availableOffers = await Offer.find({
          fixtureId: fixtureId,
          isAvailable: true,
        })
          .sort({ price: 1 }) // Sort by price ascending
          .lean();

        if (availableOffers.length === 0) {
          // No available offers - remove minPrice if it exists
          if (fixture.minPrice && fixture.minPrice.amount) {
            await FootballEvent.findByIdAndUpdate(fixtureId, {
              $unset: { minPrice: "" },
            });

            console.log(
              `❌ Fixture ${fixtureId.substring(
                0,
                8
              )}... - No offers, deleted minPrice (was ${
                fixture.minPrice.amount
              } ${fixture.minPrice.currency})`
            );
            deleted++;
          } else {
            // No offers and no minPrice - skip
            noOffers++;
          }
        } else {
          // Find the cheapest offer (already sorted, so first one is cheapest)
          const cheapestOffer = availableOffers[0];

          // Check if minPrice needs to be updated
          const currentMinPrice = fixture.minPrice;
          const needsUpdate =
            !currentMinPrice ||
            !currentMinPrice.amount ||
            currentMinPrice.amount !== cheapestOffer.price ||
            currentMinPrice.currency !== cheapestOffer.currency;

          if (needsUpdate) {
            await FootballEvent.findByIdAndUpdate(fixtureId, {
              $set: {
                "minPrice.amount": cheapestOffer.price,
                "minPrice.currency": cheapestOffer.currency,
                "minPrice.updatedAt": new Date(),
              },
            });

            const oldPrice =
              currentMinPrice && currentMinPrice.amount
                ? `${currentMinPrice.amount} ${currentMinPrice.currency}`
                : "N/A";
            console.log(
              `✅ Fixture ${fixtureId.substring(
                0,
                8
              )}... - Updated minPrice from ${oldPrice} to ${
                cheapestOffer.price
              } ${cheapestOffer.currency}`
            );
            updated++;
          } else {
            unchanged++;
          }
        }
      } catch (error) {
        logError(error, {
          operation: "updateMinPriceForFixture",
          fixtureId: fixture._id.toString(),
        });
        console.error(
          `❌ Error processing fixture ${fixture._id}:`,
          error.message
        );
        errors++;
      }
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 Summary:");
    console.log("=".repeat(60));
    console.log(`Total fixtures checked: ${allFixtures.length}`);
    console.log(`✅ Updated: ${updated}`);
    console.log(`❌ Deleted (no offers): ${deleted}`);
    console.log(`➖ Unchanged (already correct): ${unchanged}`);
    console.log(`⚪ No offers (no minPrice to delete): ${noOffers}`);
    console.log(`⚠️  Errors: ${errors}`);

    logWithCheckpoint(
      "info",
      "Min prices update completed",
      "UPDATE_MIN_PRICES_003",
      {
        total: allFixtures.length,
        updated,
        deleted,
        unchanged,
        noOffers,
        errors,
      }
    );

    await databaseConnection.disconnect();
    logWithCheckpoint("info", "Database disconnected", "UPDATE_MIN_PRICES_004");
  } catch (error) {
    logError(error, { operation: "updateAllMinPrices" });
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

// Run the script
updateAllMinPrices();


