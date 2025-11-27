import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import { parseString } from "xml2js";
import Offer from "../src/models/Offer.js";
import Supplier from "../src/models/Supplier.js";
import FootballEvent from "../src/models/FootballEvent.js";
import Team from "../src/models/Team.js";
import League from "../src/models/League.js";

const XML_FILE = "data/p1/36e68b7b500770cf7b8b7379ce094fca.xml_331398.tmp";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");

  try {
    const p1 = await Supplier.findOne({ slug: "p1-travel" });
    if (!p1) {
      throw new Error("P1 Travel supplier not found");
    }

    console.log("Reading XML file...");
    const xmlData = fs.readFileSync(XML_FILE, "utf-8");

    console.log("Parsing XML...");
    const parsedXml = await new Promise((resolve, reject) => {
      parseString(xmlData, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    // Extract products from XML
    const products = parsedXml.products?.product || [];
    console.log(`Found ${products.length} products in XML\n`);

    // Filter for football products
    const footballProducts = products.filter((product) => {
      const categoryPath =
        product.categoryPath?.[0] || product.categorypath?.[0] || "";
      return categoryPath.toLowerCase().includes("football");
    });

    console.log(`Found ${footballProducts.length} football products\n`);

    // Group by league
    const byLeague = new Map();

    footballProducts.forEach((product) => {
      const categoryPath =
        product.categoryPath?.[0] || product.categorypath?.[0] || "";
      const name = product.name?.[0] || "";
      const homeTeam = product.home_team_name?.[0] || "";
      const awayTeam = product.away_team_name?.[0] || "";
      const date = product.date_start?.[0] || "";
      const url = product.productURL?.[0] || product.producturl?.[0] || "";
      const price = product.price?.[0] || "";

      // Extract league from categoryPath
      let league = "";
      if (categoryPath.includes("Premier League")) {
        league = "Premier League";
      } else if (categoryPath.includes("Bundesliga")) {
        league = "Bundesliga";
      } else if (categoryPath.includes("Serie A") || categoryPath.includes("serie a")) {
        league = "Serie A";
      } else if (categoryPath.includes("La Liga") || categoryPath.includes("la liga")) {
        league = "La Liga";
      } else if (categoryPath.includes("Ligue 1") || categoryPath.includes("ligue 1")) {
        league = "Ligue 1";
      } else if (categoryPath.includes("Champions League")) {
        league = "Champions League";
      } else if (categoryPath.includes("Europa League")) {
        league = "Europa League";
      } else if (categoryPath.includes("Eredivisie")) {
        league = "Eredivisie";
      } else if (categoryPath.includes("Primeira Liga")) {
        league = "Primeira Liga";
      } else {
        // Try to extract league name from categoryPath
        const parts = categoryPath.split(">");
        for (const part of parts) {
          const trimmed = part.trim().toLowerCase();
          if (
            trimmed.includes("league") ||
            trimmed.includes("liga") ||
            trimmed.includes("premier") ||
            trimmed.includes("bundesliga") ||
            trimmed.includes("serie") ||
            trimmed.includes("champions")
          ) {
            league = part.trim();
            break;
          }
        }
      }

      if (!league) {
        league = "Other";
      }

      if (!byLeague.has(league)) {
        byLeague.set(league, []);
      }

      byLeague.get(league).push({
        name,
        homeTeam,
        awayTeam,
        date,
        url,
        price,
        categoryPath,
      });
    }

    // Get all existing P1 offers with fixtures
    const existingOffers = await Offer.find({
      ownerType: "Supplier",
      ownerId: p1._id,
    })
      .populate("fixtureId", "slug homeTeam awayTeam date league")
      .lean();

    console.log(`Found ${existingOffers.length} existing P1 offers\n`);

    // Create a set of existing matches (by league, teams, and date)
    const existingMatches = new Set();
    existingOffers.forEach((offer) => {
      if (offer.fixtureId) {
        const fixture = offer.fixtureId;
        const matchKey = `${fixture.league?.toString() || "unknown"}-${fixture.homeTeam?.toString() || "unknown"}-${fixture.awayTeam?.toString() || "unknown"}-${new Date(fixture.date).toISOString().split("T")[0]}`;
        existingMatches.add(matchKey);
      }
    });

    // Find missing matches by league
    console.log("=".repeat(80));
    console.log("Analyzing missing offers by league...");
    console.log("=".repeat(80));

    const missingByLeague = new Map();

    for (const [league, products] of byLeague.entries()) {
      const missing = [];

      for (const product of products) {
        // Try to find if this match exists in DB
        if (!product.homeTeam || !product.awayTeam || !product.date) {
          continue;
        }

        // Find teams in DB
        const homeTeam = await Team.findOne({
          $or: [
            { name_en: new RegExp(product.homeTeam, "i") },
            { "suppliersInfo.supplierTeamName": product.homeTeam },
          ],
        }).lean();

        const awayTeam = await Team.findOne({
          $or: [
            { name_en: new RegExp(product.awayTeam, "i") },
            { "suppliersInfo.supplierTeamName": product.awayTeam },
          ],
        }).lean();

        if (!homeTeam || !awayTeam) {
          continue;
        }

        // Find league
        const leagueDoc = await League.findOne({
          $or: [
            { name: league },
            { slug: league.toLowerCase().replace(/\s+/g, "-") },
            { name: new RegExp(league, "i") },
          ],
        }).lean();

        if (!leagueDoc) {
          continue;
        }

        // Check if fixture exists
        const matchDate = new Date(product.date + "T00:00:00Z");
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
            homeTeam: product.homeTeam,
            awayTeam: product.awayTeam,
            date: product.date,
            price: product.price,
            url: product.url,
          });
        } else {
          // Check if offer exists
          const offerExists = existingOffers.some((o) => {
            return o.fixtureId && o.fixtureId._id.toString() === fixture._id.toString();
          });

          if (!offerExists) {
            missing.push({
              homeTeam: product.homeTeam,
              awayTeam: product.awayTeam,
              date: product.date,
              price: product.price,
              url: product.url,
              fixtureId: fixture._id.toString(),
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
    console.log("📊 Missing Offers by League");
    console.log("=".repeat(80));

    let totalMissing = 0;
    for (const [league, missing] of missingByLeague.entries()) {
      console.log(`\n${league}: ${missing.length} missing offers`);
      totalMissing += missing.length;

      // Show first 5 examples
      missing.slice(0, 5).forEach((m, idx) => {
        console.log(
          `  ${idx + 1}. ${m.homeTeam} vs ${m.awayTeam} (${m.date}) - ${m.price} EUR`
        );
      });
      if (missing.length > 5) {
        console.log(`  ... and ${missing.length - 5} more`);
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log(`Total missing offers: ${totalMissing}`);
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

