import "dotenv/config";
import mongoose from "mongoose";
import axios from "axios";
import FootballEvent from "../src/models/FootballEvent.js";
import Supplier from "../src/models/Supplier.js";
import Offer from "../src/models/Offer.js";
import League from "../src/models/League.js";
import Team from "../src/models/Team.js";

const API_KEY =
  process.env.HELLO_TICETS_API_KEY ||
  "pub-6a76dc10-12e5-466e-83d5-35b745c485a2";
const API_URL = "https://api-live.hellotickets.com/v1";
const AFFILIATE_PARAMS = "?tap_a=141252-18675a&tap_s=8995852-00a564";

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

async function fetchAllPerformances(performerId, performerName) {
  try {
    let allPerformances = [];
    let page = 1;
    let totalPages = 1;

    do {
      const params = {
        performer_id: performerId,
        category_id: 1,
        page: page,
        limit: 100,
      };

      const { data } = await axios.get(`${API_URL}/performances`, {
        params,
        headers: {
          Accept: "application/json",
          "X-Public-Key": API_KEY,
        },
      });

      if (page === 1) {
        totalPages = Math.ceil(
          (data.total_count || 0) / (data.per_page || 100)
        );
      }

      if (data.performances && data.performances.length > 0) {
        allPerformances = allPerformances.concat(data.performances);
      }

      page++;
    } while (page <= totalPages);

    return allPerformances;
  } catch (error) {
    console.error(
      `❌ Error fetching performances for ${performerName}:`,
      error.message
    );
    throw error;
  }
}

