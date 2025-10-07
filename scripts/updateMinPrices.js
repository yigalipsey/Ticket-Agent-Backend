import dotenv from "dotenv";
import mongoose from "mongoose";
import Offer from "../src/models/Offer.js";
import FootballEvent from "../src/models/FootballEvent.js";
import { logWithCheckpoint, logError } from "../src/utils/logger.js";

// Load environment variables
dotenv.config();

class MinPriceUpdater {
  constructor() {
    this.currencyRates = {
      EUR: 1.0,
      USD: 1.08, // Approximate rate - in production, use real-time rates
      ILS: 4.0, // Approximate rate - in production, use real-time rates
    };
  }

  // Connect to database
  async connectToDatabase() {
    try {
      logWithCheckpoint("info", "Connecting to database", "MIN_PRICE_001");

      const mongoUri =
        process.env.MONGODB_URI || "mongodb://localhost:27017/ticketagent";
      await mongoose.connect(mongoUri);

      logWithCheckpoint(
        "info",
        "Successfully connected to database",
        "MIN_PRICE_002"
      );
    } catch (error) {
      logError(error, { operation: "connectToDatabase" });
      throw error;
    }
  }

  // Convert price to EUR for comparison
  convertToEUR(price, currency) {
    if (currency === "EUR") return price;
    if (!this.currencyRates[currency]) {
      logWithCheckpoint(
        "warn",
        `Unknown currency rate for ${currency}, using 1.0`,
        "MIN_PRICE_003",
        { currency }
      );
      return price;
    }
    return price / this.currencyRates[currency];
  }

  // Find cheapest offer for a specific fixture
  async findCheapestOfferForFixture(fixtureId) {
    try {
      logWithCheckpoint(
        "info",
        "Finding cheapest offer for fixture",
        "MIN_PRICE_004",
        { fixtureId }
      );

      // Get all available offers for this fixture
      const offers = await Offer.find({
        fixtureId: fixtureId,
        isAvailable: true,
      }).lean();

      if (offers.length === 0) {
        logWithCheckpoint(
          "info",
          "No available offers found for fixture",
          "MIN_PRICE_005",
          { fixtureId }
        );
        return null;
      }

      logWithCheckpoint(
        "info",
        `Found ${offers.length} available offers for fixture`,
        "MIN_PRICE_006",
        {
          fixtureId,
          offerCount: offers.length,
        }
      );

      // Convert all prices to EUR and find the minimum
      let cheapestOffer = null;
      let minPriceEUR = Infinity;

      for (const offer of offers) {
        const priceInEUR = this.convertToEUR(offer.price, offer.currency);

        logWithCheckpoint("debug", "Processing offer price", "MIN_PRICE_007", {
          fixtureId,
          offerId: offer._id,
          originalPrice: offer.price,
          currency: offer.currency,
          priceInEUR: priceInEUR.toFixed(2),
        });

        if (priceInEUR < minPriceEUR) {
          minPriceEUR = priceInEUR;
          cheapestOffer = offer;
        }
      }

      if (cheapestOffer) {
        logWithCheckpoint(
          "info",
          "Found cheapest offer for fixture",
          "MIN_PRICE_008",
          {
            fixtureId,
            cheapestOfferId: cheapestOffer._id,
            cheapestPrice: cheapestOffer.price,
            cheapestCurrency: cheapestOffer.currency,
            priceInEUR: minPriceEUR.toFixed(2),
          }
        );
      }

      return cheapestOffer;
    } catch (error) {
      logError(error, { operation: "findCheapestOfferForFixture", fixtureId });
      throw error;
    }
  }

  // Update minimum price for a specific fixture
  async updateMinPriceForFixture(fixtureId) {
    try {
      logWithCheckpoint(
        "info",
        "Starting to update min price for fixture",
        "MIN_PRICE_009",
        { fixtureId }
      );

      const cheapestOffer = await this.findCheapestOfferForFixture(fixtureId);

      if (!cheapestOffer) {
        // No offers available, clear minPrice
        await FootballEvent.findByIdAndUpdate(fixtureId, {
          $unset: { minPrice: 1 },
        });

        logWithCheckpoint(
          "info",
          "Cleared minPrice for fixture with no offers",
          "MIN_PRICE_010",
          { fixtureId }
        );
        return null;
      }

      // Update minPrice with cheapest offer details
      const updateData = {
        minPrice: {
          amount: cheapestOffer.price,
          currency: cheapestOffer.currency,
          updatedAt: new Date(),
        },
      };

      const updatedFixture = await FootballEvent.findByIdAndUpdate(
        fixtureId,
        updateData,
        { new: true, runValidators: true }
      );

      logWithCheckpoint(
        "info",
        "Successfully updated min price for fixture",
        "MIN_PRICE_011",
        {
          fixtureId,
          minPrice: updateData.minPrice,
        }
      );

      return updatedFixture;
    } catch (error) {
      logError(error, { operation: "updateMinPriceForFixture", fixtureId });
      throw error;
    }
  }

