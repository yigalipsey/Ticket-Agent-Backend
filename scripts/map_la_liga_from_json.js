import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import FootballEvent from "../src/models/FootballEvent.js";
import Supplier from "../src/models/Supplier.js";
import Offer from "../src/models/Offer.js";
import League from "../src/models/League.js";
import Team from "../src/models/Team.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const LEAGUE_SLUG = "laliga";
const LEAGUE_NAME = "La Liga";
const SUPPLIER_SLUG = "hellotickets";
const AFFILIATE_PARAMS = "?tap_a=141252-18675a&tap_s=8995852-00a564";

// Paths
const MATCHES_FILE = path.resolve(
  __dirname,
  "../../data/leagues/la_liga_hellotickets_raw.json"
);

function addAffiliateLink(originalUrl) {
  if (!originalUrl) return null;
  const separator = originalUrl.includes("?") ? "&" : "?";
  return `${originalUrl}${separator}${AFFILIATE_PARAMS.substring(1)}`;
}

async function connectDB() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined in .env");
  }
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
  });
  console.log("✅ Connected to MongoDB\n");
}

function loadMatches() {
  if (!fs.existsSync(MATCHES_FILE)) {
    throw new Error(`Matches file not found: ${MATCHES_FILE}`);
  }
  const data = JSON.parse(fs.readFileSync(MATCHES_FILE, "utf8"));
  return data.api_response?.performances || [];
}

