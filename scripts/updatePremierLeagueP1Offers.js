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

    // Read CSV and group by unique matches with lowest price
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
                minPrice: Infinity,
                minPriceOffer: null,
              });
            }

            const price = parseFloat(row.price) || 0;
            const match = matchesMap.get(key);
            if (price > 0 && price < match.minPrice && row.productURL) {
              match.minPrice = price;
              match.minPriceOffer = {
                price,
                url: row.productURL.trim(),
                description: row.description || "",
              };
            }
          }
        })
        .on("end", resolve)
        .on("error", reject);
    });

    const csvMatches = Array.from(matchesMap.values()).filter(
      (m) => m.minPriceOffer
    );
    console.log(`Found ${csvMatches.length} unique Premier League matches in CSV\n`);

    console.log("=".repeat(80));
    console.log("Updating offers...");
    console.log("=".repeat(80));

    let updated = 0;
    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const match of csvMatches) {
      try {
        // Find teams
        const homeTeam = await Team.findOne({
          $or: [
            { name_en: new RegExp(match.homeTeam.replace(/FC|United|City/g, "").trim(), "i") },
            { "suppliersInfo.supplierTeamName": match.homeTeam },
          ],
        });

        const awayTeam = await Team.findOne({
          $or: [
            { name_en: new RegExp(match.awayTeam.replace(/FC|United|City/g, "").trim(), "i") },
            { "suppliersInfo.supplierTeamName": match.awayTeam },
          ],
        });

        if (!homeTeam || !awayTeam) {
          skipped++;
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
        });

        if (!fixture) {
          skipped++;
          continue;
        }

        // Build affiliate URL
        const originalUrl = match.minPriceOffer.url;
        const affiliateUrl = `${AFFILIATE_LINK_BASE}/destination:${originalUrl}`;

        // Check if offer exists
        const existingOffer = await Offer.findOne({
          ownerType: "Supplier",
          ownerId: p1._id,
          fixtureId: fixture._id,
        });

        const description = match.minPriceOffer.description || "";
        const isHospitality =
          description.toLowerCase().includes("hospitality") ||
          description.toLowerCase().includes("lounge") ||
          description.toLowerCase().includes("vip");

        if (existingOffer) {
          // Update existing offer
          existingOffer.price = match.minPrice;
          existingOffer.currency = "GBP";
          existingOffer.url = affiliateUrl;
          existingOffer.isHospitality = isHospitality;
          existingOffer.updatedAt = new Date();
          await existingOffer.save();

          updated++;
          if (updated % 20 === 0) {
            console.log(`Updated ${updated} offers...`);
          }
        } else {
          // Create new offer
          const newOffer = new Offer({
            ownerType: "Supplier",
            ownerId: p1._id,
            fixtureId: fixture._id,
            price: match.minPrice,
            currency: "GBP",
            url: affiliateUrl,
            isHospitality: isHospitality,
            isAvailable: true,
          });

          await newOffer.save();
          created++;
        }
      } catch (error) {
        console.error(
          `Error processing ${match.homeTeam} vs ${match.awayTeam}:`,
          error.message
        );
        errors++;
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log("📊 Results");
    console.log("=".repeat(80));
    console.log(`Total matches in CSV: ${csvMatches.length}`);
    console.log(`✅ Updated: ${updated}`);
    console.log(`✅ Created: ${created}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
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




