import "dotenv/config";
import mongoose from "mongoose";
import Offer from "../src/models/Offer.js";
import FootballEvent from "../src/models/FootballEvent.js";
import Team from "../src/models/Team.js";

async function run() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined");
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");

  try {
    // 1. Find all offers grouped by fixtureId and ownerId
    const offers = await Offer.find({}).lean();

    console.log(`📊 Total offers in database: ${offers.length}\n`);

    // 2. Group offers by fixtureId and ownerId
    const offerMap = new Map();
    const duplicateOffers = [];
    const fixturesWithOffers = new Set();

    for (const offer of offers) {
      // Skip offers with missing required fields
      if (!offer.fixtureId || !offer.ownerId) {
        console.warn(`⚠️  Skipping offer ${offer._id}: missing fixtureId or ownerId`);
        continue;
      }

      const fixtureId = offer.fixtureId.toString();
      const ownerId = offer.ownerId.toString();
      const key = `${fixtureId}_${ownerId}`;

      fixturesWithOffers.add(fixtureId);

      if (!offerMap.has(key)) {
        offerMap.set(key, []);
      }
      offerMap.get(key).push(offer);
    }

    // 3. Find duplicates (same fixtureId + ownerId)
    for (const [key, offerList] of offerMap.entries()) {
      if (offerList.length > 1) {
        duplicateOffers.push({
          key,
          count: offerList.length,
          offers: offerList,
        });
      }
    }

    // 4. Get fixture details for duplicates
    const fixtureIds = Array.from(fixturesWithOffers).map((id) =>
      new mongoose.Types.ObjectId(id)
    );
    const fixtures = await FootballEvent.find({
      _id: { $in: fixtureIds },
    })
      .select("slug date homeTeam awayTeam")
      .populate("homeTeam", "name")
      .populate("awayTeam", "name")
      .lean();

    const fixtureMap = new Map(
      fixtures.map((f) => [f._id.toString(), f])
    );

    // 5. Print results
    if (duplicateOffers.length === 0) {
      console.log("✅ No duplicate offers found!");
      console.log(`   All ${offers.length} offers are unique per fixture+owner\n`);
    } else {
      console.log(`❌ Found ${duplicateOffers.length} duplicate offer groups:\n`);

      for (const duplicate of duplicateOffers) {
        const [fixtureId, ownerId] = duplicate.key.split("_");
        const fixture = fixtureMap.get(fixtureId);
        const fixtureName = fixture
          ? `${fixture.homeTeam?.name || "?"} vs ${fixture.awayTeam?.name || "?"} (${fixture.slug})`
          : `Fixture ID: ${fixtureId}`;

        console.log(`\n🔴 Duplicate Group: ${duplicate.count} offers`);
        console.log(`   Fixture: ${fixtureName}`);
        console.log(`   Owner ID: ${ownerId}`);
        console.log(`   Owner Type: ${duplicate.offers[0].ownerType}`);

        for (let i = 0; i < duplicate.offers.length; i++) {
          const offer = duplicate.offers[i];
          console.log(`   Offer ${i + 1}:`);
          console.log(`     - ID: ${offer._id}`);
          console.log(`     - Price: ${offer.currency} ${offer.price}`);
          console.log(`     - Ticket Type: ${offer.ticketType}`);
          console.log(`     - URL: ${offer.url ? "Yes" : "No"}`);
          console.log(`     - Created: ${offer.createdAt}`);
        }
      }
    }

    // 6. Statistics
    console.log("\n📊 Statistics:");
    console.log("==================");
    console.log(`Total offers: ${offers.length}`);
    console.log(`Unique fixture+owner combinations: ${offerMap.size}`);
    console.log(`Fixtures with offers: ${fixturesWithOffers.size}`);
    console.log(`Duplicate groups: ${duplicateOffers.length}`);

    // 7. Count offers per fixture (multiple owners is OK)
    const offersPerFixture = new Map();
    for (const offer of offers) {
      const fixtureId = offer.fixtureId.toString();
      if (!offersPerFixture.has(fixtureId)) {
        offersPerFixture.set(fixtureId, []);
      }
      offersPerFixture.get(fixtureId).push(offer);
    }

    const fixturesWithMultipleOffers = Array.from(offersPerFixture.entries())
      .filter(([_, offerList]) => offerList.length > 1)
      .map(([fixtureId, offerList]) => ({
        fixtureId,
        count: offerList.length,
        owners: Array.from(
          new Set(
            offerList
              .filter((o) => o.ownerId)
              .map((o) => o.ownerId.toString())
          )
        ),
      }));

    console.log(`\nFixtures with multiple offers (from different owners): ${fixturesWithMultipleOffers.length}`);
    
    if (fixturesWithMultipleOffers.length > 0 && fixturesWithMultipleOffers.length <= 10) {
      console.log("\nExamples:");
      for (const item of fixturesWithMultipleOffers.slice(0, 5)) {
        const fixture = fixtureMap.get(item.fixtureId);
        const fixtureName = fixture
          ? `${fixture.homeTeam?.name || "?"} vs ${fixture.awayTeam?.name || "?"}`
          : `Fixture ID: ${item.fixtureId}`;
        console.log(`   - ${fixtureName}: ${item.count} offers from ${item.owners.length} owners`);
      }
    }

    // 8. Summary
    if (duplicateOffers.length > 0) {
      console.log("\n⚠️  ACTION REQUIRED:");
      console.log("   There are duplicate offers that violate the unique constraint.");
      console.log("   You should clean them up by keeping only one offer per fixture+owner.");
    } else {
      console.log("\n✅ All good! No duplicate offers found.");
    }
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
}

run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