async function mapAndUpdateMatches() {
  try {
    console.log("================================================================================");
    console.log(`🔍 Mapping ${LEAGUE_NAME} matches from HelloTickets JSON`);
    console.log("================================================================================");
    console.log("");

    // Load matches from JSON
    const htPerformances = loadMatches();
    console.log(`📥 Loaded ${htPerformances.length} performances from JSON\n`);

    // Get supplier and league
    const supplier = await Supplier.findOne({ slug: SUPPLIER_SLUG });
    if (!supplier) {
      throw new Error(`Supplier "${SUPPLIER_SLUG}" not found`);
    }
    console.log(`✅ Found supplier: ${supplier.name} (${supplier._id})\n`);

    const league = await League.findOne({ slug: LEAGUE_SLUG });
    if (!league) {
      throw new Error(`League "${LEAGUE_SLUG}" not found`);
    }
    console.log(`✅ Found league: ${league.name} (${league._id})\n`);

    // Get all teams with HT IDs
    const teams = await Team.find({
      leagueIds: league._id,
    }).lean();

    const teamMap = new Map(); // Key: HT ID, Value: DB Team
    teams.forEach(team => {
      const htInfo = team.suppliersInfo?.find(
        s => s.supplierRef?.toString() === supplier._id.toString()
      );
      if (htInfo?.supplierExternalId) {
        teamMap.set(htInfo.supplierExternalId, team);
      }
    });

    console.log(`✅ Loaded ${teamMap.size} teams with HelloTickets IDs\n`);

    // Get all DB matches
    const now = new Date();
    const dbMatches = await FootballEvent.find({
      league: league._id,
      date: { $gte: now },
    })
      .populate("homeTeam", "name slug suppliersInfo")
      .populate("awayTeam", "name slug suppliersInfo")
      .lean();

    console.log(`📊 Found ${dbMatches.length} future matches in DB\n`);

    const stats = {
      totalHTPerformances: htPerformances.length,
      totalDBMatches: dbMatches.length,
      matchesUpdated: 0,
      matchesSkipped: 0,
      offersCreated: 0,
      offersUpdated: 0,
      offersSkipped: 0,
      errors: 0,
    };

    console.log("================================================================================");
    console.log("📋 Processing matches...");
    console.log("================================================================================");
    console.log("");

    // Process each HT performance
    for (let i = 0; i < htPerformances.length; i++) {
      const htPerf = htPerformances[i];
      const progress = `[${i + 1}/${htPerformances.length}]`;

      try {
        const performers = htPerf.performers || [];
        if (performers.length !== 2) {
          stats.matchesSkipped++;
          continue;
        }

        const htTeam1Id = performers[0].id?.toString();
        const htTeam2Id = performers[1].id?.toString();

        const dbTeam1 = teamMap.get(htTeam1Id);
        const dbTeam2 = teamMap.get(htTeam2Id);

        if (!dbTeam1 || !dbTeam2) {
          stats.matchesSkipped++;
          continue;
        }

        // Find matching DB match
        const htDate = new Date(htPerf.start_date?.date_time);
        if (isNaN(htDate.getTime())) {
          stats.matchesSkipped++;
          continue;
        }

        // Use wider date range (7 days) to catch matches with date differences
        const dateWindow = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
        const dateStart = new Date(htDate.getTime() - dateWindow);
        const dateEnd = new Date(htDate.getTime() + dateWindow);

        let matchedDBMatch = null;
        for (const dbMatch of dbMatches) {
          const dbDate = new Date(dbMatch.date);
          if (dbDate < dateStart || dbDate > dateEnd) continue;

          const dbHomeId = dbMatch.homeTeam._id?.toString() || dbMatch.homeTeam.toString();
          const dbAwayId = dbMatch.awayTeam._id?.toString() || dbMatch.awayTeam.toString();

          const team1Id = dbTeam1._id.toString();
          const team2Id = dbTeam2._id.toString();

          // Check if teams match (home/away or away/home)
          const teamsMatch =
            (team1Id === dbHomeId && team2Id === dbAwayId) ||
            (team1Id === dbAwayId && team2Id === dbHomeId);

          if (teamsMatch) {
            matchedDBMatch = dbMatch;
            break;
          }
        }

        if (!matchedDBMatch) {
          stats.matchesSkipped++;
          continue;
        }

        // Check if already mapped
        const existingHTMapping = matchedDBMatch.supplierExternalIds?.find(
          s => {
            const supplierId = s.supplierRef?._id?.toString() || s.supplierRef?.toString();
            return supplierId === supplier._id.toString() && s.supplierExternalId === htPerf.id.toString();
          }
        );

        if (existingHTMapping) {
          stats.matchesSkipped++;
          continue;
        }

        // Update FootballEvent
        const affiliateUrl = addAffiliateLink(htPerf.url);
        const metadata = new Map([
          ["url", htPerf.url],
          ["affiliateUrl", affiliateUrl],
          ["minPrice", htPerf.price_range?.min_price],
          ["maxPrice", htPerf.price_range?.max_price],
          ["currency", htPerf.price_range?.currency || "EUR"],
          ["ticketGroupsCount", htPerf.ticket_groups_count],
          ["helloTicketsEventId", htPerf.event_id],
        ]);

        const supplierExternalIdEntry = {
          supplierRef: supplier._id,
          supplierExternalId: htPerf.id.toString(),
          metadata: metadata,
        };

        // Remove old entry if exists
        await FootballEvent.findByIdAndUpdate(matchedDBMatch._id, {
          $pull: { supplierExternalIds: { supplierRef: supplier._id } },
        });

        // Add new entry
        await FootballEvent.findByIdAndUpdate(matchedDBMatch._id, {
          $push: { supplierExternalIds: supplierExternalIdEntry },
        });

        // Update minPrice
        if (htPerf.price_range?.min_price !== undefined) {
          await FootballEvent.findByIdAndUpdate(matchedDBMatch._id, {
            $set: {
              minPrice: {
                amount: htPerf.price_range.min_price,
                currency: htPerf.price_range.currency || "EUR",
                updatedAt: new Date(),
              },
            },
          });
        }

        stats.matchesUpdated++;

        if (stats.matchesUpdated % 10 === 0 || stats.matchesUpdated <= 20) {
          console.log(`${progress} ✅ Updated: ${matchedDBMatch.slug} - HT ID: ${htPerf.id}`);
        }

        // Create or update Offer
        if (htPerf.price_range?.min_price && affiliateUrl) {
          const offerData = {
            fixtureId: matchedDBMatch._id,
            ownerType: "Supplier",
            ownerId: supplier._id,
            price: htPerf.price_range.min_price,
            currency: htPerf.price_range.currency || "EUR",
            ticketType: "standard",
            isHospitality: false,
            isAvailable: true,
            url: affiliateUrl,
          };

          const existingOffer = await Offer.findOne({
            fixtureId: matchedDBMatch._id,
            ownerType: "Supplier",
            ownerId: supplier._id,
          });

          if (existingOffer) {
            if (
              existingOffer.price !== offerData.price ||
              existingOffer.currency !== offerData.currency ||
              existingOffer.url !== offerData.url
            ) {
              await Offer.findByIdAndUpdate(existingOffer._id, { $set: offerData });
              stats.offersUpdated++;
            } else {
              stats.offersSkipped++;
            }
          } else {
            const newOffer = new Offer(offerData);
            await newOffer.save();
            stats.offersCreated++;
          }
        } else {
          stats.offersSkipped++;
        }

      } catch (error) {
        stats.errors++;
        console.error(`${progress} ❌ Error: ${error.message}`);
      }
    }

    console.log("\n================================================================================");
    console.log("📊 SUMMARY");
    console.log("================================================================================");
    console.log(`Total HT Performances: ${stats.totalHTPerformances}`);
    console.log(`Total DB Matches: ${stats.totalDBMatches}`);
    console.log(`✅ Matches updated: ${stats.matchesUpdated}`);
    console.log(`⏭️  Matches skipped: ${stats.matchesSkipped}`);
    console.log(`✅ Offers created: ${stats.offersCreated}`);
    console.log(`🔄 Offers updated: ${stats.offersUpdated}`);
    console.log(`⏭️  Offers skipped: ${stats.offersSkipped}`);
    console.log(`❌ Errors: ${stats.errors}`);

    // Check how many matches still don't have HT ID
    console.log("\n================================================================================");
    console.log("🔍 VERIFICATION - Remaining unmapped matches");
    console.log("================================================================================");

    const finalDBMatches = await FootballEvent.find({
      league: league._id,
      date: { $gte: now },
    })
      .populate("homeTeam", "name slug")
      .populate("awayTeam", "name slug")
      .lean();

    const unmatchedFinal = finalDBMatches.filter(match => {
      const htMapping = match.supplierExternalIds?.find(
        s => {
          const supplierId = s.supplierRef?._id?.toString() || s.supplierRef?.toString();
          return supplierId === supplier._id.toString() && s.supplierExternalId;
        }
      );
      return !htMapping;
    });

    console.log(`\n📊 Final status:`);
    console.log(`   Total future matches: ${finalDBMatches.length}`);
    console.log(`   ✅ With HelloTickets ID: ${finalDBMatches.length - unmatchedFinal.length}`);
    console.log(`   ❌ Without HelloTickets ID: ${unmatchedFinal.length}`);

    if (unmatchedFinal.length > 0) {
      console.log(`\n📋 Remaining unmapped matches (first 20):`);
      unmatchedFinal.slice(0, 20).forEach((match, idx) => {
        const date = new Date(match.date).toISOString().split("T")[0];
        console.log(`   ${idx + 1}. ${match.slug} (${date})`);
      });
      if (unmatchedFinal.length > 20) {
        console.log(`   ... and ${unmatchedFinal.length - 20} more matches`);
      }
    } else {
      console.log(`\n✅ All matches are mapped!`);
    }

    console.log("\n================================================================================");
    console.log("✅ Done!");
    console.log("================================================================================");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
}

mapAndUpdateMatches();

