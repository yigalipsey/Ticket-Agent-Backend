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
    const p1 = await Supplier.findOne({ slug: "p1-travel" });
    if (!p1) {
      throw new Error("P1 Travel supplier not found");
    }

    // Get all P1 offers
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

    console.log(`Found ${offers.length} P1 offers\n`);
    console.log("=".repeat(80));
    console.log("Checking fixture mapping...");
    console.log("=".repeat(80));

    const results = {
      total: offers.length,
      mapped: 0,
      noFixture: 0,
      noHomeTeam: 0,
      noAwayTeam: 0,
      issues: [],
    };

    for (const offer of offers) {
      if (!offer.fixtureId) {
        results.noFixture++;
        results.issues.push({
          offerId: offer._id,
          issue: "No fixture",
        });
        continue;
      }

      const fixture = offer.fixtureId;

      if (!fixture.homeTeam) {
        results.noHomeTeam++;
        results.issues.push({
          offerId: offer._id,
          fixtureId: fixture._id,
          fixtureSlug: fixture.slug || "N/A",
          issue: "No home team",
        });
        continue;
      }

      if (!fixture.awayTeam) {
        results.noAwayTeam++;
        results.issues.push({
          offerId: offer._id,
          fixtureId: fixture._id,
          fixtureSlug: fixture.slug || "N/A",
          homeTeam: fixture.homeTeam.name_en,
          issue: "No away team",
        });
        continue;
      }

      // Check if teams have P1 mapping
      const homeTeam = await Team.findById(fixture.homeTeam._id).lean();
      const awayTeam = await Team.findById(fixture.awayTeam._id).lean();

      const homeP1Info = homeTeam?.suppliersInfo?.find(
        (s) => s.supplierRef?.toString() === p1._id.toString()
      );
      const awayP1Info = awayTeam?.suppliersInfo?.find(
        (s) => s.supplierRef?.toString() === p1._id.toString()
      );

      if (!homeP1Info || !homeP1Info.supplierTeamName) {
        results.issues.push({
          offerId: offer._id,
          fixtureId: fixture._id,
          fixtureSlug: fixture.slug || "N/A",
          homeTeam: fixture.homeTeam.name_en,
          awayTeam: fixture.awayTeam.name_en,
          issue: "Home team not mapped to P1",
        });
        continue;
      }

      if (!awayP1Info || !awayP1Info.supplierTeamName) {
        results.issues.push({
          offerId: offer._id,
          fixtureId: fixture._id,
          fixtureSlug: fixture.slug || "N/A",
          homeTeam: fixture.homeTeam.name_en,
          awayTeam: fixture.awayTeam.name_en,
          issue: "Away team not mapped to P1",
        });
        continue;
      }

      results.mapped++;
    }

    // Print summary
    console.log("\n" + "=".repeat(80));
    console.log("📊 Mapping Results");
    console.log("=".repeat(80));
    console.log(`Total P1 offers: ${results.total}`);
    console.log(`✅ Fully mapped (fixture + both teams): ${results.mapped}`);
    console.log(`❌ Issues: ${results.total - results.mapped}`);
    console.log(`   - No fixture: ${results.noFixture}`);
    console.log(`   - No home team: ${results.noHomeTeam}`);
    console.log(`   - No away team: ${results.noAwayTeam}`);
    console.log(
      `   - Teams not mapped to P1: ${
        results.issues.length -
        results.noFixture -
        results.noHomeTeam -
        results.noAwayTeam
      }`
    );

    // Show issues
    if (results.issues.length > 0) {
      console.log("\n" + "=".repeat(80));
      console.log("❌ Offers with mapping issues:");
      console.log("=".repeat(80));
      results.issues.slice(0, 20).forEach((item, idx) => {
        console.log(`\n${idx + 1}. Offer ID: ${item.offerId}`);
        console.log(`   Issue: ${item.issue}`);
        if (item.fixtureSlug) {
          console.log(`   Fixture: ${item.fixtureSlug}`);
        }
        if (item.homeTeam) {
          console.log(`   Home: ${item.homeTeam}`);
        }
        if (item.awayTeam) {
          console.log(`   Away: ${item.awayTeam}`);
        }
      });
      if (results.issues.length > 20) {
        console.log(`\n... and ${results.issues.length - 20} more issues`);
      }
    }

    // Print success rate
    const successRate = ((results.mapped / results.total) * 100).toFixed(2);
    console.log("\n" + "=".repeat(80));
    console.log(`✅ Success rate: ${successRate}%`);
    console.log("=".repeat(80));
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
