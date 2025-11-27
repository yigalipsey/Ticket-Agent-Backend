import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import csv from "csv-parser";
import Offer from "../src/models/Offer.js";
import Supplier from "../src/models/Supplier.js";
import FootballEvent from "../src/models/FootballEvent.js";
import Team from "../src/models/Team.js";
import League from "../src/models/League.js";

const CSV_FILE = "data/p1-offers.csv";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");

  try {
    const p1 = await Supplier.findOne({ slug: "p1-travel" });
    if (!p1) {
      throw new Error("P1 Travel supplier not found");
    }

    // Read CSV and group by unique matches with lowest price
    console.log("Reading CSV file...");
    const matchesMap = new Map();

    await new Promise((resolve, reject) => {
      fs.createReadStream(CSV_FILE)
        .pipe(csv())
        .on("data", (row) => {
          const categoryPath = row.categoryPath || "";
          if (
            categoryPath.toLowerCase().includes("football") &&
            row.home_team_name &&
            row.away_team_name &&
            row.date_start
          ) {
            // Extract league
            let league = "Other";
            const catLower = categoryPath.toLowerCase();
            if (catLower.includes("premier league")) {
              league = "Premier League";
            } else if (catLower.includes("bundesliga")) {
              league = "Bundesliga";
            } else if (catLower.includes("serie a")) {
              league = "Serie A";
            } else if (catLower.includes("la liga")) {
              league = "La Liga";
            } else if (catLower.includes("ligue 1")) {
              league = "Ligue 1";
            } else if (catLower.includes("champions league")) {
              league = "Champions League";
            } else if (catLower.includes("europa league")) {
              league = "Europa League";
            }

            const key = `${league}|${row.home_team_name.trim()}|${row.away_team_name.trim()}|${row.date_start.trim()}`;

            if (!matchesMap.has(key)) {
              matchesMap.set(key, {
                league,
                homeTeam: row.home_team_name.trim(),
                awayTeam: row.away_team_name.trim(),
                date: row.date_start.trim(),
                minPrice: Infinity,
                url: "",
              });
            }

            const price = parseFloat(row.price) || 0;
            const match = matchesMap.get(key);
            if (price > 0 && row.productURL) {
              if (price < match.minPrice || match.minPrice === Infinity) {
                match.minPrice = price;
                match.url = row.productURL.trim();
              }
            }
          }
        })
        .on("end", resolve)
        .on("error", reject);
    });

    const csvMatches = Array.from(matchesMap.values()).filter(
      (m) => m.minPrice < Infinity
    );
    console.log(`Found ${csvMatches.length} unique football matches in CSV\n`);

    // Get all existing P1 offers
    const existingOffers = await Offer.find({
      ownerType: "Supplier",
      ownerId: p1._id,
    })
      .populate("fixtureId", "slug homeTeam awayTeam date league")
      .lean();

    console.log(`Found ${existingOffers.length} existing P1 offers\n`);

    // Group by league
    const byLeague = new Map();
    csvMatches.forEach((match) => {
      if (!byLeague.has(match.league)) {
        byLeague.set(match.league, []);
      }
      byLeague.get(match.league).push(match);
    });

    console.log("=".repeat(80));
    console.log("Finding missing offers...");
    console.log("=".repeat(80));

    const missingByLeague = new Map();

    for (const [league, matches] of byLeague.entries()) {
      const missing = [];

      // Find league in DB
      const leagueDoc = await League.findOne({
        $or: [
          { name: league },
          { slug: league.toLowerCase().replace(/\s+/g, "-") },
          { name: new RegExp(league, "i") },
        ],
      }).lean();

      if (!leagueDoc) {
        console.log(`\n⚠️  League "${league}" not found in DB, skipping...`);
        continue;
      }

      for (const match of matches) {
        // Find teams - try multiple strategies
        // First try by P1 supplier name
        let homeTeam = await Team.findOne({
          "suppliersInfo.supplierTeamName": match.homeTeam,
          "suppliersInfo.supplierRef": p1._id,
        }).lean();

        if (!homeTeam) {
          // Try normalized name matching
          const normalizedHome = match.homeTeam
            .replace(/FC|United|City|04|&/g, "")
            .trim();
          homeTeam = await Team.findOne({
            $or: [
              { name_en: new RegExp(`^${normalizedHome}$`, "i") },
              { name_en: new RegExp(normalizedHome, "i") },
            ],
          }).lean();
        }

        let awayTeam = await Team.findOne({
          "suppliersInfo.supplierTeamName": match.awayTeam,
          "suppliersInfo.supplierRef": p1._id,
        }).lean();

        if (!awayTeam) {
          // Try normalized name matching
          const normalizedAway = match.awayTeam
            .replace(/FC|United|City|04|&/g, "")
            .trim();
          awayTeam = await Team.findOne({
            $or: [
              { name_en: new RegExp(`^${normalizedAway}$`, "i") },
              { name_en: new RegExp(normalizedAway, "i") },
            ],
          }).lean();
        }

        if (!homeTeam || !awayTeam) {
          continue;
        }

        // Check if fixture exists
        const matchDate = new Date(match.date + "T00:00:00Z");
        const startDate = new Date(matchDate);
        startDate.setDate(startDate.getDate() - 3);
        const endDate = new Date(matchDate);
        endDate.setDate(endDate.getDate() + 3);

        const fixture = await FootballEvent.findOne({
          league: leagueDoc._id,
          $or: [
            { homeTeam: homeTeam._id, awayTeam: awayTeam._id },
            { homeTeam: awayTeam._id, awayTeam: homeTeam._id },
          ],
          date: { $gte: startDate, $lte: endDate },
        }).lean();

        if (!fixture) {
      missing.push({
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        date: match.date,
        minPrice: match.minPrice,
        url: match.url,
        reason: "Fixture not found in DB",
      });
        } else {
          // Check if offer exists
          const offerExists = existingOffers.some((o) => {
            return (
              o.fixtureId &&
              o.fixtureId._id.toString() === fixture._id.toString()
            );
          });

          if (!offerExists) {
            missing.push({
              homeTeam: match.homeTeam,
              awayTeam: match.awayTeam,
              date: match.date,
              minPrice: match.minPrice,
              url: match.url,
              fixtureId: fixture._id.toString(),
              reason: "Fixture exists but no P1 offer",
            });
          }
        }
      }

      if (missing.length > 0) {
        missingByLeague.set(league, missing);
      }
    }

    // Print results
    console.log("\n" + "=".repeat(80));
    console.log("📊 Missing P1 Offers by League");
    console.log("=".repeat(80));

    let totalMissing = 0;
    for (const [league, missing] of missingByLeague.entries()) {
      console.log(`\n${league}: ${missing.length} missing offers`);
      totalMissing += missing.length;

      // Group by reason
      const byReason = new Map();
      missing.forEach((m) => {
        if (!byReason.has(m.reason)) {
          byReason.set(m.reason, []);
        }
        byReason.get(m.reason).push(m);
      });

      for (const [reason, items] of byReason.entries()) {
        console.log(`  ${reason}: ${items.length}`);
      }

      // List all matches
      console.log("\n  Matches:");
      missing.forEach((m, idx) => {
        const price = m.minPrice !== Infinity ? `${m.minPrice} EUR` : "N/A";
        console.log(
          `    ${idx + 1}. ${m.homeTeam} vs ${m.awayTeam} (${m.date}) - ${price}`
        );
      });
    }

    console.log("\n" + "=".repeat(80));
    console.log(`Total missing offers: ${totalMissing}`);
    console.log("=".repeat(80));

    // Save to JSON file
    const output = {};
    for (const [league, missing] of missingByLeague.entries()) {
      output[league] = missing.map((m) => ({
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        date: m.date,
        minPrice: m.minPrice !== Infinity ? m.minPrice : null,
        url: m.url,
        reason: m.reason,
        fixtureId: m.fixtureId || null,
      }));
    }

    fs.writeFileSync(
      "data/p1/missing_offers.json",
      JSON.stringify(output, null, 2)
    );
    console.log("\n✅ Saved to data/p1/missing_offers.json");
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

