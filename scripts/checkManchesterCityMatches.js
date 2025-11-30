import "dotenv/config";
import mongoose from "mongoose";
import FootballEvent from "../src/models/FootballEvent.js";
import Team from "../src/models/Team.js";
import League from "../src/models/League.js";
import Offer from "../src/models/Offer.js";
import Supplier from "../src/models/Supplier.js";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");

  try {
    const p1 = await Supplier.findOne({ slug: "p1-travel" });
    const premierLeague = await League.findOne({
      $or: [{ name: "Premier League" }, { slug: "premier-league" }],
    });
    const manCity = await Team.findOne({
      $or: [{ name_en: /manchester city/i }, { name_en: /man city/i }],
    });

    console.log("Manchester City team:");
    console.log(`  ID: ${manCity._id}`);
    console.log(`  Name: ${manCity.name_en}\n`);

    // Check fixtures
    const fixtures = await FootballEvent.find({
      league: premierLeague._id,
      $or: [{ homeTeam: manCity._id }, { awayTeam: manCity._id }],
    })
      .populate("homeTeam", "name_en")
      .populate("awayTeam", "name_en")
      .select("homeTeam awayTeam date slug")
      .lean();

    console.log(`Found ${fixtures.length} fixtures with Manchester City\n`);

    // Check offers
    const offers = await Offer.find({
      ownerType: "Supplier",
      ownerId: p1._id,
    })
      .populate({
        path: "fixtureId",
        populate: [
          { path: "homeTeam", select: "name_en" },
          { path: "awayTeam", select: "name_en" },
        ],
      })
      .lean();

    const manCityOffers = offers.filter((o) => {
      if (!o.fixtureId) return false;
      const f = o.fixtureId;
      return (
        (f.homeTeam &&
          f.homeTeam.name_en &&
          f.homeTeam.name_en.toLowerCase().includes("manchester city")) ||
        (f.awayTeam &&
          f.awayTeam.name_en &&
          f.awayTeam.name_en.toLowerCase().includes("manchester city"))
      );
    });

    console.log(`Found ${manCityOffers.length} P1 offers for Manchester City matches\n`);

    // Check specific matches from missing list
    const missingMatches = [
      { home: "West Ham United", away: "Manchester City", date: "2026-03-14" },
      { home: "Tottenham Hotspur", away: "Manchester City", date: "2026-01-31" },
      { home: "Manchester United", away: "Manchester City", date: "2026-01-17" },
      { home: "Manchester City", away: "Arsenal", date: "2026-04-18" },
      { home: "Manchester City", away: "Leeds United", date: "2025-11-29" },
    ];

    console.log("=".repeat(80));
    console.log("Checking specific missing matches:");
    console.log("=".repeat(80));

    for (const match of missingMatches) {
      const matchDate = new Date(match.date + "T00:00:00Z");
      const startDate = new Date(matchDate);
      startDate.setDate(startDate.getDate() - 3);
      const endDate = new Date(matchDate);
      endDate.setDate(endDate.getDate() + 3);

      // Find teams
      const homeTeam = await Team.findOne({
        $or: [
          { name_en: new RegExp(match.home.replace(/United|City|FC/g, "").trim(), "i") },
          { "suppliersInfo.supplierTeamName": match.home },
        ],
      }).lean();

      const awayTeam = await Team.findOne({
        $or: [
          { name_en: new RegExp(match.away.replace(/United|City|FC/g, "").trim(), "i") },
          { "suppliersInfo.supplierTeamName": match.away },
        ],
      }).lean();

      if (!homeTeam || !awayTeam) {
        console.log(
          `\n❌ ${match.home} vs ${match.away} (${match.date}): Teams not found`
        );
        continue;
      }

      const fixture = await FootballEvent.findOne({
        league: premierLeague._id,
        $or: [
          { homeTeam: homeTeam._id, awayTeam: awayTeam._id },
          { homeTeam: awayTeam._id, awayTeam: homeTeam._id },
        ],
        date: { $gte: startDate, $lte: endDate },
      })
        .populate("homeTeam", "name_en")
        .populate("awayTeam", "name_en")
        .lean();

      if (fixture) {
        const offer = await Offer.findOne({
          ownerType: "Supplier",
          ownerId: p1._id,
          fixtureId: fixture._id,
        }).lean();

        console.log(
          `\n✅ ${match.home} vs ${match.away} (${match.date}):`
        );
        console.log(`   Fixture: ${fixture.homeTeam.name_en} vs ${fixture.awayTeam.name_en}`);
        console.log(`   Date: ${fixture.date}`);
        console.log(`   Offer: ${offer ? `Yes (${offer.price} ${offer.currency})` : "No"}`);
      } else {
        console.log(
          `\n❌ ${match.home} vs ${match.away} (${match.date}): Fixture not found`
        );
      }
    }

    // Show all Manchester City offers
    console.log("\n" + "=".repeat(80));
    console.log("All Manchester City P1 offers:");
    console.log("=".repeat(80));
    manCityOffers.forEach((o, i) => {
      const f = o.fixtureId;
      console.log(
        `${i + 1}. ${f.homeTeam.name_en} vs ${f.awayTeam.name_en} (${new Date(f.date).toISOString().split("T")[0]}) - ${o.price} ${o.currency}`
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