  // Update minimum prices for all fixtures
  async updateAllMinPrices() {
    try {
      logWithCheckpoint(
        "info",
        "Starting to update min prices for all fixtures",
        "MIN_PRICE_012"
      );

      // Get all football events that have offers
      const fixturesWithOffers = await Offer.distinct("fixtureId");

      logWithCheckpoint(
        "info",
        `Found ${fixturesWithOffers.length} fixtures with offers`,
        "MIN_PRICE_013",
        {
          fixtureCount: fixturesWithOffers.length,
        }
      );

      let updatedCount = 0;
      let errorCount = 0;
      const results = [];

      for (let i = 0; i < fixturesWithOffers.length; i++) {
        const fixtureId = fixturesWithOffers[i];

        try {
          logWithCheckpoint(
            "info",
            `Processing fixture ${i + 1}/${fixturesWithOffers.length}`,
            "MIN_PRICE_014",
            {
              fixtureId,
              progress: `${i + 1}/${fixturesWithOffers.length}`,
            }
          );

          const result = await this.updateMinPriceForFixture(fixtureId);

          if (result) {
            updatedCount++;
            results.push({
              fixtureId,
              status: "updated",
              minPrice: result.minPrice,
            });
          } else {
            results.push({
              fixtureId,
              status: "cleared",
            });
          }

          // Add small delay to avoid overwhelming the database
          if (i % 10 === 0 && i > 0) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        } catch (error) {
          errorCount++;
          logError(error, { operation: "updateAllMinPrices", fixtureId });
          results.push({
            fixtureId,
            status: "error",
            error: error.message,
          });
        }
      }

      logWithCheckpoint(
        "info",
        "Completed updating min prices for all fixtures",
        "MIN_PRICE_015",
        {
          totalFixtures: fixturesWithOffers.length,
          updatedCount,
          errorCount,
          clearedCount: fixturesWithOffers.length - updatedCount - errorCount,
        }
      );

      return {
        totalFixtures: fixturesWithOffers.length,
        updatedCount,
        errorCount,
        results,
      };
    } catch (error) {
      logError(error, { operation: "updateAllMinPrices" });
      throw error;
    }
  }

  // Update minimum prices for fixtures with no current minPrice
  async updateMissingMinPrices() {
    try {
      logWithCheckpoint(
        "info",
        "Starting to update missing min prices",
        "MIN_PRICE_016"
      );

      // Find fixtures that have offers but no minPrice set
      const fixturesWithOffers = await Offer.distinct("fixtureId");
      const fixturesWithMinPrice = await FootballEvent.distinct("_id", {
        "minPrice.amount": { $exists: true },
      });

      const fixturesNeedingUpdate = fixturesWithOffers.filter(
        (fixtureId) =>
          !fixturesWithMinPrice.some(
            (id) => id.toString() === fixtureId.toString()
          )
      );

      logWithCheckpoint(
        "info",
        `Found ${fixturesNeedingUpdate.length} fixtures needing min price update`,
        "MIN_PRICE_017",
        {
          fixturesNeedingUpdate: fixturesNeedingUpdate.length,
          totalWithOffers: fixturesWithOffers.length,
          totalWithMinPrice: fixturesWithMinPrice.length,
        }
      );

      let updatedCount = 0;
      let errorCount = 0;

      for (let i = 0; i < fixturesNeedingUpdate.length; i++) {
        const fixtureId = fixturesNeedingUpdate[i];

        try {
          logWithCheckpoint(
            "info",
            `Processing missing min price ${i + 1}/${
              fixturesNeedingUpdate.length
            }`,
            "MIN_PRICE_018",
            {
              fixtureId,
              progress: `${i + 1}/${fixturesNeedingUpdate.length}`,
            }
          );

          const result = await this.updateMinPriceForFixture(fixtureId);

          if (result) {
            updatedCount++;
          }
        } catch (error) {
          errorCount++;
          logError(error, { operation: "updateMissingMinPrices", fixtureId });
        }
      }

      logWithCheckpoint(
        "info",
        "Completed updating missing min prices",
        "MIN_PRICE_019",
        {
          totalNeedingUpdate: fixturesNeedingUpdate.length,
          updatedCount,
          errorCount,
        }
      );

      return {
        totalNeedingUpdate: fixturesNeedingUpdate.length,
        updatedCount,
        errorCount,
      };
    } catch (error) {
      logError(error, { operation: "updateMissingMinPrices" });
      throw error;
    }
  }

