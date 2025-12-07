import "dotenv/config";
import mongoose from "mongoose";
import Offer from "../src/models/Offer.js";
import FootballEvent from "../src/models/FootballEvent.js";
import Supplier from "../src/models/Supplier.js";
import League from "../src/models/League.js";
import Team from "../src/models/Team.js";
import { getLowestOffer } from "../src/services/offer/utils/offerComparison.js";

async function checkLowestOfferHospitality() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    const p1Supplier = await Supplier.findOne({ slug: "p1-travel" });
    if (!p1Supplier) {
      console.error("❌ P1 Travel supplier not found");
      process.exit(1);
    }

    // Get Premier League for example
    const premierLeague = await League.findOne({
      $or: [{ name: "Premier League" }, { slug: "premier-league" }],
    });

    if (!premierLeague) {
      console.error("❌ Premier League not found");
      process.exit(1);
    }

    // Get all fixtures with P1 offers
    const fixtures = await FootballEvent.find({
      league: premierLeague._id,
    })
      .populate("homeTeam", "name")
      .populate("awayTeam", "name")
      .lean();

    console.log(`📊 Checking ${fixtures.length} Premier League fixtures...\n`);

    let stats = {
      total: 0,
      withOffers: 0,
      hospitality: 0,
      regular: 0,
      missing: 0,
      examples: {
        hospitality: [],
        regular: [],
      },
    };

    for (const fixture of fixtures) {
      const lowestOfferResult = await getLowestOffer(fixture._id);

      if (!lowestOfferResult || !lowestOfferResult.offer) {
        stats.missing++;
        continue;
      }

      stats.total++;
      stats.withOffers++;

      const lowestOffer = lowestOfferResult.offer;
      const isHospitality = lowestOffer.isHospitality === true;

      if (isHospitality) {
        stats.hospitality++;
        if (stats.examples.hospitality.length < 5) {
          stats.examples.hospitality.push({
            fixture: `${fixture.homeTeam?.name || "Unknown"} vs ${fixture.awayTeam?.name || "Unknown"}`,
            date: new Date(fixture.date).toLocaleDateString(),
            price: lowestOffer.price,
            currency: lowestOffer.currency,
            supplier: lowestOffer.ownerType === "Supplier" ? "P1" : "Other",
            offerId: lowestOffer._id.toString(),
          });
        }
      } else {
        stats.regular++;
        if (stats.examples.regular.length < 5) {
          stats.examples.regular.push({
            fixture: `${fixture.homeTeam?.name || "Unknown"} vs ${fixture.awayTeam?.name || "Unknown"}`,
            date: new Date(fixture.date).toLocaleDateString(),
            price: lowestOffer.price,
            currency: lowestOffer.currency,
            supplier: lowestOffer.ownerType === "Supplier" ? "P1" : "Other",
            offerId: lowestOffer._id.toString(),
          });
        }
      }
    }

    console.log("📈 Statistics:");
    console.log(`   Total fixtures: ${fixtures.length}`);
    console.log(`   Fixtures with offers: ${stats.withOffers}`);
    console.log(`   Fixtures without offers: ${stats.missing}`);
    console.log(`\n🎫 Lowest Offer Types:`);
    console.log(`   Hospitality: ${stats.hospitality} (${((stats.hospitality / stats.withOffers) * 100).toFixed(1)}%)`);
    console.log(`   Regular: ${stats.regular} (${((stats.regular / stats.withOffers) * 100).toFixed(1)}%)`);

    console.log(`\n🏥 Hospitality Examples (lowest offer is hospitality):`);
    stats.examples.hospitality.forEach((ex, i) => {
      console.log(`   ${i + 1}. ${ex.fixture} (${ex.date})`);
      console.log(`      Price: ${ex.price} ${ex.currency} | Supplier: ${ex.supplier} | Offer ID: ${ex.offerId}`);
    });

    console.log(`\n🎟️  Regular Examples (lowest offer is regular):`);
    stats.examples.regular.forEach((ex, i) => {
      console.log(`   ${i + 1}. ${ex.fixture} (${ex.date})`);
      console.log(`      Price: ${ex.price} ${ex.currency} | Supplier: ${ex.supplier} | Offer ID: ${ex.offerId}`);
    });

    // Check specific fixture if needed
    console.log(`\n\n🔍 To check a specific fixture's lowest offer:`);
    console.log(`   Use: getLowestOffer(fixtureId)`);
    console.log(`   The result includes: offer.isHospitality`);

    await mongoose.disconnect();
    console.log("\n✅ Done!");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

checkLowestOfferHospitality();

