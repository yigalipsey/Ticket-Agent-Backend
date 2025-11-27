import "dotenv/config";
import mongoose from "mongoose";

import FootballEvent from "../src/models/FootballEvent.js";
import League from "../src/models/League.js";
import Supplier from "../src/models/Supplier.js";
import Team from "../src/models/Team.js"; // eslint-disable-line no-unused-vars

const PREMIER_LEAGUE_ID = "68d6809aa0fb97844d2084b9";
const SUPPLIER_SLUG = "hellotickets";

async function run() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  try {
    const supplier = await Supplier.findOne({ slug: SUPPLIER_SLUG });
    if (!supplier) {
      throw new Error(`Supplier '${SUPPLIER_SLUG}' not found`);
    }

    const league = await League.findById(PREMIER_LEAGUE_ID).select("name");

    const now = new Date();

    const events = await FootballEvent.find({
      league: PREMIER_LEAGUE_ID,
      date: { $gte: now },
    })
      .select("date slug supplierExternalIds minPrice")
      .populate("homeTeam", "name")
      .populate("awayTeam", "name")
      .lean();

    const total = events.length;
    const withMapping = [];
    const missingMapping = [];

    for (const event of events) {
      const hasSupplierEntry = event.supplierExternalIds?.some(
        (entry) => entry.supplierRef?.toString() === supplier._id.toString()
      );
      if (hasSupplierEntry) {
        withMapping.push(event);
      } else {
        missingMapping.push(event);
      }
    }

    console.log("📊 Premier League HelloTickets Coverage");
    console.log("--------------------------------------");
    console.log(`League: ${league?.name || PREMIER_LEAGUE_ID}`);
    console.log(`Future events in DB: ${total}`);
    console.log(`With HelloTickets mapping: ${withMapping.length}`);
    console.log(`Missing mapping: ${missingMapping.length}`);

    if (missingMapping.length > 0) {
      console.log("\n⚠️  Events missing HelloTickets mapping:");
      missingMapping.slice(0, 20).forEach((event) => {
        console.log(
          ` - ${event.homeTeam?.name || "?"} vs ${
            event.awayTeam?.name || "?"
          } (${event.slug}) on ${event.date.toISOString()}`
        );
      });
      if (missingMapping.length > 20) {
        console.log(`   ...and ${missingMapping.length - 20} more`);
      }
    }
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
