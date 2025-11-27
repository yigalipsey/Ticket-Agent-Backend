import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import FootballEvent from "../src/models/FootballEvent.js";
import Supplier from "../src/models/Supplier.js";
import Offer from "../src/models/Offer.js";
import League from "../src/models/League.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const LEAGUE_SLUG = "laliga";
const LEAGUE_NAME = "La Liga";
const SUPPLIER_SLUG = "hellotickets";

// Paths
const MATCHES_FILE = path.resolve(
  __dirname,
  "../data/la_liga_matches_hellotickets.json"
);

async function connectDB() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined in .env");
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");
}

function loadMatches() {
  if (!fs.existsSync(MATCHES_FILE)) {
    throw new Error(`Matches file not found: ${MATCHES_FILE}`);
  }
  const data = JSON.parse(fs.readFileSync(MATCHES_FILE, "utf8"));
  return data.matches || [];
}

async function updateMatchesAndCreateOffers() {
  try {
    console.log("================================================================================");
    console.log(`🔍 Updating ${LEAGUE_NAME} matches with HelloTickets IDs and creating Offers`);
    console.log("================================================================================");
    console.log("");

    // Load matches from JSON
    const matches = loadMatches();
    console.log(`📥 Loaded ${matches.length} matches from JSON\n`);

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

    const stats = {
      totalMatches: matches.length,
      matchesUpdated: 0,
      matchesSkipped: 0,
      offersCreated: 0,
      offersUpdated: 0,
      offersSkipped: 0,
      errors: 0,
    };

    const errorDetails = [];

    console.log("================================================================================");
    console.log("📋 Processing matches...");
    console.log("================================================================================");
    console.log("");

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const matchNum = i + 1;

      try {
        // Skip if not matched
        if (!match.localEventId || match.mappingStatus !== "✅ MATCH FOUND") {
          stats.matchesSkipped++;
          continue;
        }

        // Find the match in DB
        const dbMatch = await FootballEvent.findById(match.localEventId);

        if (!dbMatch) {
          stats.matchesSkipped++;
          console.log(
            `[${matchNum}/${matches.length}] ⚠️  Skipping: Match not found in DB (${match.localEventSlug})`
          );
          continue;
        }

        // Prepare metadata
        const metadata = new Map();
        if (match.helloTicketsUrl) {
          metadata.set("url", match.helloTicketsUrl);
        }
        if (match.helloTicketsAffiliateUrl) {
          metadata.set("affiliateUrl", match.helloTicketsAffiliateUrl);
        }

        // Update supplierExternalIds
        let suppliersInfo = dbMatch.supplierExternalIds || [];
        // Remove existing HelloTickets mapping if exists
        suppliersInfo = suppliersInfo.filter(
          (s) => s.supplierRef.toString() !== supplier._id.toString()
        );
        // Add new mapping
        suppliersInfo.push({
          supplierRef: supplier._id,
          supplierExternalId: match.htPerformanceId,
          metadata: metadata,
        });

        // Update minPrice if available
        let minPriceUpdate = {};
        if (match.minPrice !== null && match.minPrice !== undefined) {
          minPriceUpdate = {
            minPrice: {
              amount: match.minPrice,
              currency: match.currency || "EUR",
              updatedAt: new Date(),
            },
          };
        }

        // Update the match
        await FootballEvent.findByIdAndUpdate(
          dbMatch._id,
          {
            $set: {
              supplierExternalIds: suppliersInfo,
              ...minPriceUpdate,
            },
          },
          { new: true }
        );

        stats.matchesUpdated++;
        console.log(
          `[${matchNum}/${matches.length}] ✅ Updated: ${dbMatch.slug} - HT ID: ${match.htPerformanceId}`
        );

        // Create or update Offer
        if (match.minPrice !== null && match.minPrice !== undefined && match.minPrice > 0) {
          const affiliateUrl = match.helloTicketsAffiliateUrl || match.helloTicketsUrl;

          if (affiliateUrl) {
            const existingOffer = await Offer.findOne({
              fixtureId: dbMatch._id,
              ownerType: "Supplier",
              ownerId: supplier._id,
            });

            if (existingOffer) {
              // Update existing offer
              const needsUpdate =
                existingOffer.price !== match.minPrice ||
                existingOffer.currency !== (match.currency || "EUR") ||
                existingOffer.url !== affiliateUrl;

              if (needsUpdate) {
                await Offer.findByIdAndUpdate(
                  existingOffer._id,
                  {
                    $set: {
                      price: match.minPrice,
                      currency: match.currency || "EUR",
                      url: affiliateUrl,
                      isAvailable: true,
                    },
                  },
                  { new: true }
                );
                stats.offersUpdated++;
                console.log(
                  `   🔄 Offer updated: ${match.minPrice} ${match.currency || "EUR"}`
                );
              }
            } else {
              // Create new offer
              const newOffer = new Offer({
                fixtureId: dbMatch._id,
                ownerType: "Supplier",
                ownerId: supplier._id,
                price: match.minPrice,
                currency: match.currency || "EUR",
                ticketType: "standard",
                isHospitality: false,
                isAvailable: true,
                url: affiliateUrl,
              });

              await newOffer.save();
              stats.offersCreated++;
              console.log(
                `   ➕ Offer created: ${match.minPrice} ${match.currency || "EUR"}`
              );
            }
          } else {
            stats.offersSkipped++;
            console.log(`   ⚠️  No URL for offer`);
          }
        } else {
          stats.offersSkipped++;
          console.log(`   ⚠️  No valid price for offer`);
        }
      } catch (error) {
        stats.errors++;
        const errorMsg = `Error processing match ${i + 1}: ${error.message}`;
        console.error(`[${matchNum}/${matches.length}] ❌ ${errorMsg}`);
        errorDetails.push({
          matchIndex: i + 1,
          slug: match.localEventSlug || "N/A",
          error: error.message,
        });
      }
    }

    console.log("");
    console.log("================================================================================");
    console.log("📊 SUMMARY");
    console.log("================================================================================");
    console.log(`Total matches in JSON: ${stats.totalMatches}`);
    console.log(`✅ Matches updated: ${stats.matchesUpdated}`);
    console.log(`⏭️  Matches skipped: ${stats.matchesSkipped}`);
    console.log(`✅ Offers created: ${stats.offersCreated}`);
    console.log(`🔄 Offers updated: ${stats.offersUpdated}`);
    console.log(`⏭️  Offers skipped: ${stats.offersSkipped}`);
    if (stats.errors > 0) {
      console.log(`❌ Errors: ${stats.errors}`);
      if (errorDetails.length > 0) {
        console.log("\nError details (first 10):");
        errorDetails.slice(0, 10).forEach((err) => {
          console.log(`   ${err.slug}: ${err.error}`);
        });
      }
    }
    console.log("");

    // Verification
    console.log("================================================================================");
    console.log("🔍 VERIFICATION");
    console.log("================================================================================");
    console.log("");

    const totalMatches = await FootballEvent.countDocuments({
      league: league._id,
      "supplierExternalIds.supplierRef": supplier._id,
    });
    console.log(
      `📊 Total ${LEAGUE_NAME} matches with HelloTickets mapping: ${totalMatches}`
    );

    const matchesWithPrice = await FootballEvent.countDocuments({
      league: league._id,
      "supplierExternalIds.supplierRef": supplier._id,
      "minPrice.amount": { $exists: true, $ne: null },
    });
    console.log(`📊 Matches with minPrice: ${matchesWithPrice}`);

    // Get all fixture IDs with HelloTickets mapping
    const fixturesWithHT = await FootballEvent.find({
      league: league._id,
      "supplierExternalIds.supplierRef": supplier._id,
    })
      .select("_id")
      .lean();
    const fixtureIds = fixturesWithHT.map((m) => m._id);

    const totalOffers = await Offer.countDocuments({
      fixtureId: { $in: fixtureIds },
      ownerType: "Supplier",
      ownerId: supplier._id,
    });
    console.log(`📊 Total offers for ${LEAGUE_NAME}: ${totalOffers}`);

    const offersWithUrl = await Offer.countDocuments({
      fixtureId: { $in: fixtureIds },
      ownerType: "Supplier",
      ownerId: supplier._id,
      url: { $exists: true, $ne: null },
    });
    console.log(`📊 Offers with URL: ${offersWithUrl}`);

    console.log("");
    console.log("================================================================================");
    console.log("✅ Done!");
    console.log("================================================================================");
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    throw error;
  }
}

async function run() {
  try {
    await connectDB();
    await updateMatchesAndCreateOffers();
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
}

run();

