import "dotenv/config";
import mongoose from "mongoose";
import Offer from "../src/models/Offer.js";
import Supplier from "../src/models/Supplier.js";
import FootballEvent from "../src/models/FootballEvent.js";
import Team from "../src/models/Team.js";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");

  try {
    const fixtureId = "6926e33ca3a933930dad474a";
    const p1 = await Supplier.findOne({ slug: "p1-travel" });

    const fixture = await FootballEvent.findById(fixtureId)
      .populate("homeTeam", "name_en")
      .populate("awayTeam", "name_en")
      .lean();

    console.log("Fixture:");
    console.log(`  Home: ${fixture.homeTeam.name_en}`);
    console.log(`  Away: ${fixture.awayTeam.name_en}`);
    console.log(`  Date: ${fixture.date}`);
    console.log(`  Slug: ${fixture.slug}\n`);

    const offers = await Offer.find({
      ownerType: "Supplier",
      ownerId: p1._id,
      fixtureId: fixtureId,
    }).lean();

    console.log(`P1 Offers: ${offers.length}\n`);

    if (offers.length === 0) {
      console.log("❌ No P1 offers found for this fixture");
      console.log("\nChecking if teams are mapped correctly...");
      
      const homeTeam = await Team.findById(fixture.homeTeam._id).lean();
      const awayTeam = await Team.findById(fixture.awayTeam._id).lean();
      
      const homeP1Info = homeTeam?.suppliersInfo?.find(
        (s) => s.supplierRef?.toString() === p1._id.toString()
      );
      const awayP1Info = awayTeam?.suppliersInfo?.find(
        (s) => s.supplierRef?.toString() === p1._id.toString()
      );
      
      console.log(`\nHome team (${fixture.homeTeam.name_en}):`);
      console.log(`  P1 mapping: ${homeP1Info?.supplierTeamName || "NOT MAPPED"}`);
      
      console.log(`\nAway team (${fixture.awayTeam.name_en}):`);
      console.log(`  P1 mapping: ${awayP1Info?.supplierTeamName || "NOT MAPPED"}`);
    } else {
      offers.forEach((offer, idx) => {
        console.log(`Offer ${idx + 1}:`);
        console.log(`  ID: ${offer._id}`);
        console.log(`  Price: ${offer.price} ${offer.currency}`);
        console.log(`  URL: ${offer.url.substring(0, 100)}...`);
      });
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
}

run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});




