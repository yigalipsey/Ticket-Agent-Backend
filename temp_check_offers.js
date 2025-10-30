import dotenv from "dotenv";
import databaseConnection from "./src/config/database.js";
import FootballEvent from "./src/models/FootballEvent.js";
import Offer from "./src/models/Offer.js";
import Team from "./src/models/Team.js";
import League from "./src/models/League.js";
import Venue from "./src/models/Venue.js";
import Agent from "./src/models/Agent.js";
import { logWithCheckpoint, logError } from "./src/utils/logger.js";

dotenv.config();

const FIXTURE_ID = "68e79b0bb670d863241bd3f2";

async function checkFixtureOffers() {
  try {
    logWithCheckpoint(
      "info",
      "Starting to check fixture offers",
      "CHECK_OFFERS_001",
      { fixtureId: FIXTURE_ID }
    );

    // Connect to database
    await databaseConnection.connect(process.env.MONGODB_URI);

    logWithCheckpoint(
      "info",
      "Database connected successfully",
      "CHECK_OFFERS_002"
    );

    // Check if fixture exists
    const fixture = await FootballEvent.findById(FIXTURE_ID)
      .populate("homeTeam", "name name_en name_he")
      .populate("awayTeam", "name name_en name_he")
      .populate("league", "name nameHe")
      .populate("venue", "name_en name_he city_en city_he")
      .lean();

    if (!fixture) {
      console.log("\n❌ Fixture not found with ID:", FIXTURE_ID);
      await databaseConnection.disconnect();
      return;
    }

    console.log("\n✅ Fixture found:");
    console.log("   ID:", fixture._id);
    console.log("   Date:", fixture.date);
    console.log(
      "   Home Team:",
      fixture.homeTeam?.name_he ||
        fixture.homeTeam?.name_en ||
        fixture.homeTeam?.name
    );
    console.log(
      "   Away Team:",
      fixture.awayTeam?.name_he ||
        fixture.awayTeam?.name_en ||
        fixture.awayTeam?.name
    );
    console.log("   League:", fixture.league?.nameHe || fixture.league?.name);
    console.log("   Venue:", fixture.venue?.name_he || fixture.venue?.name_en);
    console.log("   Slug:", fixture.slug);
    console.log(
      "   Min Price:",
      fixture.minPrice?.amount
        ? `${fixture.minPrice.amount} ${fixture.minPrice.currency}`
        : "N/A"
    );

    // Check for offers
    const offers = await Offer.find({ fixtureId: FIXTURE_ID })
      .populate("agentId", "name email agentType")
      .lean();

    console.log("\n📊 Offers Summary:");
    console.log("   Total offers:", offers.length);

    const availableOffers = offers.filter((offer) => offer.isAvailable);
    const unavailableOffers = offers.filter((offer) => !offer.isAvailable);

    console.log("   Available offers:", availableOffers.length);
    console.log("   Unavailable offers:", unavailableOffers.length);

    if (offers.length > 0) {
      console.log("\n📋 All Offers:");
      offers.forEach((offer, index) => {
        console.log(`\n   ${index + 1}. Offer ID: ${offer._id}`);
        console.log(
          `      Agent: ${
            offer.agentId?.name || offer.agentId?.email || "Unknown"
          }`
        );
        console.log(`      Agent Type: ${offer.agentId?.agentType || "N/A"}`);
        console.log(`      Price: ${offer.price} ${offer.currency}`);
        console.log(`      Ticket Type: ${offer.ticketType}`);
        console.log(
          `      Available: ${offer.isAvailable ? "✅ Yes" : "❌ No"}`
        );
        if (offer.notes) {
          console.log(`      Notes: ${offer.notes}`);
        }
        console.log(`      Created: ${offer.createdAt}`);
        console.log(`      Updated: ${offer.updatedAt}`);
      });

      // Show statistics
      if (availableOffers.length > 0) {
        const prices = availableOffers.map((o) => o.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

        console.log("\n💰 Price Statistics (Available offers only):");
        console.log(`   Min Price: ${minPrice} ${availableOffers[0].currency}`);
        console.log(`   Max Price: ${maxPrice} ${availableOffers[0].currency}`);
        console.log(
          `   Average Price: ${avgPrice.toFixed(2)} ${
            availableOffers[0].currency
          }`
        );
      }
    } else {
      console.log("\n❌ No offers found for this fixture");
    }

    await databaseConnection.disconnect();
    logWithCheckpoint("info", "Database disconnected", "CHECK_OFFERS_003");
  } catch (error) {
    logError(error, { operation: "checkFixtureOffers", fixtureId: FIXTURE_ID });
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

// Run the script
checkFixtureOffers();
