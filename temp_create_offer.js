import dotenv from "dotenv";
import databaseConnection from "./src/config/database.js";
import OfferService from "./src/services/offer/index.js";
import Offer from "./src/models/Offer.js";
import { logWithCheckpoint, logError } from "./src/utils/logger.js";

dotenv.config();

const FIXTURE_ID = "68e79ee24a00e38f56da0808";
const AGENT_ID = "69022c05e0683d43a2380d6a";
const PRICE_IN_POUNDS = 685;

async function createOfferForFixture() {
  try {
    logWithCheckpoint(
      "info",
      "Starting to create offer for fixture",
      "CREATE_OFFER_001",
      {
        fixtureId: FIXTURE_ID,
        agentId: AGENT_ID,
        price: PRICE_IN_POUNDS,
        currency: "GBP",
      }
    );

    // Connect to database
    await databaseConnection.connect(process.env.MONGODB_URI);

    logWithCheckpoint(
      "info",
      "Database connected successfully",
      "CREATE_OFFER_002"
    );

    // Check if there's an existing offer from this agent for this fixture and delete it
    const existingOffer = await Offer.findOne({
      fixtureId: FIXTURE_ID,
      agentId: AGENT_ID,
    });

    if (existingOffer) {
      logWithCheckpoint(
        "info",
        "Deleting existing offer",
        "CREATE_OFFER_002.5",
        {
          existingOfferId: existingOffer._id.toString(),
        }
      );
      await OfferService.mutate.deleteOffer(existingOffer._id.toString());
      logWithCheckpoint(
        "info",
        "Existing offer deleted",
        "CREATE_OFFER_002.6"
      );
    }

    // Create offer data with GBP currency
    const offerData = {
      fixtureId: FIXTURE_ID,
      agentId: AGENT_ID,
      price: PRICE_IN_POUNDS,
      currency: "GBP",
      isAvailable: true,
    };

    logWithCheckpoint(
      "info",
      "Creating offer with service",
      "CREATE_OFFER_003",
      offerData
    );

    // Create offer using the service (this will automatically check if it's cheapest and update minPrice)
    const offer = await OfferService.mutate.createOffer(offerData);

    logWithCheckpoint(
      "info",
      "Offer created successfully",
      "CREATE_OFFER_004",
      {
        offerId: offer._id.toString(),
        price: offer.price,
        currency: offer.currency,
        fixtureId: offer.fixtureId.toString(),
        agentId: offer.agentId.toString(),
      }
    );

    console.log("\n✅ Offer created successfully!");
    console.log(`   Offer ID: ${offer._id}`);
    console.log(`   Price: ${offer.price} ${offer.currency}`);
    console.log(`   Fixture ID: ${offer.fixtureId}`);
    console.log(`   Agent ID: ${offer.agentId}`);
    console.log(
      `   Note: The system automatically checks if this is the cheapest offer and updates the fixture's minPrice if it is.`
    );

    // Close database connection
    await databaseConnection.disconnect();

    logWithCheckpoint(
      "info",
      "Script completed successfully",
      "CREATE_OFFER_005"
    );

    process.exit(0);
  } catch (error) {
    logError(error, { operation: "createOfferForFixture" });
    console.error("\n❌ Error creating offer:", error.message);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    await databaseConnection.disconnect();
    process.exit(1);
  }
}

// Run the script
createOfferForFixture();
