import "dotenv/config";
import mongoose from "mongoose";
import Offer from "../src/models/Offer.js";
import FootballEvent from "../src/models/FootballEvent.js";
import Team from "../src/models/Team.js";
import fs from "fs";
import csv from "csv-parser";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");

  try {
    const offerId = "6926efca09f0247a4469def5";
    const offer = await Offer.findById(offerId).lean();
    
    if (!offer) {
      console.log("❌ Offer not found");
      return;
    }

    const fixture = await FootballEvent.findById(offer.fixtureId)
      .populate("homeTeam", "name_en")
      .populate("awayTeam", "name_en")
      .lean();

    console.log("Offer Details:");
    console.log(`  ID: ${offer._id}`);
    console.log(`  Price: ${offer.price} ${offer.currency}`);
    console.log(`  URL: ${offer.url}`);
    
    // Decode URL
    const urlMatch = offer.url.match(/url=([^&]+)/);
    if (urlMatch) {
      const decodedUrl = decodeURIComponent(urlMatch[1]);
      console.log(`  Decoded URL: ${decodedUrl}`);
    }

    console.log("\nFixture Details:");
    console.log(`  Home: ${fixture.homeTeam.name_en}`);
    console.log(`  Away: ${fixture.awayTeam.name_en}`);
    console.log(`  Date: ${fixture.date}`);

    // Search CSV
    console.log("\nSearching CSV for matching offers...");
    const csvOffers = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream("data/p1-offers.csv")
        .pipe(csv())
        .on("data", (row) => {
          if (
            row.home_team_name &&
            row.away_team_name &&
            row.productURL &&
            row.productURL.includes("p1travel.com")
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

    const dbHome = fixture.homeTeam.name_en;
    const dbAway = fixture.awayTeam.name_en;
    const dbDate = new Date(fixture.date).toISOString().split("T")[0];

    console.log(`\nLooking for: ${dbHome} vs ${dbAway} on ${dbDate}\n`);

    const matches = csvOffers.filter((csvOffer) => {
      const homeMatch =
        csvOffer.home.toLowerCase().includes(dbHome.toLowerCase()) ||
        dbHome.toLowerCase().includes(csvOffer.home.toLowerCase());
      const awayMatch =
        (csvOffer.away.toLowerCase().includes(dbAway.toLowerCase()) ||
          dbAway.toLowerCase().includes(csvOffer.away.toLowerCase())) ||
        (csvOffer.away.toLowerCase().includes("wolverhampton") &&
          dbAway.toLowerCase().includes("wolves")) ||
        (csvOffer.away.toLowerCase().includes("wolves") &&
          dbAway.toLowerCase().includes("wolverhampton"));

      const dateMatch =
        csvOffer.date === dbDate ||
        (csvOffer.date &&
          dbDate &&
          Math.abs(
            new Date(csvOffer.date).getTime() - new Date(dbDate).getTime()
          ) <=
            24 * 60 * 60 * 1000);

      return homeMatch && awayMatch && dateMatch;
    });

    if (matches.length === 0) {
      console.log("❌ No matching offers found in CSV");
    } else {
      console.log(`✅ Found ${matches.length} matching offer(s) in CSV:\n`);
      matches.forEach((match, idx) => {
        console.log(`Match ${idx + 1}:`);
        console.log(`  Home: ${match.home}`);
        console.log(`  Away: ${match.away}`);
        console.log(`  Date: ${match.date}`);
        console.log(`  URL: ${match.url}`);
        console.log(`  Price: ${match.price}`);
        console.log();
      });

      // Compare URLs
      const urlMatch = offer.url.match(/url=([^&]+)/);
      if (urlMatch) {
        const decodedDbUrl = decodeURIComponent(urlMatch[1]).toLowerCase();
        const csvUrl = matches[0].url.toLowerCase();
        
        console.log("URL Comparison:");
        console.log(`  DB URL: ${decodedDbUrl}`);
        console.log(`  CSV URL: ${csvUrl}`);
        
        if (decodedDbUrl !== csvUrl) {
          console.log("\n⚠️  URL MISMATCH!");
          console.log(`  DB has: ${decodedDbUrl}`);
          console.log(`  CSV has: ${csvUrl}`);
        } else {
          console.log("\n✅ URLs match!");
        }
      }
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