async function updatePremierLeaguePrices() {
  try {
    console.log(
      "================================================================================"
    );
    console.log("🔍 עדכון מחירים ובדיקת תקינות Offers - Premier League");
    console.log(
      "================================================================================"
    );
    console.log("");

    const supplier = await Supplier.findOne({ slug: "hellotickets" });
    if (!supplier) {
      throw new Error('Supplier "hellotickets" not found');
    }
    console.log(`✅ Found supplier: ${supplier.name} (${supplier._id})\n`);

    const league = await League.findOne({ slug: "epl" });
    if (!league) {
      throw new Error('League "epl" not found');
    }
    console.log(`✅ Found league: ${league.name} (${league._id})\n`);

    // Get all Premier League teams with HelloTickets IDs
    const teams = await Team.find({
      leagueIds: league._id,
    })
      .select("name_en name slug suppliersInfo")
      .lean();

    const teamsWithHT = teams.filter((team) => {
      const htInfo = team.suppliersInfo?.find(
        (s) => s.supplierRef?.toString() === supplier._id.toString()
      );
      return htInfo?.supplierExternalId;
    });

    console.log(
      `📊 Teams with HelloTickets ID: ${teamsWithHT.length}/${teams.length}\n`
    );

    // Create map of HT ID to team
    const htIdToTeam = new Map();
    teamsWithHT.forEach((team) => {
      const htInfo = team.suppliersInfo.find(
        (s) => s.supplierRef?.toString() === supplier._id.toString()
      );
      if (htInfo?.supplierExternalId) {
        htIdToTeam.set(htInfo.supplierExternalId, team);
      }
    });

    // Fetch all performances for all teams (one API call per team)
    const allHTPerformances = new Map(); // Key: performance ID, Value: performance object
    let teamIndex = 0;

    console.log(
      "================================================================================"
    );
    console.log("📥 Fetching performances from HelloTickets API");
    console.log(
      "================================================================================"
    );
    console.log("");

    for (const team of teamsWithHT) {
      teamIndex++;
      const htInfo = team.suppliersInfo.find(
        (s) => s.supplierRef?.toString() === supplier._id.toString()
      );
      const htId = htInfo.supplierExternalId;
      const teamName = team.name_en || team.name;

      console.log(
        `[${teamIndex}/${teamsWithHT.length}] Fetching matches for ${teamName} (HT ID: ${htId})...`
      );

      try {
        const performances = await fetchAllPerformances(htId, teamName);

        performances.forEach((perf) => {
          const perfId = perf.id.toString();
          if (!allHTPerformances.has(perfId)) {
            allHTPerformances.set(perfId, perf);
          }
        });

        console.log(
          `   ✅ Found ${performances.length} matches (${allHTPerformances.size} unique total)\n`
        );

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`   ❌ Error: ${error.message}\n`);
        continue;
      }
    }

    console.log(
      `\n✅ Total unique performances fetched: ${allHTPerformances.size}\n`
    );

    // Get all Premier League matches with HelloTickets mapping
    const now = new Date();
    const dbMatches = await FootballEvent.find({
      league: league._id,
      date: { $gte: now },
      "supplierExternalIds.supplierRef": supplier._id,
    })
      .populate("homeTeam", "name slug")
      .populate("awayTeam", "name slug")
      .lean();

    console.log(
      `📊 Found ${dbMatches.length} Premier League matches with HelloTickets mapping\n`
    );

    console.log(
      "================================================================================"
    );
    console.log("📋 Updating matches and verifying offers...");
    console.log(
      "================================================================================"
    );
    console.log("");

    const stats = {
      matchesUpdated: 0,
      matchesSkipped: 0,
      offersUpdated: 0,
      offersCreated: 0,
      offersSkipped: 0,
      errors: 0,
    };

    for (let i = 0; i < dbMatches.length; i++) {
      const dbMatch = dbMatches[i];
      const progress = `[${i + 1}/${dbMatches.length}]`;

      try {
        const htMapping = dbMatch.supplierExternalIds?.find((s) => {
          const supplierId =
            s.supplierRef?._id?.toString() || s.supplierRef?.toString();
          return supplierId === supplier._id.toString();
        });

        if (!htMapping || !htMapping.supplierExternalId) {
          stats.matchesSkipped++;
          continue;
        }

        const htPerformanceId = htMapping.supplierExternalId.toString();
        const htPerf = allHTPerformances.get(htPerformanceId);

        if (!htPerf) {
          stats.matchesSkipped++;
          if (stats.matchesSkipped <= 10) {
            console.log(
              `${progress} ⚠️  Skipped: ${dbMatch.slug} - HT Performance ${htPerformanceId} not found in API response`
            );
          }
          continue;
        }

        let needsUpdate = false;
        const updateData = {};

        // Check and update price
        const expectedMinPrice = htPerf.price_range?.min_price;
        const expectedCurrency = htPerf.price_range?.currency || "EUR";
        const actualMinPrice = dbMatch.minPrice?.amount;
        const actualCurrency = dbMatch.minPrice?.currency;

        if (
          expectedMinPrice !== undefined &&
          (actualMinPrice !== expectedMinPrice ||
            actualCurrency !== expectedCurrency)
        ) {
          updateData.minPrice = {
            amount: expectedMinPrice,
            currency: expectedCurrency,
            updatedAt: new Date(),
          };
          needsUpdate = true;
        }

        // Check and update URLs in metadata
        const expectedUrl = htPerf.url;
        const expectedAffiliateUrl = addAffiliateLink(expectedUrl);

        const metadata = htMapping.metadata || new Map();
        const actualUrl =
          metadata instanceof Map ? metadata.get("url") : metadata?.url;
        const actualAffiliateUrl =
          metadata instanceof Map
            ? metadata.get("affiliateUrl")
            : metadata?.affiliateUrl;

        if (
          actualUrl !== expectedUrl ||
          actualAffiliateUrl !== expectedAffiliateUrl
        ) {
          const newMetadata = new Map();
          newMetadata.set("url", expectedUrl);
          newMetadata.set("affiliateUrl", expectedAffiliateUrl);
          newMetadata.set("minPrice", expectedMinPrice);
          newMetadata.set("maxPrice", htPerf.price_range?.max_price);
          newMetadata.set("currency", expectedCurrency);

          // Update supplierExternalIds metadata
          await FootballEvent.findByIdAndUpdate(dbMatch._id, {
            $pull: { supplierExternalIds: { supplierRef: supplier._id } },
          });

          await FootballEvent.findByIdAndUpdate(dbMatch._id, {
            $push: {
              supplierExternalIds: {
                supplierRef: supplier._id,
                supplierExternalId: htPerformanceId,
                metadata: newMetadata,
              },
            },
          });

          needsUpdate = true;
        }

        // Update minPrice if needed
        if (updateData.minPrice) {
          await FootballEvent.findByIdAndUpdate(dbMatch._id, {
            $set: updateData,
          });
          needsUpdate = true;
        }

        if (needsUpdate) {
          stats.matchesUpdated++;
          if (stats.matchesUpdated % 20 === 0 || stats.matchesUpdated <= 20) {
            console.log(
              `${progress} ✅ Updated: ${dbMatch.slug} - Price: ${
                expectedMinPrice || "N/A"
              } ${expectedCurrency}`
            );
          }
        } else {
          stats.matchesSkipped++;
        }

        // Check and update/create Offer
        if (expectedMinPrice && expectedAffiliateUrl) {
          const offerData = {
            fixtureId: dbMatch._id,
            ownerType: "Supplier",
            ownerId: supplier._id,
            price: expectedMinPrice,
            currency: expectedCurrency,
            ticketType: "standard",
            isHospitality: false,
            isAvailable: true,
            url: expectedAffiliateUrl,
          };

          // Verify affiliate URL has correct params
          const hasAffiliateParams =
            expectedAffiliateUrl.includes("tap_a=") &&
            expectedAffiliateUrl.includes("tap_s=");

          if (!hasAffiliateParams) {
            console.log(
              `   ⚠️  Warning: ${dbMatch.slug} - Affiliate URL missing params`
            );
          }

          const existingOffer = await Offer.findOne({
            fixtureId: dbMatch._id,
            ownerType: "Supplier",
            ownerId: supplier._id,
          }).lean();

          if (existingOffer) {
            if (
              existingOffer.price !== offerData.price ||
              existingOffer.currency !== offerData.currency ||
              existingOffer.url !== offerData.url
            ) {
              await Offer.findByIdAndUpdate(existingOffer._id, {
                $set: offerData,
              });
              stats.offersUpdated++;
            } else {
              stats.offersSkipped++;
            }
          } else {
            const newOffer = new Offer(offerData);
            await newOffer.save();
            stats.offersCreated++;
          }
        }
      } catch (error) {
        stats.errors++;
        console.error(`${progress} ❌ Error: ${error.message}`);
      }
    }

    console.log(
      "\n================================================================================"
    );
    console.log("📊 SUMMARY");
    console.log(
      "================================================================================"
    );
    console.log(`Total matches with HT mapping: ${dbMatches.length}`);
    console.log(`✅ Matches updated: ${stats.matchesUpdated}`);
    console.log(`⏭️  Matches skipped: ${stats.matchesSkipped}`);
    console.log(`✅ Offers created: ${stats.offersCreated}`);
    console.log(`🔄 Offers updated: ${stats.offersUpdated}`);
    console.log(`⏭️  Offers skipped: ${stats.offersSkipped}`);
    console.log(`❌ Errors: ${stats.errors}`);

    // Final verification
    console.log(
      "\n================================================================================"
    );
    console.log("🔍 FINAL VERIFICATION");
    console.log(
      "================================================================================"
    );

    const finalMatches = await FootballEvent.find({
      league: league._id,
      date: { $gte: now },
      "supplierExternalIds.supplierRef": supplier._id,
    }).lean();

    const matchesWithPrice = finalMatches.filter(
      (m) => m.minPrice?.amount > 0
    ).length;

    const fixtureIds = finalMatches.map((m) => m._id);
    const finalOffers = await Offer.find({
      fixtureId: { $in: fixtureIds },
      ownerType: "Supplier",
      ownerId: supplier._id,
    }).lean();

    const offersWithAffiliate = finalOffers.filter((o) => {
      const url = o.url || "";
      return url.includes("tap_a=") && url.includes("tap_s=");
    }).length;

    console.log(`\n📊 Final status:`);
    console.log(`   Matches with HT ID: ${finalMatches.length}`);
    console.log(`   Matches with price: ${matchesWithPrice}`);
    console.log(`   Offers: ${finalOffers.length}`);
    console.log(`   Offers with affiliate link: ${offersWithAffiliate}`);

    console.log(
      "\n================================================================================"
    );
    console.log("✅ Done!");
    console.log(
      "================================================================================"
    );
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
}

connectDB().then(() => updatePremierLeaguePrices());


