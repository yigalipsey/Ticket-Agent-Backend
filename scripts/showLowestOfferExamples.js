import "dotenv/config";
import mongoose from "mongoose";
import Offer from "../src/models/Offer.js";
import FootballEvent from "../src/models/FootballEvent.js";
import Supplier from "../src/models/Supplier.js";
import League from "../src/models/League.js";
import Team from "../src/models/Team.js";
import { getLowestOffer } from "../src/services/offer/utils/offerComparison.js";

async function showLowestOfferExamples() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    const premierLeague = await League.findOne({
      $or: [{ name: "Premier League" }, { slug: "premier-league" }],
    });

    if (!premierLeague) {
      console.error("❌ Premier League not found");
      process.exit(1);
    }

    // Get all fixtures with offers (only future matches)
    const now = new Date();
    const fixtures = await FootballEvent.find({
      league: premierLeague._id,
      date: { $gte: now }, // Only future matches
    })
      .populate("homeTeam", "name")
      .populate("awayTeam", "name")
      .lean();

    console.log(`📊 Checking ${fixtures.length} Premier League fixtures...\n`);

    let hospitalityExample = null;
    let regularExample = null;
    let multiOfferExample = null;

    for (const fixture of fixtures) {
      const lowestOfferResult = await getLowestOffer(fixture._id);

      if (!lowestOfferResult || !lowestOfferResult.offer) {
        continue;
      }

      const lowestOffer = lowestOfferResult.offer;
      const isHospitality = lowestOffer.isHospitality === true;

      // Get all offers for this fixture to show context
      const allOffers = await Offer.find({
        fixtureId: fixture._id,
        isAvailable: true,
      })
        .populate("ownerId", "name slug")
        .sort({ price: 1 })
        .lean();

      const example = {
        fixture: {
          id: fixture._id.toString(),
          name: `${fixture.homeTeam?.name || "Unknown"} vs ${fixture.awayTeam?.name || "Unknown"}`,
          date: new Date(fixture.date).toLocaleDateString(),
          slug: fixture.slug,
        },
        lowestOffer: {
          id: lowestOffer._id.toString(),
          price: lowestOffer.price,
          currency: lowestOffer.currency,
          isHospitality: lowestOffer.isHospitality,
          ownerType: lowestOffer.ownerType,
          ownerName: lowestOffer.ownerId?.name || "Unknown",
          url: lowestOffer.url,
        },
        allOffers: allOffers.map((o) => ({
          id: o._id.toString(),
          price: o.price,
          currency: o.currency,
          isHospitality: o.isHospitality,
          ownerType: o.ownerType,
          ownerName: o.ownerId?.name || "Unknown",
        })),
      };

      if (isHospitality && !hospitalityExample) {
        hospitalityExample = example;
      }

      if (!isHospitality && !regularExample) {
        regularExample = example;
      }

      // Find example with multiple offers
      if (allOffers.length >= 2 && !multiOfferExample) {
        multiOfferExample = example;
      }

      if (hospitalityExample && regularExample && multiOfferExample) {
        break;
      }
    }

    console.log("=".repeat(80));
    console.log("🏥 דוגמה 1: ההצעה הכי זולה היא HOSPITALITY");
    console.log("=".repeat(80));
    if (hospitalityExample) {
      console.log(`\n📅 משחק: ${hospitalityExample.fixture.name}`);
      console.log(`📆 תאריך: ${hospitalityExample.fixture.date}`);
      console.log(`🔗 Slug: ${hospitalityExample.fixture.slug}`);
      console.log(`\n💰 ההצעה הכי זולה:`);
      console.log(`   ID: ${hospitalityExample.lowestOffer.id}`);
      console.log(`   מחיר: ${hospitalityExample.lowestOffer.price} ${hospitalityExample.lowestOffer.currency}`);
      console.log(`   🏥 isHospitality: ${hospitalityExample.lowestOffer.isHospitality}`);
      console.log(`   ספק: ${hospitalityExample.lowestOffer.ownerName} (${hospitalityExample.lowestOffer.ownerType})`);
      console.log(`   URL: ${hospitalityExample.lowestOffer.url?.substring(0, 80)}...`);
      console.log(`\n📊 כל ההצעות למשחק הזה (${hospitalityExample.allOffers.length}):`);
      hospitalityExample.allOffers.forEach((offer, i) => {
        const marker = offer.id === hospitalityExample.lowestOffer.id ? " ⭐ (הכי זול)" : "";
        const hospitalityMark = offer.isHospitality ? " 🏥" : "";
        console.log(`   ${i + 1}. ${offer.price} ${offer.currency}${hospitalityMark} | ${offer.ownerName}${marker}`);
      });
    } else {
      console.log("❌ לא נמצאה דוגמה");
    }

    console.log("\n" + "=".repeat(80));
    console.log("🎟️  דוגמה 2: ההצעה הכי זולה היא REGULAR (לא Hospitality)");
    console.log("=".repeat(80));
    if (regularExample) {
      console.log(`\n📅 משחק: ${regularExample.fixture.name}`);
      console.log(`📆 תאריך: ${regularExample.fixture.date}`);
      console.log(`🔗 Slug: ${regularExample.fixture.slug}`);
      console.log(`\n💰 ההצעה הכי זולה:`);
      console.log(`   ID: ${regularExample.lowestOffer.id}`);
      console.log(`   מחיר: ${regularExample.lowestOffer.price} ${regularExample.lowestOffer.currency}`);
      console.log(`   🎟️  isHospitality: ${regularExample.lowestOffer.isHospitality}`);
      console.log(`   ספק: ${regularExample.lowestOffer.ownerName} (${regularExample.lowestOffer.ownerType})`);
      console.log(`   URL: ${regularExample.lowestOffer.url?.substring(0, 80)}...`);
      console.log(`\n📊 כל ההצעות למשחק הזה (${regularExample.allOffers.length}):`);
      regularExample.allOffers.forEach((offer, i) => {
        const marker = offer.id === regularExample.lowestOffer.id ? " ⭐ (הכי זול)" : "";
        const hospitalityMark = offer.isHospitality ? " 🏥" : "";
        console.log(`   ${i + 1}. ${offer.price} ${offer.currency}${hospitalityMark} | ${offer.ownerName}${marker}`);
      });
    } else {
      console.log("❌ לא נמצאה דוגמה");
    }

    console.log("\n" + "=".repeat(80));
    console.log("📊 דוגמה 3: משחק עם כמה הצעות");
    console.log("=".repeat(80));
    if (multiOfferExample) {
      console.log(`\n📅 משחק: ${multiOfferExample.fixture.name}`);
      console.log(`📆 תאריך: ${multiOfferExample.fixture.date}`);
      console.log(`🔗 Slug: ${multiOfferExample.fixture.slug}`);
      console.log(`\n💰 ההצעה הכי זולה:`);
      console.log(`   ID: ${multiOfferExample.lowestOffer.id}`);
      console.log(`   מחיר: ${multiOfferExample.lowestOffer.price} ${multiOfferExample.lowestOffer.currency}`);
      console.log(`   ${multiOfferExample.lowestOffer.isHospitality ? "🏥" : "🎟️ "} isHospitality: ${multiOfferExample.lowestOffer.isHospitality}`);
      console.log(`   ספק: ${multiOfferExample.lowestOffer.ownerName} (${multiOfferExample.lowestOffer.ownerType})`);
      console.log(`\n📊 כל ההצעות למשחק הזה (${multiOfferExample.allOffers.length}):`);
      multiOfferExample.allOffers.forEach((offer, i) => {
        const marker = offer.id === multiOfferExample.lowestOffer.id ? " ⭐ (הכי זול)" : "";
        const hospitalityMark = offer.isHospitality ? " 🏥" : " 🎟️ ";
        console.log(`   ${i + 1}. ${offer.price} ${offer.currency}${hospitalityMark} | ${offer.ownerName}${marker}`);
      });
    } else {
      console.log("❌ לא נמצאה דוגמה");
    }

    console.log("\n" + "=".repeat(80));
    console.log("✅ סיום");
    console.log("=".repeat(80));

    await mongoose.disconnect();
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

showLowestOfferExamples();

