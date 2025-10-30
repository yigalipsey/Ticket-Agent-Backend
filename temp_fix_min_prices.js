import dotenv from "dotenv";
import databaseConnection from "./src/config/database.js";
import FootballEvent from "./src/models/FootballEvent.js";
import Offer from "./src/models/Offer.js";
import { logWithCheckpoint, logError } from "./src/utils/logger.js";

dotenv.config();

async function fixMinPrices() {
  try {
    logWithCheckpoint(
      "info",
      "Starting to fix min prices for all fixtures",
      "FIX_MIN_PRICES_001"
    );

    // Connect to database
    await databaseConnection.connect(process.env.MONGODB_URI);

    logWithCheckpoint(
      "info",
      "Database connected successfully",
      "FIX_MIN_PRICES_002"
    );

    // Find all fixtures that have minPrice set
    const fixturesWithMinPrice = await FootballEvent.find({
      "minPrice.amount": { $exists: true, $ne: null, $gt: 0 },
    }).lean();

    console.log(
      `\n📊 Found ${fixturesWithMinPrice.length} fixtures with minPrice set`
    );

    let updated = 0;
    let deleted = 0;
    let unchanged = 0;
    let errors = 0;

    for (const fixture of fixturesWithMinPrice) {
      try {
        const fixtureId = fixture._id.toString();

        // Find all available offers for this fixture
        const availableOffers = await Offer.find({
          fixtureId: fixtureId,
          isAvailable: true,
        }).lean();

        if (availableOffers.length === 0) {
          // No available offers - delete minPrice
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
          // Find the minimum price among all offers
          // Need to convert all prices to the same currency for comparison
          // For simplicity, we'll compare prices in their original currency
          // and pick the minimum, but ideally should convert to one currency

          // Group by currency and find min in each
          const pricesByCurrency = {};
          availableOffers.forEach((offer) => {
            if (!pricesByCurrency[offer.currency]) {
              pricesByCurrency[offer.currency] = [];
            }
            pricesByCurrency[offer.currency].push(offer.price);
          });

          // Find the absolute minimum across all currencies
          let minPriceOffer = availableOffers[0];
          for (const offer of availableOffers) {
            if (offer.price < minPriceOffer.price) {
              minPriceOffer = offer;
            }
          }

          // Check if minPrice needs to be updated
          const currentMinPrice = fixture.minPrice;
          const needsUpdate =
            !currentMinPrice ||
            currentMinPrice.amount !== minPriceOffer.price ||
            currentMinPrice.currency !== minPriceOffer.currency;

          if (needsUpdate) {
            await FootballEvent.findByIdAndUpdate(fixtureId, {
              $set: {
                "minPrice.amount": minPriceOffer.price,
                "minPrice.currency": minPriceOffer.currency,
                "minPrice.updatedAt": new Date(),
              },
            });

            const oldPrice = currentMinPrice
              ? `${currentMinPrice.amount} ${currentMinPrice.currency}`
              : "N/A";
            console.log(
              `✅ Fixture ${fixtureId.substring(
                0,
                8
              )}... - Updated minPrice from ${oldPrice} to ${
                minPriceOffer.price
              } ${minPriceOffer.currency}`
            );
            updated++;
          } else {
            unchanged++;
          }
        }
      } catch (error) {
        logError(error, {
          operation: "fixMinPriceForFixture",
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
    console.log(`Total fixtures checked: ${fixturesWithMinPrice.length}`);
    console.log(`✅ Updated: ${updated}`);
    console.log(`❌ Deleted (no offers): ${deleted}`);
    console.log(`➖ Unchanged (already correct): ${unchanged}`);
    console.log(`⚠️  Errors: ${errors}`);

    logWithCheckpoint(
      "info",
      "Min prices fix completed",
      "FIX_MIN_PRICES_003",
      {
        total: fixturesWithMinPrice.length,
        updated,
        deleted,
        unchanged,
        errors,
      }
    );

    await databaseConnection.disconnect();
    logWithCheckpoint("info", "Database disconnected", "FIX_MIN_PRICES_004");
  } catch (error) {
    logError(error, { operation: "fixMinPrices" });
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

// Run the script
fixMinPrices();
