import "dotenv/config";
import mongoose from "mongoose";
import Offer from "../src/models/Offer.js";
import Supplier from "../src/models/Supplier.js";
import League from "../src/models/League.js";
import FootballEvent from "../src/models/FootballEvent.js";
import Team from "../src/models/Team.js";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");

  try {
    const p1 = await Supplier.findOne({ slug: "p1-travel" });
    const championsLeague = await League.findOne({
      $or: [
        { name: "Champions League" },
        { slug: "champions-league" },
        { name: /champions league/i },
      ],
    });

    if (!p1 || !championsLeague) {
      console.error("❌ P1 supplier or Champions League not found");
      return;
    }

    console.log(`🏆 League: ${championsLeague.name}`);
    console.log(`🏢 Supplier: ${p1.name}\n`);

    // Get all Champions League fixtures
    const allFixtures = await FootballEvent.find({
      league: championsLeague._id,
    })
      .populate("homeTeam", "name_en")
      .populate("awayTeam", "name_en")
      .select("homeTeam awayTeam date")
      .lean();

    console.log(`📊 Total Champions League fixtures in DB: ${allFixtures.length}`);

    // Get all P1 offers for Champions League
    const offers = await Offer.find({
      ownerType: "Supplier",
      ownerId: p1._id,
    })
      .populate({
        path: "fixtureId",
        populate: [
          { path: "league", select: "name" },
          { path: "homeTeam", select: "name_en" },
          { path: "awayTeam", select: "name_en" },
        ],
      })
      .lean();

    const clOffers = offers.filter(
      (o) =>
        o.fixtureId &&
        o.fixtureId.league &&
        o.fixtureId.league._id.toString() === championsLeague._id.toString()
    );

    console.log(`✅ Champions League fixtures with P1 offers: ${clOffers.length}\n`);

    console.log("=".repeat(80));
    console.log("All Champions League matches with P1 offers:");
    console.log("=".repeat(80));
    clOffers.forEach((o, i) => {
      const f = o.fixtureId;
      const date = new Date(f.date).toISOString().split("T")[0];
      console.log(
        `${i + 1}. ${f.homeTeam.name_en} vs ${f.awayTeam.name_en} (${date}) - ${o.price} ${o.currency}`
      );
    });
  } catch (error) {
    console.error("❌ Error:", error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
}

run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});