  // Display summary of current min prices
  async displayMinPriceSummary() {
    try {
      logWithCheckpoint(
        "info",
        "Generating min price summary",
        "MIN_PRICE_020"
      );

      const fixturesWithMinPrice = await FootballEvent.find({
        "minPrice.amount": { $exists: true },
      })
        .populate("homeTeam", "name")
        .populate("awayTeam", "name")
        .populate("league", "name")
        .sort({ "minPrice.amount": 1 })
        .lean();

      logWithCheckpoint(
        "info",
        `Found ${fixturesWithMinPrice.length} fixtures with min prices`,
        "MIN_PRICE_021",
        {
          fixtureCount: fixturesWithMinPrice.length,
        }
      );

      console.log(`\n=== סיכום מחירים מינימליים ===`);
      console.log(
        `סה"כ משחקים עם מחיר מינימלי: ${fixturesWithMinPrice.length}\n`
      );

      if (fixturesWithMinPrice.length === 0) {
        console.log("לא נמצאו משחקים עם מחיר מינימלי.");
        return;
      }

      // Group by currency
      const byCurrency = {};
      fixturesWithMinPrice.forEach((fixture) => {
        const currency = fixture.minPrice.currency;
        if (!byCurrency[currency]) {
          byCurrency[currency] = [];
        }
        byCurrency[currency].push(fixture);
      });

      // Display by currency
      Object.keys(byCurrency)
        .sort()
        .forEach((currency) => {
          const fixtures = byCurrency[currency];
          console.log(`\n--- ${currency} ---`);

          fixtures.slice(0, 10).forEach((fixture) => {
            const date = new Date(fixture.date).toLocaleDateString("he-IL");
            const homeTeam = fixture.homeTeam?.name || "לא ידוע";
            const awayTeam = fixture.awayTeam?.name || "לא ידוע";
            const league = fixture.league?.name || "לא ידוע";

            console.log(`${homeTeam} vs ${awayTeam} (${league})`);
            console.log(`  תאריך: ${date}`);
            console.log(
              `  מחיר מינימלי: ${fixture.minPrice.amount} ${currency}`
            );
            console.log(
              `  עודכן: ${new Date(fixture.minPrice.updatedAt).toLocaleString(
                "he-IL"
              )}`
            );
            console.log("");
          });

          if (fixtures.length > 10) {
            console.log(`... ועוד ${fixtures.length - 10} משחקים`);
          }
        });

      // Statistics
      const totalOffers = await Offer.countDocuments({ isAvailable: true });
      const avgMinPrice =
        fixturesWithMinPrice.reduce((sum, f) => sum + f.minPrice.amount, 0) /
        fixturesWithMinPrice.length;

      console.log(`\n=== סטטיסטיקות ===`);
      console.log(`סה"כ הצעות זמינות: ${totalOffers}`);
      console.log(`מחיר מינימלי ממוצע: ${avgMinPrice.toFixed(2)}`);
      console.log(
        `מחיר הנמוך ביותר: ${Math.min(
          ...fixturesWithMinPrice.map((f) => f.minPrice.amount)
        )}`
      );
      console.log(
        `מחיר הגבוה ביותר: ${Math.max(
          ...fixturesWithMinPrice.map((f) => f.minPrice.amount)
        )}`
      );
    } catch (error) {
      logError(error, { operation: "displayMinPriceSummary" });
      throw error;
    }
  }

  // Main function to run the update
  async runUpdate(options = {}) {
    try {
      logWithCheckpoint(
        "info",
        "Starting min price update process",
        "MIN_PRICE_022",
        { options }
      );

      await this.connectToDatabase();

      let result;

      if (options.missingOnly) {
        result = await this.updateMissingMinPrices();
      } else {
        result = await this.updateAllMinPrices();
      }

      if (options.showSummary) {
        await this.displayMinPriceSummary();
      }

      logWithCheckpoint(
        "info",
        "Min price update process completed successfully",
        "MIN_PRICE_023",
        { result }
      );

      return result;
    } catch (error) {
      logError(error, { operation: "runUpdate", options });
      throw error;
    } finally {
      await mongoose.connection.close();
      logWithCheckpoint("info", "Database connection closed", "MIN_PRICE_024");
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const updater = new MinPriceUpdater();

  // Parse command line arguments
  const args = process.argv.slice(2);
  const options = {
    missingOnly: args.includes("--missing-only"),
    showSummary: args.includes("--summary") || !args.includes("--no-summary"),
  };

  (async () => {
    try {
      console.log("מתחיל עדכון מחירים מינימליים...");

      if (options.missingOnly) {
        console.log("מצב: עדכון רק משחקים ללא מחיר מינימלי");
      } else {
        console.log("מצב: עדכון כל המחירים המינימליים");
      }

      const result = await updater.runUpdate(options);

      console.log("\n=== תוצאות ===");
      console.log(
        `סה"כ משחקים: ${result.totalFixtures || result.totalNeedingUpdate}`
      );
      console.log(`עודכנו בהצלחה: ${result.updatedCount}`);
      console.log(`שגיאות: ${result.errorCount}`);

      console.log("\nהעדכון הושלם בהצלחה!");
    } catch (error) {
      console.error("העדכון נכשל:", error.message);
      process.exit(1);
    }
  })();
}

export default MinPriceUpdater;
