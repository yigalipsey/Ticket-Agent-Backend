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
const AFFILIATE_LINK_BASE = "https://p1travel.prf.hn/click/camref:1100l5y3LS";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");

  try {
    const p1 = await Supplier.findOne({ slug: "p1-travel" });
    if (!p1) {
      throw new Error("P1 Travel supplier not found");
    }

    const premierLeague = await League.findOne({
      $or: [
        { name: "Premier League" },
        { slug: "premier-league" },
        { name: /premier league/i },
      ],
    });

    if (!premierLeague) {
      throw new Error("Premier League not found");
    }

    // Read CSV and group by unique matches
    console.log("Reading CSV file...");
    const matchesMap = new Map();

    await new Promise((resolve, reject) => {
      fs.createReadStream(CSV_FILE)
        .pipe(csv())
        .on("data", (row) => {
          const categoryPath = row.categoryPath || "";
          if (
            categoryPath.toLowerCase().includes("premier league") &&
            row.home_team_name &&
            row.away_team_name &&
            row.date_start
          ) {
            const key = `${row.home_team_name.trim()}|${row.away_team_name.trim()}|${row.date_start.trim()}`;

            if (!matchesMap.has(key)) {
              matchesMap.set(key, {
                homeTeam: row.home_team_name.trim(),
                awayTeam: row.away_team_name.trim(),
                date: row.date_start.trim(),
                offers: [],
              });
            }

            const price = parseFloat(row.price) || 0;
            if (price > 0 && row.productURL) {
              matchesMap.get(key).offers.push({
                price,
                url: row.productURL.trim(),
                description: row.description || "",
              });
            }
          }
        })
        .on("end", resolve)
        .on("error", reject);
    });

    const csvMatches = Array.from(matchesMap.values());
    console.log(`Found ${csvMatches.length} unique Premier League matches in CSV\n`);

    // Get all existing P1 offers for Premier League
    const existingOffers = await Offer.find({
      ownerType: "Supplier",
      ownerId: p1._id,
    })
      .populate({
        path: "fixtureId",
        populate: [
          { path: "homeTeam", select: "name_en" },
          { path: "awayTeam", select: "name_en" },
          { path: "league", select: "name slug" },
        ],
      })
      .lean();

    const plOffers = existingOffers.filter(
      (o) =>
        o.fixtureId &&
        o.fixtureId.league &&
        (o.fixtureId.league._id.toString() === premierLeague._id.toString() ||
          o.fixtureId.league.slug === "premier-league")
    );

    console.log(`Found ${plOffers.length} existing P1 offers for Premier League\n`);

    console.log("=".repeat(80));
    console.log("Checking each match...");
    console.log("=".repeat(80));

    const results = {
      total: csvMatches.length,
      hasOffer: 0,
      noOffer: 0,
      invalidOffer: 0,
      issues: [],
    };

    for (const match of csvMatches) {
      // Find teams
      const homeTeam = await Team.findOne({
        $or: [
          { name_en: new RegExp(match.homeTeam.replace(/FC|United|City/g, "").trim(), "i") },
          { "suppliersInfo.supplierTeamName": match.homeTeam },
        ],
      }).lean();

      const awayTeam = await Team.findOne({
        $or: [
          { name_en: new RegExp(match.awayTeam.replace(/FC|United|City/g, "").trim(), "i") },
          { "suppliersInfo.supplierTeamName": match.awayTeam },
        ],
      }).lean();

      if (!homeTeam || !awayTeam) {
        results.noOffer++;
        results.issues.push({
          match: `${match.homeTeam} vs ${match.awayTeam} (${match.date})`,
          issue: !homeTeam ? `Home team "${match.homeTeam}" not found` : `Away team "${match.awayTeam}" not found`,
        });
        continue;
      }

      // Find fixture
      const matchDate = new Date(match.date + "T00:00:00Z");
      const startDate = new Date(matchDate);
      startDate.setDate(startDate.getDate() - 3);
      const endDate = new Date(matchDate);
      endDate.setDate(endDate.getDate() + 3);

      const fixture = await FootballEvent.findOne({
        league: premierLeague._id,
        $or: [
          { homeTeam: homeTeam._id, awayTeam: awayTeam._id },
          { homeTeam: awayTeam._id, awayTeam: homeTeam._id },
        ],
        date: { $gte: startDate, $lte: endDate },
      }).lean();

      if (!fixture) {
        results.noOffer++;
        results.issues.push({
          match: `${match.homeTeam} vs ${match.awayTeam} (${match.date})`,
          issue: "Fixture not found in DB",
        });
        continue;
      }

      // Find offer for this fixture
      const offer = plOffers.find(
        (o) => o.fixtureId && o.fixtureId._id.toString() === fixture._id.toString()
      );

      if (!offer) {
        results.noOffer++;
        results.issues.push({
          match: `${match.homeTeam} vs ${match.awayTeam} (${match.date})`,
          issue: "No P1 offer found",
        });
        continue;
      }

      // Check offer validity
      const minPrice = Math.min(...match.offers.map((o) => o.price));
      const issues = [];

      // Check 1: Price should be lowest
      if (offer.price > minPrice) {
        issues.push(`Price too high: ${offer.price} vs ${minPrice}`);
      }

      // Check 2: URL should have affiliate link
      if (!offer.url || !offer.url.includes("camref:1100l5y3LS")) {
        issues.push("Missing affiliate link");
      }

      // Check 3: URL should have destination: format
      if (!offer.url || !offer.url.includes("/destination:")) {
        issues.push("Invalid URL format (should use /destination:)");
      }

      // Check 4: URL should be specific match page
      const urlMatch = offer.url.match(/\/destination:(.+)$/);
      if (urlMatch) {
        const actualUrl = urlMatch[1];
        if (
          !actualUrl.includes("/football/premier-league/") ||
          actualUrl.endsWith("/premier-league/")
        ) {
          issues.push("URL is not specific match page");
        }
      } else {
        issues.push("Could not extract destination URL");
      }

      if (issues.length > 0) {
        results.invalidOffer++;
        results.issues.push({
          match: `${match.homeTeam} vs ${match.awayTeam} (${match.date})`,
          issue: issues.join(", "),
          offerPrice: offer.price,
          minPrice,
          url: offer.url.substring(0, 100),
        });
      } else {
        results.hasOffer++;
      }
    }

    // Print results
    console.log("\n" + "=".repeat(80));
    console.log("📊 Premier League P1 Offers Check");
    console.log("=".repeat(80));
    console.log(`Total unique matches in CSV: ${results.total}`);
    console.log(`✅ Has valid offer: ${results.hasOffer}`);
    console.log(`❌ No offer or invalid: ${results.noOffer + results.invalidOffer}`);
    console.log(`   - No offer: ${results.noOffer}`);
    console.log(`   - Invalid offer: ${results.invalidOffer}`);

    if (results.issues.length > 0) {
      console.log("\n" + "=".repeat(80));
      console.log("❌ Issues found:");
      console.log("=".repeat(80));
      results.issues.slice(0, 30).forEach((item, idx) => {
        console.log(`\n${idx + 1}. ${item.match}`);
        console.log(`   Issue: ${item.issue}`);
        if (item.offerPrice) {
          console.log(`   Offer price: ${item.offerPrice}, Min price: ${item.minPrice}`);
        }
        if (item.url) {
          console.log(`   URL: ${item.url}...`);
        }
      });
      if (results.issues.length > 30) {
        console.log(`\n... and ${results.issues.length - 30} more issues`);
      }
    }

    const successRate = ((results.hasOffer / results.total) * 100).toFixed(2);
    console.log("\n" + "=".repeat(80));
    console.log(`✅ Success rate: ${successRate}%`);
    console.log("=".repeat(80));
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




