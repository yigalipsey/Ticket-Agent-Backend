import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import FootballEvent from "../src/models/FootballEvent.js";
import Supplier from "../src/models/Supplier.js";
import Team from "../src/models/Team.js";
import League from "../src/models/League.js";
import Offer from "../src/models/Offer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPPLIER_SLUG = "p1-travel";
const LEAGUE_NAME = "Premier League";
const AFFILIATE_LINK = "https://p1travel.prf.hn/click/camref:1100l5y3LS";

// Mapping of P1 team names to our team names (if needed)
const TEAM_NAME_MAPPING = {
  "Aston Villa FC": "Aston Villa",
  "Bournemouth FC": "Bournemouth",
  "Brighton & Hove Albion": "Brighton",
  "Burnley FC": "Burnley",
  "Fulham FC": "Fulham",
  "Leeds United": "Leeds",
  "Manchester City": "Man City",
  "Manchester United": "Man United",
  "Newcastle United": "Newcastle",
  "Nottingham Forest": "Nottm Forest",
  "Tottenham Hotspur": "Tottenham",
  "West Ham United": "West Ham",
  "Wolverhampton Wanderers FC": "Wolves",
};

/**
 * Find team by P1 name
 */
async function findTeamByP1Name(p1Name, p1SupplierId) {
  // First, try to find by supplier mapping
  let team = await Team.findOne({
    "suppliersInfo.supplierRef": p1SupplierId,
    "suppliersInfo.supplierTeamName": p1Name,
  });

  if (team) {
    return team;
  }

  // Try exact match with name_en
  team = await Team.findOne({
    $or: [{ name_en: p1Name }, { name: p1Name }],
  });

  if (team) {
    return team;
  }

  // Try with mapping
  const mappedName = TEAM_NAME_MAPPING[p1Name];
  if (mappedName) {
    team = await Team.findOne({
      $or: [{ name_en: mappedName }, { name: mappedName }],
    });
  }

  if (team) {
    return team;
  }

  // Try partial match (e.g., "Arsenal" in "Arsenal FC")
  const cleanName = p1Name
    .replace(/\s*(FC|United|City|Hotspur|Wanderers|Albion)$/i, "")
    .trim();
  team = await Team.findOne({
    $or: [
      { name_en: new RegExp(`^${cleanName}$`, "i") },
      { name: new RegExp(`^${cleanName}$`, "i") },
    ],
  });

  return team;
}

/**
 * Find fixture by teams and date
 */
async function findFixture(homeTeamId, awayTeamId, dateString, leagueId) {
  // Parse date - P1 uses YYYY-MM-DD format
  const matchDate = new Date(dateString + "T00:00:00Z");

  // Search for fixture within a 3-day range (in case of timezone issues)
  // This covers cases where P1 date might be different from DB date due to timezone
  const startDate = new Date(matchDate);
  startDate.setDate(startDate.getDate() - 1); // 1 day before
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(matchDate);
  endDate.setDate(endDate.getDate() + 2); // 2 days after
  endDate.setHours(23, 59, 59, 999);

  const fixture = await FootballEvent.findOne({
    league: leagueId,
    homeTeam: homeTeamId,
    awayTeam: awayTeamId,
    date: {
      $gte: startDate,
      $lte: endDate,
    },
  });

  return fixture;
}

