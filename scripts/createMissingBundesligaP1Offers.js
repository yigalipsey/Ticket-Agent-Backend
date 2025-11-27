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
const AFFILIATE_REF = "1100l5y3LS";
const AFFILIATE_LINK = `https://p1travel.prf.hn/click/camref:${AFFILIATE_REF}`;

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
    name_en: new RegExp(teamName.replace(/FC|04|TSG|1899|1846|1\.\s*FSV|05/g, "").trim(), "i"),
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

function decodeURL(url) {
  try {
    if (url.includes("/destination:")) {
      const parts = url.split("/destination:");
      if (parts.length > 1) {
        return decodeURIComponent(parts[1]);
      }
    }
    return url;
  } catch (e) {
    return url;
  }
}

function buildAffiliateURL(originalURL) {
  // Remove existing affiliate parameters if any
  const cleanURL = originalURL.split("?")[0];
  return `${AFFILIATE_LINK}/destination:${encodeURIComponent(cleanURL)}`;
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

    // Load missing matches from price updates
    const priceUpdatesFile = path.join(
      __dirname,
      "../data/p1/bundesliga_price_updates.json"
    );
    const priceUpdates = JSON.parse(fs.readFileSync(priceUpdatesFile, "utf-8"));
    const missingMatches = priceUpdates.notFound || [];

    console.log(`🔍 Found ${missingMatches.length} missing matches\n`);

    const results = {
      created: [],
      notFound: [],
    };

    console.log("=".repeat(80));
    console.log("Creating missing offers...");
    console.log("=".repeat(80));

    for (const missingMatch of missingMatches) {
      // Find the match in the XML data
      const xmlMatch = matches.find((m) => {
        const matchKey = `${m.homeTeam}|${m.awayTeam}|${m.date}`;
        const missingKey = missingMatch.match.match(/(.+?)\s+vs\s+(.+?)\s+\((.+?)\)/);
        if (!missingKey) return false;
        return (
          m.homeTeam === missingKey[1] &&
          m.awayTeam === missingKey[2] &&
          m.date === missingKey[3]
        );
      });

      if (!xmlMatch) {
        console.log(`⚠️  Could not find XML data for: ${missingMatch.match}`);
        results.notFound.push({
          match: missingMatch.match,
          reason: "Not found in XML data",
        });
        continue;
      }

      const homeTeamName = xmlMatch.homeTeam;
      const awayTeamName = xmlMatch.awayTeam;
      const date = xmlMatch.date;
      const xmlPrice = xmlMatch.minPrice;
      const xmlURL = xmlMatch.url;

      // Find teams
      const homeTeam = await findTeam(homeTeamName, bundesliga._id);
      const awayTeam = await findTeam(awayTeamName, bundesliga._id);

      if (!homeTeam || !awayTeam) {
        console.log(`⚠️  Teams not found for: ${missingMatch.match}`);
        results.notFound.push({
          match: missingMatch.match,
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
        console.log(`⚠️  Fixture not found for: ${missingMatch.match}`);
        results.notFound.push({
          match: missingMatch.match,
          reason: "Fixture not found in DB",
          homeTeamDB: homeTeam.name_en,
          awayTeamDB: awayTeam.name_en,
        });
        continue;
      }

      // Check if offer already exists
      const existingOffer = await Offer.findOne({
        ownerType: "Supplier",
        ownerId: p1._id,
        fixtureId: fixture._id,
      });

      if (existingOffer) {
        console.log(`✓ Offer already exists for: ${missingMatch.match}`);
        continue;
      }

      // Build affiliate URL
      const affiliateURL = buildAffiliateURL(xmlURL);

      // Determine if hospitality (check description or price threshold)
      const isHospitality = xmlMatch.productName?.toLowerCase().includes("hospitality") ||
                           xmlPrice > 300; // High price might indicate hospitality

      // Create offer
      const offer = new Offer({
        fixtureId: fixture._id,
        ownerType: "Supplier",
        ownerId: p1._id,
        price: xmlPrice,
        currency: "EUR",
        url: affiliateURL,
        isHospitality: isHospitality,
      });

      await offer.save();

      results.created.push({
        match: `${homeTeamName} vs ${awayTeamName} (${date})`,
        fixtureId: fixture._id.toString(),
        price: xmlPrice,
        currency: "EUR",
        url: affiliateURL,
      });

      console.log(`✅ Created offer: ${homeTeamName} vs ${awayTeamName} (${date}) - ${xmlPrice} EUR`);
    }

    console.log("\n" + "=".repeat(80));
    console.log("RESULTS:");
    console.log("=".repeat(80));
    console.log(`✅ Created: ${results.created.length}`);
    console.log(`❌ Not found: ${results.notFound.length}\n`);

    // Save results
    const outputFile = path.join(
      __dirname,
      "../data/p1/bundesliga_missing_offers_created.json"
    );
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`💾 Results saved to: ${outputFile}\n`);

    if (results.created.length > 0) {
      console.log("=".repeat(80));
      console.log("Created offers:");
      console.log("=".repeat(80));
      results.created.forEach((c, i) => {
        console.log(`${i + 1}. ${c.match} - ${c.price} ${c.currency}`);
      });
    }

    if (results.notFound.length > 0) {
      console.log("\n" + "=".repeat(80));
      console.log("Not found:");
      console.log("=".repeat(80));
      results.notFound.forEach((n, i) => {
        console.log(`${i + 1}. ${n.match} - ${n.reason}`);
        if (n.missingHome || n.missingAway) {
          console.log(`   Missing: ${n.missingHome || ""} ${n.missingAway || ""}`);
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



