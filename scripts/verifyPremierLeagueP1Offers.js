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
  "../data/p1/premier_league_matches_from_xml.json"
);
const AFFILIATE_REF = "1100l5y3LS";
const AFFILIATE_LINK = `https://p1travel.prf.hn/click/camref:${AFFILIATE_REF}`;

async function normalizeTeamName(name) {
  if (!name) return "";
  return name
    .replace(/\s*FC\s*$/i, "")
    .replace(/\s*United\s*$/i, "")
    .replace(/\s*City\s*$/i, "")
    .replace(/\s*Wanderers\s*$/i, "")
    .replace(/\s*Hotspur\s*$/i, "")
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

  // Try with FC added
  const withFC = `${teamName} FC`;
  team = await Team.findOne({
    $or: [
      { name_en: withFC },
      { name_en: new RegExp(`^${teamName}\\s*FC$`, "i") },
    ],
    leagueIds: leagueId,
  }).lean();

  if (team) return team;

  // Try without FC if it exists
  const withoutFC = teamName.replace(/\s*FC\s*$/i, "").trim();
  if (withoutFC !== teamName) {
    team = await Team.findOne({
      $or: [
        { name_en: withoutFC },
        { name_en: new RegExp(`^${withoutFC}$`, "i") },
      ],
      leagueIds: leagueId,
    }).lean();
  }

  if (team) return team;

  // Try partial match
  team = await Team.findOne({
    name_en: new RegExp(teamName.replace(/FC|United|City/g, "").trim(), "i"),
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

function isValidAffiliateURL(url, expectedURL) {
  if (!url) return false;

  // Check if URL contains affiliate link
  if (!url.includes(AFFILIATE_REF)) return false;
  if (!url.includes("/destination:")) return false;

  // Extract the destination URL from expected (remove creativeref if exists)
  let expectedDest = expectedURL;
  if (expectedURL.includes("/destination:")) {
    const parts = expectedURL.split("/destination:");
    if (parts.length > 1) {
      expectedDest = decodeURIComponent(parts[1]);
    }
  }

  // Decode actual URL
  const decoded = decodeURL(url);
  
  // Normalize both URLs (remove protocol, query params, etc.)
  const normalize = (u) => {
    return u
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "")
      .toLowerCase()
      .split("?")[0]; // Remove query params
  };

  const normalizedExpected = normalize(expectedDest);
  const normalizedDecoded = normalize(decoded);

  // Check if they match (allowing for small differences)
  return normalizedDecoded === normalizedExpected || 
         normalizedDecoded.includes(normalizedExpected) ||
         normalizedExpected.includes(normalizedDecoded);
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");

  try {
    // Load JSON file
    const jsonData = JSON.parse(fs.readFileSync(JSON_FILE, "utf-8"));
    const matches = jsonData.matches || [];
    console.log(`📖 Loaded ${matches.length} matches from JSON file\n`);

    // Find P1 supplier and Premier League
    const p1 = await Supplier.findOne({ slug: "p1-travel" }).lean();
    const premierLeague = await League.findOne({
      $or: [{ name: "Premier League" }, { slug: "premier-league" }],
    }).lean();

    if (!p1 || !premierLeague) {
      console.error("❌ P1 supplier or Premier League not found");
      return;
    }

    console.log(`🏆 League: ${premierLeague.name}`);
    console.log(`🏢 Supplier: ${p1.name}\n`);

    const results = {
      valid: [],
      missingOffer: [],
      wrongPrice: [],
      wrongURL: [],
      teamsNotFound: [],
    };

    console.log("=".repeat(80));
    console.log("Verifying P1 offers...");
    console.log("=".repeat(80));

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const homeTeamName = match.homeTeam;
      const awayTeamName = match.awayTeam;
      const date = match.date;
      const expectedPrice = match.minPrice;
      const expectedURL = match.url;

      // Find teams
      const homeTeam = await findTeam(homeTeamName, premierLeague._id);
      const awayTeam = await findTeam(awayTeamName, premierLeague._id);

      if (!homeTeam || !awayTeam) {
        results.teamsNotFound.push({
          match: `${homeTeamName} vs ${awayTeamName} (${date})`,
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
        premierLeague._id
      );

      if (!fixture) {
        results.missingOffer.push({
          match: `${homeTeamName} vs ${awayTeamName} (${date})`,
          reason: "Fixture not found",
        });
        continue;
      }

      // Find offer
      const offer = await Offer.findOne({
        ownerType: "Supplier",
        ownerId: p1._id,
        fixtureId: fixture._id,
      }).lean();

      if (!offer) {
        results.missingOffer.push({
          match: `${homeTeamName} vs ${awayTeamName} (${date})`,
          fixtureId: fixture._id.toString(),
          reason: "No P1 offer found",
        });
        continue;
      }

      // Check price (allow small difference due to currency conversion)
      const priceDiff = Math.abs(offer.price - expectedPrice);
      const priceTolerance = 5; // Allow 5 EUR difference

      if (priceDiff > priceTolerance && offer.price > expectedPrice) {
        results.wrongPrice.push({
          match: `${homeTeamName} vs ${awayTeamName} (${date})`,
          expectedPrice: expectedPrice,
          actualPrice: offer.price,
          currency: offer.currency,
          fixtureId: fixture._id.toString(),
        });
        continue;
      }

      // Check URL
      if (!isValidAffiliateURL(offer.url, expectedURL)) {
        results.wrongURL.push({
          match: `${homeTeamName} vs ${awayTeamName} (${date})`,
          expectedURL: expectedURL,
          actualURL: offer.url,
          fixtureId: fixture._id.toString(),
        });
        continue;
      }

      // Valid offer
      results.valid.push({
        match: `${homeTeamName} vs ${awayTeamName} (${date})`,
        price: offer.price,
        currency: offer.currency,
        fixtureId: fixture._id.toString(),
      });

      if ((i + 1) % 20 === 0) {
        console.log(`Processed ${i + 1}/${matches.length} matches...`);
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log("RESULTS:");
    console.log("=".repeat(80));
    console.log(`✅ Valid offers: ${results.valid.length}`);
    console.log(`❌ Missing offers: ${results.missingOffer.length}`);
    console.log(`⚠️  Wrong price: ${results.wrongPrice.length}`);
    console.log(`⚠️  Wrong URL: ${results.wrongURL.length}`);
    console.log(`⚠️  Teams not found: ${results.teamsNotFound.length}\n`);

    // Save results
    const outputFile = path.join(
      __dirname,
      "../data/p1/premier_league_offers_verification.json"
    );
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`💾 Results saved to: ${outputFile}\n`);

    // Show details
    if (results.missingOffer.length > 0) {
      console.log("=".repeat(80));
      console.log("Missing offers:");
      console.log("=".repeat(80));
      results.missingOffer.slice(0, 10).forEach((m, i) => {
        console.log(`${i + 1}. ${m.match} - ${m.reason}`);
      });
      if (results.missingOffer.length > 10) {
        console.log(`\n... and ${results.missingOffer.length - 10} more`);
      }
    }

    if (results.wrongPrice.length > 0) {
      console.log("\n" + "=".repeat(80));
      console.log("Wrong price:");
      console.log("=".repeat(80));
      results.wrongPrice.slice(0, 10).forEach((m, i) => {
        console.log(
          `${i + 1}. ${m.match}\n   Expected: ${m.expectedPrice}, Actual: ${m.actualPrice} ${m.currency}`
        );
      });
      if (results.wrongPrice.length > 10) {
        console.log(`\n... and ${results.wrongPrice.length - 10} more`);
      }
    }

    if (results.wrongURL.length > 0) {
      console.log("\n" + "=".repeat(80));
      console.log("Wrong URL:");
      console.log("=".repeat(80));
      results.wrongURL.slice(0, 5).forEach((m, i) => {
        console.log(`${i + 1}. ${m.match}`);
        console.log(`   Expected: ${m.expectedURL.substring(0, 80)}...`);
        console.log(`   Actual: ${m.actualURL.substring(0, 80)}...`);
      });
      if (results.wrongURL.length > 5) {
        console.log(`\n... and ${results.wrongURL.length - 5} more`);
      }
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