async function run() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined");
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");

  try {
    // 1. Find P1 supplier
    const supplier = await Supplier.findOne({ slug: SUPPLIER_SLUG });
    if (!supplier) {
      throw new Error(
        `Supplier "${SUPPLIER_SLUG}" not found. Please run: npm run create-p1-supplier`
      );
    }
    console.log(`✅ Found supplier: ${supplier.name} (${supplier._id})\n`);

    // 2. Find Premier League
    const league = await League.findOne({ name: LEAGUE_NAME });
    if (!league) {
      throw new Error(`League "${LEAGUE_NAME}" not found`);
    }
    console.log(`✅ Found league: ${league.name} (${league._id})\n`);

    // 3. Load P1 matches JSON
    const jsonFilePath = path.join(
      __dirname,
      "../data/p1/premier_league_matches.json"
    );
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, "utf-8"));
    const matches = jsonData.matches || [];

    console.log(`📊 Loaded ${matches.length} P1 Premier League matches\n`);

    let stats = {
      totalMatches: matches.length,
      offersCreated: 0,
      offersUpdated: 0,
      skippedNoTeam: 0,
      skippedNoFixture: 0,
      skippedNoPrice: 0,
      errors: 0,
    };

    // 4. Process each match
    for (const match of matches) {
      try {
        const {
          home_team_name,
          away_team_name,
          date_start,
          min_price,
          min_price_offer,
        } = match;

        // Validate price
        if (!min_price || min_price <= 0) {
          stats.skippedNoPrice++;
          console.log(
            `⚠️  Skipping ${home_team_name} vs ${away_team_name}: No valid price`
          );
          continue;
        }

        // Find teams
        const homeTeam = await findTeamByP1Name(home_team_name, supplier._id);
        const awayTeam = await findTeamByP1Name(away_team_name, supplier._id);

        if (!homeTeam) {
          stats.skippedNoTeam++;
          console.log(
            `⚠️  Skipping ${home_team_name} vs ${away_team_name}: Home team not found`
          );
          continue;
        }

        if (!awayTeam) {
          stats.skippedNoTeam++;
          console.log(
            `⚠️  Skipping ${home_team_name} vs ${away_team_name}: Away team not found`
          );
          continue;
        }

        // Find fixture
        const fixture = await findFixture(
          homeTeam._id,
          awayTeam._id,
          date_start,
          league._id
        );

        if (!fixture) {
          stats.skippedNoFixture++;
          console.log(
            `⚠️  Skipping ${home_team_name} vs ${away_team_name} (${date_start}): Fixture not found`
          );
          continue;
        }

        // Get URL and other details from offer
        let url = min_price_offer?.productURL || "";

        // Convert P1 Travel URL to affiliate link
        if (url && url.includes("p1travel.com")) {
          try {
            // Build affiliate URL with destination: format (Awin/TradeDoubler format)
            url = `${AFFILIATE_LINK}/destination:${url}`;
          } catch (e) {
            // If URL parsing fails, use original URL
            console.warn(`Warning: Could not parse URL: ${url}`);
          }
        }

        const description = min_price_offer?.description || "";

        // Determine if hospitality based on description or seating plan
        const isHospitality =
          description.toLowerCase().includes("hospitality") ||
          description.toLowerCase().includes("lounge") ||
          (min_price_offer?.seating_plan || "")
            .toLowerCase()
            .includes("lounge");

        // Check if offer already exists
        const existingOffer = await Offer.findOne({
          fixtureId: fixture._id,
          ownerType: "Supplier",
          ownerId: supplier._id,
        });

        if (existingOffer) {
          // Update existing offer if price or URL changed
          const needsUpdate =
            existingOffer.price !== min_price ||
            existingOffer.currency !== "GBP" ||
            existingOffer.url !== url ||
            existingOffer.isHospitality !== isHospitality;

          if (needsUpdate) {
            await Offer.findByIdAndUpdate(existingOffer._id, {
              $set: {
                price: min_price,
                currency: "GBP",
                url: url,
                isHospitality: isHospitality,
                notes: description.substring(0, 300),
                isAvailable: true,
              },
            });
            stats.offersUpdated++;
            console.log(
              `✅ Updated offer for ${
                fixture.slug
              }: £${min_price} - ${url.substring(0, 60)}...`
            );
          }
        } else {
          // Create new offer
          const newOffer = new Offer({
            fixtureId: fixture._id,
            ownerType: "Supplier",
            ownerId: supplier._id,
            price: min_price,
            currency: "GBP",
            ticketType: isHospitality ? "vip" : "standard",
            isHospitality: isHospitality,
            isAvailable: true,
            url: url,
            notes: description.substring(0, 300),
          });

          await newOffer.save();
          stats.offersCreated++;
          console.log(
            `✅ Created offer for ${
              fixture.slug
            }: £${min_price} - ${url.substring(0, 60)}...`
          );
        }
      } catch (error) {
        stats.errors++;
        console.error(
          `❌ Error processing match ${match.home_team_name} vs ${match.away_team_name}:`,
          error.message
        );
      }
    }

    // 5. Print summary
    console.log(`\n📊 ${LEAGUE_NAME} P1 Offers Summary`);
    console.log("=".repeat(50));
    console.log(`Total matches in JSON: ${stats.totalMatches}`);
    console.log(`Offers created: ${stats.offersCreated}`);
    console.log(`Offers updated: ${stats.offersUpdated}`);
    console.log(`Skipped (team not found): ${stats.skippedNoTeam}`);
    console.log(`Skipped (fixture not found): ${stats.skippedNoFixture}`);
    console.log(`Skipped (no price): ${stats.skippedNoPrice}`);
    console.log(`Errors: ${stats.errors}`);
    console.log(
      `\n✅ Successfully processed: ${
        stats.offersCreated + stats.offersUpdated
      } offers`
    );
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
}

run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
