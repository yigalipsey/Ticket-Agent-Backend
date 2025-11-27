import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import FootballEvent from "../src/models/FootballEvent.js";
import Supplier from "../src/models/Supplier.js";
import Team from "../src/models/Team.js";
import League from "../src/models/League.js";
import Offer from "../src/models/Offer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPPLIER_SLUG = "p1-travel";
const LEAGUE_NAME = "Champions League";
const CSV_FILE = path.join(__dirname, "../data/p1-offers.csv");
const AFFILIATE_LINK = "https://p1travel.prf.hn/click/camref:1100l5y3LS";

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

  // Try partial match (e.g., "Arsenal" in "Arsenal FC")
  const cleanName = p1Name
    .replace(/\s*(FC|CF|United|City|Hotspur|Wanderers|Albion)$/i, "")
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

/**
 * Extract seating plan from extraInfo
 */
function extractSeatingPlan(extraInfo) {
  if (!extraInfo) return "";
  const match = extraInfo.match(/Seating plan:\s*([^|]+)/i);
  return match ? match[1].trim() : "";
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

    // 2. Find Champions League
    const league = await League.findOne({
      $or: [
        { name: LEAGUE_NAME },
        { slug: "champions-league" },
        { name: /champions league/i },
      ],
    });
    if (!league) {
      throw new Error(`League "${LEAGUE_NAME}" not found`);
    }
    console.log(`✅ Found league: ${league.name} (${league._id})\n`);

    // 3. Load and parse CSV
    console.log("Loading CSV file...");
    const csvContent = fs.readFileSync(CSV_FILE, "utf-8");
    const csvRecords = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      trim: true,
    });
    console.log(`✅ Loaded ${csvRecords.length} records from CSV\n`);

    // 4. Filter Champions League matches
    const clRecords = csvRecords.filter((r) => {
      const categoryPath = (r.categoryPath || "").toLowerCase();
      return categoryPath.includes("champions league 2025-2026");
    });

    console.log(
      `📊 Found ${clRecords.length} Champions League records in CSV\n`
    );

    // 5. Group by match and find minimum price
    const matchMap = new Map();

    clRecords.forEach((record) => {
      const homeTeam = record.home_team_name || "";
      const awayTeam = record.away_team_name || "";
      const dateStart = record.date_start || "";
      const price = parseFloat(record.price) || 0;
      const priceTicketHotel = parseFloat(record.price_ticket_hotel) || 0;

      if (!homeTeam || !awayTeam || !dateStart) {
        return;
      }

      // Create a unique key for each match
      const matchKey = `${homeTeam}|${awayTeam}|${dateStart}`;

      // Use price_ticket_hotel if available, otherwise use price
      const effectivePrice = priceTicketHotel > 0 ? priceTicketHotel : price;

      if (effectivePrice <= 0) {
        return;
      }

      if (!matchMap.has(matchKey)) {
        matchMap.set(matchKey, {
          home_team_name: homeTeam,
          away_team_name: awayTeam,
          date_start: dateStart,
          min_price: effectivePrice,
          min_price_offer: {
            id: record.id || "",
            name: record.name || "",
            price: price,
            price_ticket_hotel: priceTicketHotel,
            productURL: record.productURL || "",
            description: record.description || "",
            seating_plan: extractSeatingPlan(record.extraInfo),
            home_shirt_image_link: record.home_shirt_image_link || "",
            away_shirt_image_link: record.away_shirt_image_link || "",
          },
        });
      } else {
        const existingMatch = matchMap.get(matchKey);
        if (effectivePrice < existingMatch.min_price) {
          existingMatch.min_price = effectivePrice;
          existingMatch.min_price_offer = {
            id: record.id || "",
            name: record.name || "",
            price: price,
            price_ticket_hotel: priceTicketHotel,
            productURL: record.productURL || "",
            description: record.description || "",
            seating_plan: extractSeatingPlan(record.extraInfo),
            home_shirt_image_link: record.home_shirt_image_link || "",
            away_shirt_image_link: record.away_shirt_image_link || "",
          };
        }
      }
    });

    const matches = Array.from(matchMap.values());
    console.log(
      `📊 Found ${matches.length} unique Champions League matches with offers\n`
    );

    let stats = {
      totalMatches: matches.length,
      offersCreated: 0,
      offersUpdated: 0,
      skippedNoTeam: 0,
      skippedNoFixture: 0,
      skippedNoPrice: 0,
      errors: 0,
    };

    // 6. Process each match
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
            `⚠️  Skipping ${home_team_name} vs ${away_team_name}: Home team "${home_team_name}" not found`
          );
          continue;
        }

        if (!awayTeam) {
          stats.skippedNoTeam++;
          console.log(
            `⚠️  Skipping ${home_team_name} vs ${away_team_name}: Away team "${away_team_name}" not found`
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

        // Determine currency (Champions League is usually EUR)
        const currency = "EUR";

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
            existingOffer.currency !== currency ||
            existingOffer.url !== url ||
            existingOffer.isHospitality !== isHospitality;

          if (needsUpdate) {
            await Offer.findByIdAndUpdate(existingOffer._id, {
              $set: {
                price: min_price,
                currency: currency,
                url: url,
                isHospitality: isHospitality,
                notes: description.substring(0, 300),
                isAvailable: true,
              },
            });
            stats.offersUpdated++;
            console.log(
              `✅ Updated offer for ${fixture.slug}: €${min_price} - ${url.substring(0, 60)}...`
            );
          }
        } else {
          // Create new offer
          const newOffer = new Offer({
            fixtureId: fixture._id,
            ownerType: "Supplier",
            ownerId: supplier._id,
            price: min_price,
            currency: currency,
            ticketType: isHospitality ? "vip" : "standard",
            isHospitality: isHospitality,
            isAvailable: true,
            url: url,
            notes: description.substring(0, 300),
          });

          await newOffer.save();
          stats.offersCreated++;
          console.log(
            `✅ Created offer for ${fixture.slug}: €${min_price} - ${url.substring(0, 60)}...`
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

    // 7. Print summary
    console.log(`\n📊 ${LEAGUE_NAME} P1 Offers Summary`);
    console.log("=".repeat(50));
    console.log(`Total matches in CSV: ${stats.totalMatches}`);
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

