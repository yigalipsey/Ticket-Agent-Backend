import mongoose from "mongoose";
import { config } from "dotenv";
import FootballEvent from "../src/models/FootballEvent.js";
import Offer from "../src/models/Offer.js";

config();

async function connectToDatabase() {
  try {
    const mongoUri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/ticketagent";
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ Error connecting to MongoDB:", error);
    process.exit(1);
  }
}

async function updateMinPrices() {
  await connectToDatabase();

  try {
    console.log("🚀 Starting to update min prices for all fixtures...");

    // Get all fixtures
    const fixtures = await FootballEvent.find({}).lean();
    console.log(`📊 Found ${fixtures.length} fixtures to process`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const fixture of fixtures) {
      // Find the lowest available offer for this fixture
      const lowestOffer = await Offer.findOne({
        fixtureId: fixture._id,
        isAvailable: true,
      })
        .sort({ price: 1 })
        .lean();

      if (lowestOffer) {
        // Update the fixture with the lowest price
        await FootballEvent.updateOne(
          { _id: fixture._id },
          {
            $set: {
              minPrice: {
                amount: lowestOffer.price,
                currency: lowestOffer.currency,
                updatedAt: new Date(),
              },
            },
          }
        );

        console.log(
          `✅ Updated fixture ${fixture.slug}: €${lowestOffer.price} (${lowestOffer.currency})`
        );
        updatedCount++;
      } else {
        console.log(`⚠️  No offers found for fixture: ${fixture.slug}`);
        skippedCount++;
      }
    }

    console.log("\n📈 Summary:");
    console.log(`✅ Successfully updated: ${updatedCount} fixtures`);
    console.log(`⚠️  Skipped (no offers): ${skippedCount} fixtures`);
    console.log(`📊 Total processed: ${fixtures.length} fixtures`);
    console.log("\n🎉 Script completed successfully!");
  } catch (error) {
    console.error("❌ Error updating min prices:", error);
  } finally {
    await mongoose.disconnect();
    console.log("👋 Disconnected from MongoDB");
  }
}

updateMinPrices();
