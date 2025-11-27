import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import csv from "csv-parser";
import Offer from "../src/models/Offer.js";
import Supplier from "../src/models/Supplier.js";
import FootballEvent from "../src/models/FootballEvent.js";
import Team from "../src/models/Team.js";
import League from "../src/models/League.js";

const AFFILIATE_LINK = "https://p1travel.prf.hn/click/camref:1100l5y3LS";
const CSV_FILE = "data/p1-offers.csv";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");

  try {
    const p1 = await Supplier.findOne({ slug: "p1-travel" });
    if (!p1) {
      throw new Error("P1 Travel supplier not found");
    }

    // Read all offers from DB
    const dbOffers = await Offer.find({
      ownerType: "Supplier",
      ownerId: p1._id,
    })
      .populate("fixtureId", "slug homeTeam awayTeam date league")
      .populate({
        path: "fixtureId",
        populate: [
          { path: "homeTeam", select: "name_en" },
          { path: "awayTeam", select: "name_en" },
        ],
      })
      .lean();

    console.log(`Found ${dbOffers.length} P1 offers in database\n`);

    // Read CSV file
    const csvOffers = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(CSV_FILE)
        .pipe(csv())
        .on("data", (row) => {
          if (
            row.productURL &&
            row.productURL.includes("p1travel.com") &&
            row.home_team_name &&
            row.away_team_name
          ) {
            csvOffers.push({
              home: row.home_team_name.trim(),
              away: row.away_team_name.trim(),
              date: row.date_start,
              url: row.productURL.trim(),
              price: row.price,
            });
          }
        })
        .on("end", resolve)
        .on("error", reject);
    });

    console.log(`Found ${csvOffers.length} offers in CSV with URLs\n`);

    console.log("=".repeat(80));
    console.log("Verifying database offers against CSV...");
    console.log("=".repeat(80));

    const results = {
      total: dbOffers.length,
      matched: 0,
      notMatched: 0,
      missingInCSV: 0,
      urlMismatch: 0,
      issues: [],
    };

    for (const dbOffer of dbOffers) {
      const fixture = dbOffer.fixtureId;
      if (!fixture || !fixture.homeTeam || !fixture.awayTeam) {
        results.notMatched++;
        results.issues.push({
          offerId: dbOffer._id,
          fixture: fixture?.slug || "N/A",
          issue: "Fixture or teams not found",
        });
        continue;
      }

      const dbHome = fixture.homeTeam.name_en;
      const dbAway = fixture.awayTeam.name_en;
      const dbDate = new Date(fixture.date).toISOString().split("T")[0];

      // Extract URL from DB offer
      let dbUrl = "";
      if (dbOffer.url) {
        const urlMatch = dbOffer.url.match(/url=([^&]+)/);
        if (urlMatch) {
          try {
            dbUrl = decodeURIComponent(urlMatch[1]).toLowerCase();
          } catch (e) {
            dbUrl = dbOffer.url.toLowerCase();
          }
        } else {
          dbUrl = dbOffer.url.toLowerCase();
        }
      }

      // Find matching CSV offer (with flexible date matching)
      const csvMatch = csvOffers.find((csvOffer) => {
        const csvDate = csvOffer.date;
        
        // Normalize team names for matching
        const normalizeName = (name) => {
          return name
            .toLowerCase()
            .replace(/fc\s+/g, "")
            .replace(/\s+/g, " ")
            .trim();
        };
        
        const dbHomeNorm = normalizeName(dbHome);
        const dbAwayNorm = normalizeName(dbAway);
        const csvHomeNorm = normalizeName(csvOffer.home);
        const csvAwayNorm = normalizeName(csvOffer.away);
        
        const homeMatch =
          csvHomeNorm.includes(dbHomeNorm) ||
          dbHomeNorm.includes(csvHomeNorm) ||
          csvHomeNorm === dbHomeNorm;
        const awayMatch =
          csvAwayNorm.includes(dbAwayNorm) ||
          dbAwayNorm.includes(csvAwayNorm) ||
          csvAwayNorm === dbAwayNorm;

        // Date matching: allow ±1 day difference
        const dateMatch =
          csvDate === dbDate ||
          (csvDate &&
            dbDate &&
            Math.abs(
              new Date(csvDate).getTime() - new Date(dbDate).getTime()
            ) <=
              24 * 60 * 60 * 1000);

        return homeMatch && awayMatch && dateMatch;
      });

      if (!csvMatch) {
        results.missingInCSV++;
        results.issues.push({
          offerId: dbOffer._id,
          fixture: fixture.slug || "N/A",
          issue: "Not found in CSV",
          dbMatch: `${dbHome} vs ${dbAway} (${dbDate})`,
        });
        continue;
      }

      // Check if URL matches
      const csvUrl = csvMatch.url.toLowerCase();
      if (dbUrl !== csvUrl) {
        results.urlMismatch++;
        results.issues.push({
          offerId: dbOffer._id,
          fixture: fixture.slug || "N/A",
          issue: "URL mismatch",
          dbMatch: `${dbHome} vs ${dbAway} (${dbDate})`,
          dbUrl: dbUrl.substring(0, 80),
          csvUrl: csvUrl.substring(0, 80),
        });
        continue;
      }

      // Check if affiliate link is present
      if (!dbOffer.url.includes("camref:1100l5y3LS")) {
        results.issues.push({
          offerId: dbOffer._id,
          fixture: fixture.slug || "N/A",
          issue: "Missing affiliate link",
          dbMatch: `${dbHome} vs ${dbAway} (${dbDate})`,
        });
        continue;
      }

      results.matched++;
    }

    // Print summary
    console.log("\n" + "=".repeat(80));
    console.log("📊 Verification Results");
    console.log("=".repeat(80));
    console.log(`Total DB offers: ${results.total}`);
    console.log(`✅ Matched with CSV (correct URL + affiliate link): ${results.matched}`);
    console.log(`❌ Issues found: ${results.total - results.matched}`);
    console.log(`   - Not found in CSV: ${results.missingInCSV}`);
    console.log(`   - URL mismatch: ${results.urlMismatch}`);
    console.log(`   - Other issues: ${results.notMatched}`);

    // Print issues (limit to first 20)
    if (results.issues.length > 0) {
      console.log("\n" + "=".repeat(80));
      console.log(`❌ Offers with issues (showing first 20):`);
      console.log("=".repeat(80));
      results.issues.slice(0, 20).forEach((item, idx) => {
        console.log(`\n${idx + 1}. Fixture: ${item.fixture}`);
        console.log(`   Offer ID: ${item.offerId}`);
        console.log(`   Issue: ${item.issue}`);
        if (item.dbMatch) {
          console.log(`   Match: ${item.dbMatch}`);
        }
        if (item.dbUrl && item.csvUrl) {
          console.log(`   DB URL: ${item.dbUrl}`);
          console.log(`   CSV URL: ${item.csvUrl}`);
        }
      });
      if (results.issues.length > 20) {
        console.log(`\n... and ${results.issues.length - 20} more issues`);
      }
    }

    // Print success rate
    const successRate = ((results.matched / results.total) * 100).toFixed(2);
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

