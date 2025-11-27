import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import FootballEvent from "../src/models/FootballEvent.js";
import Team from "../src/models/Team.js";
import League from "../src/models/League.js";
import Offer from "../src/models/Offer.js";
import Supplier from "../src/models/Supplier.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JSON_FILE = path.join(
  __dirname,
  "../data/p1/bundesliga_matches_from_xml.json"
);

async function normalizeTeamName(name) {
  if (!name) return "";
  return name
    .replace(/\s*FC\s*$/i, "")
    .replace(/\s*04\s*/g, "")
    .replace(/\s*TSG\s*/g, "")
    .replace(/\s*1899\s*/g, "")
    .replace(/\s*1846\s*/g, "")
    .replace(/\s*1\.\s*FSV\s*/g, "")
    .replace(/\s*05\s*$/g, "")
    .trim();
}

async function findTeam(teamName, leagueId) {
  if (!teamName) return null;

  // Try exact match first
  let team = await Team.findOne({
    $or: [
      { name_en: teamName },
      { "suppliersInfo.supplierTeamName": teamName },
    ],
    leagueIds: leagueId,
  }).lean();

  if (team) return team;

  // Try normalized name
  const normalized = await normalizeTeamName(teamName);
  if (normalized && normalized !== teamName) {
    team = await Team.findOne({
      $or: [
        { name_en: new RegExp(`^${normalized}$`, "i") },
        { name_en: new RegExp(normalized, "i") },
      ],
      leagueIds: leagueId,
    }).lean();
  }

  if (team) return team;

  // Try partial match
  team = await Team.findOne({
    name_en: new RegExp(
      teamName.replace(/FC|04|TSG|1899|1846|1\.\s*FSV|05/g, "").trim(),
      "i"
    ),
    leagueIds: leagueId,
  }).lean();

  return team;
}

async function findFixture(homeTeam, awayTeam, date, leagueId) {
  const matchDate = new Date(date + "T00:00:00Z");
  const startDate = new Date(matchDate);
  startDate.setDate(startDate.getDate() - 3);
  const endDate = new Date(matchDate);
  endDate.setDate(endDate.getDate() + 3);

  // Try normal order
  let fixture = await FootballEvent.findOne({
    league: leagueId,
    homeTeam: homeTeam._id,
    awayTeam: awayTeam._id,
    date: { $gte: startDate, $lte: endDate },
  }).lean();

  if (fixture) return fixture;

  // Try reversed order
  fixture = await FootballEvent.findOne({
    league: leagueId,
    homeTeam: awayTeam._id,
    awayTeam: homeTeam._id,
    date: { $gte: startDate, $lte: endDate },
  }).lean();

  return fixture;
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");

  try {
    // Load JSON file
    const jsonData = JSON.parse(fs.readFileSync(JSON_FILE, "utf-8"));
    const matches = jsonData.matches || [];
    console.log(`📖 Loaded ${matches.length} matches from JSON file\n`);

    // Find P1 supplier and Bundesliga
    const p1 = await Supplier.findOne({ slug: "p1-travel" });
    const bundesliga = await League.findOne({
      $or: [
        { name: /bundesliga/i },
        { slug: "bundesliga" },
        { name: /german/i },
      ],
    });

    if (!p1 || !bundesliga) {
      console.error("❌ P1 supplier or Bundesliga not found");
      return;
    }

    console.log(`🏆 League: ${bundesliga.name}`);
    console.log(`🏢 Supplier: ${p1.name}\n`);

    const results = {
      updated: [],
      notFound: [],
      alreadyCorrect: [],
    };

    console.log("=".repeat(80));
    console.log("Updating prices...");
    console.log("=".repeat(80));

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const homeTeamName = match.homeTeam;
      const awayTeamName = match.awayTeam;
      const date = match.date;
      const xmlPrice = match.minPrice; // Price from XML (EUR)

      // Find teams
      const homeTeam = await findTeam(homeTeamName, bundesliga._id);
      const awayTeam = await findTeam(awayTeamName, bundesliga._id);

      if (!homeTeam || !awayTeam) {
        results.notFound.push({
          match: `${homeTeamName} vs ${awayTeamName} (${date})`,
          reason: "Teams not found",
          missingHome: !homeTeam ? homeTeamName : null,
          missingAway: !awayTeam ? awayTeamName : null,
        });
        continue;
      }

      // Find fixture
      const fixture = await findFixture(
        homeTeam,
        awayTeam,
        date,
        bundesliga._id
      );

      if (!fixture) {
        results.notFound.push({
          match: `${homeTeamName} vs ${awayTeamName} (${date})`,
          reason: "Fixture not found",
          homeTeamDB: homeTeam.name_en,
          awayTeamDB: awayTeam.name_en,
        });
        continue;
      }

      // Find offer
      const offer = await Offer.findOne({
        ownerType: "Supplier",
        ownerId: p1._id,
        fixtureId: fixture._id,
      });

      if (!offer) {
        results.notFound.push({
          match: `${homeTeamName} vs ${awayTeamName} (${date})`,
          reason: "Offer not found",
          fixtureId: fixture._id.toString(),
        });
        continue;
      }

      // Check if price needs update
      const currentPrice = offer.price;
      const currentCurrency = offer.currency;

      // If price is already correct (within 1 EUR tolerance) and currency is EUR, skip
      if (currentCurrency === "EUR" && Math.abs(currentPrice - xmlPrice) <= 1) {
        results.alreadyCorrect.push({
          match: `${homeTeamName} vs ${awayTeamName} (${date})`,
          price: currentPrice,
          currency: currentCurrency,
        });
        continue;
      }

      // Update price
      offer.price = xmlPrice;
      offer.currency = "EUR";
      await offer.save();

      results.updated.push({
        match: `${homeTeamName} vs ${awayTeamName} (${date})`,
        oldPrice: currentPrice,
        oldCurrency: currentCurrency,
        newPrice: xmlPrice,
        newCurrency: "EUR",
        fixtureId: fixture._id.toString(),
      });

      if ((i + 1) % 10 === 0) {
        console.log(`Processed ${i + 1}/${matches.length} matches...`);
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log("RESULTS:");
    console.log("=".repeat(80));
    console.log(`✅ Updated: ${results.updated.length}`);
    console.log(`✓ Already correct: ${results.alreadyCorrect.length}`);
    console.log(`❌ Not found: ${results.notFound.length}\n`);

    // Save results
    const outputFile = path.join(
      __dirname,
      "../data/p1/bundesliga_price_updates.json"
    );
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`💾 Results saved to: ${outputFile}\n`);

    // Show sample of updates
    if (results.updated.length > 0) {
      console.log("=".repeat(80));
      console.log("Sample of updated prices:");
      console.log("=".repeat(80));
      results.updated.slice(0, 10).forEach((u, i) => {
        console.log(
          `${i + 1}. ${u.match}\n   ${u.oldPrice} ${u.oldCurrency} → ${
            u.newPrice
          } ${u.newCurrency}`
        );
      });
      if (results.updated.length > 10) {
        console.log(`\n... and ${results.updated.length - 10} more`);
      }
    }

    if (results.notFound.length > 0) {
      console.log("\n" + "=".repeat(80));
      console.log("Not found:");
      console.log("=".repeat(80));
      results.notFound.forEach((n, i) => {
        console.log(`${i + 1}. ${n.match} - ${n.reason}`);
        if (n.missingHome || n.missingAway) {
          console.log(
            `   Missing: ${n.missingHome || ""} ${n.missingAway || ""}`
          );
        }
        if (n.homeTeamDB) {
          console.log(`   DB Teams: ${n.homeTeamDB} vs ${n.awayTeamDB}`);
        }
      });
    }
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


