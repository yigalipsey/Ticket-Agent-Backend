import "dotenv/config";
import mongoose from "mongoose";
import axios from "axios";
import FootballEvent from "../src/models/FootballEvent.js";
import Supplier from "../src/models/Supplier.js";
import Offer from "../src/models/Offer.js";
import League from "../src/models/League.js";
import Team from "../src/models/Team.js";

const LEAGUE_SLUG = "ligue-1";
const LEAGUE_NAME = "Ligue 1";
const SUPPLIER_SLUG = "hellotickets";

const API_KEY = process.env.HELLO_TICETS_API_KEY || "pub-6a76dc10-12e5-466e-83d5-35b745c485a2";
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
  await mongoose.connect(process.env.MONGODB_URI);
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
        totalPages = Math.ceil((data.total_count || 0) / (data.per_page || 100));
      }

      if (data.performances && data.performances.length > 0) {
        allPerformances = allPerformances.concat(data.performances);
      }

      page++;
    } while (page <= totalPages);

    return allPerformances;
  } catch (error) {
    console.error(`❌ Error fetching ${performerName}:`, error.message);
    return [];
  }
}

function isLigue1Match(perf, ligue1TeamIds) {
  const perfDate = new Date(perf.start_date?.date_time);
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);

  // Filter: only future matches (from next week)
  if (perfDate < nextWeek) return false;

  // Filter: exclude European competitions and cup
  const name = perf.name.toLowerCase();
  const isEuropean =
    name.includes("champions league") ||
    name.includes("europa league") ||
    name.includes("uefa") ||
    name.includes("conference league");
  const isCup =
    name.includes("coupe de france") ||
    name.includes("coupe") ||
    name.includes("cup") ||
    name.includes("supercup");

  if (isEuropean || isCup) return false;

  // Filter: must have exactly 2 performers, both Ligue 1 teams
  const performers = perf.performers || [];
  if (performers.length !== 2) return false;

  const performerIds = performers.map((p) => p.id?.toString());
  const bothLigue1 = performerIds.every((id) => ligue1TeamIds.has(id));

  return bothLigue1;
}

async function fetchAndCreateLigue1Offers() {
  try {
    console.log("================================================================================");
    console.log("🔍 Fetching Ligue 1 matches and creating Offers");
    console.log("================================================================================");
    console.log("");

    // 1. Find HelloTickets supplier
    const supplier = await Supplier.findOne({ slug: SUPPLIER_SLUG });
    if (!supplier) {
      throw new Error(`Supplier "${SUPPLIER_SLUG}" not found`);
    }
    console.log(`✅ Found supplier: ${supplier.name} (${supplier._id})\n`);

    // 2. Find Ligue 1 league
    const league = await League.findOne({ slug: LEAGUE_SLUG });
    if (!league) {
      throw new Error(`League "${LEAGUE_SLUG}" not found`);
    }
    console.log(`✅ Found league: ${league.name} (${league._id})\n`);

    // 3. Get all Ligue 1 teams with HelloTickets IDs
    const teams = await Team.find({
      leagueIds: league._id,
      "suppliersInfo.supplierRef": supplier._id,
    }).lean();

    console.log(`📋 Found ${teams.length} Ligue 1 teams with HelloTickets IDs\n`);

    // Create maps for quick lookup
    const teamMap = new Map(); // Key: HelloTickets ID, Value: DB Team object
    const ligue1TeamIds = new Set();

    for (const team of teams) {
      const htInfo = team.suppliersInfo.find(
        (info) => info.supplierRef.toString() === supplier._id.toString()
      );
      if (htInfo?.supplierExternalId) {
        teamMap.set(htInfo.supplierExternalId, team);
        ligue1TeamIds.add(htInfo.supplierExternalId);
      }
    }

    console.log(`📊 Teams with HelloTickets IDs: ${ligue1TeamIds.size}\n`);

    // 4. Fetch all matches from HelloTickets
    console.log("================================================================================");
    console.log("📥 Fetching matches from HelloTickets...");
    console.log("================================================================================");
    console.log("");

    const allMatches = new Map(); // Use Map to avoid duplicates (key: performance ID)

    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      const htInfo = team.suppliersInfo.find(
        (info) => info.supplierRef.toString() === supplier._id.toString()
      );

      if (!htInfo?.supplierExternalId) continue;

      console.log(
        `[${i + 1}/${teams.length}] Fetching matches for ${htInfo.supplierTeamName} (${htInfo.supplierExternalId})...`
      );

      try {
        const performances = await fetchAllPerformances(
          htInfo.supplierExternalId,
          htInfo.supplierTeamName
        );

        // Filter and process matches
        performances.forEach((perf) => {
          if (isLigue1Match(perf, ligue1TeamIds)) {
            const perfId = perf.id.toString();

            // Only add if not already in map (avoid duplicates)
            if (!allMatches.has(perfId)) {
              // Extract team information
              const performers = perf.performers || [];
              const team1 = performers[0];
              const team2 = performers[1];

              const team1Data = teamMap.get(team1.id?.toString());
              const team2Data = teamMap.get(team2.id?.toString());

              // Determine home/away (first performer is usually home)
              const homeTeam = team1Data || {
                _id: null,
                slug: null,
                name: team1.name,
                htId: team1.id?.toString(),
                htName: team1.name,
              };
              const awayTeam = team2Data || {
                _id: null,
                slug: null,
                name: team2.name,
                htId: team2.id?.toString(),
                htName: team2.name,
              };

              allMatches.set(perfId, {
                htPerformanceId: perfId,
                htEventName: perf.name,
                dateTime: perf.start_date?.date_time,
                venue: perf.venue?.name || null,
                homeTeam: {
                  id: homeTeam._id,
                  slug: homeTeam.slug,
                  name: homeTeam.name || homeTeam.htName,
                  hellotickets_id: homeTeam.htId || homeTeam.hellotickets_id,
                  hellotickets_name: homeTeam.htName || homeTeam.name,
                },
                awayTeam: {
                  id: awayTeam._id,
                  slug: awayTeam.slug,
                  name: awayTeam.name || awayTeam.htName,
                  hellotickets_id: awayTeam.htId || awayTeam.hellotickets_id,
                  hellotickets_name: awayTeam.htName || awayTeam.name,
                },
                priceRange: {
                  min_price: perf.price_range?.min_price || null,
                  max_price: perf.price_range?.max_price || null,
                  currency: perf.price_range?.currency || "EUR",
                },
                url: perf.url || null,
                affiliateUrl: addAffiliateLink(perf.url),
                ticketGroupsCount: perf.ticket_groups_count || null,
                helloTicketsEventId: perf.event_id || null,
              });
            }
          }
        });

        console.log(
          `   ✅ Found ${performances.length} total matches, ${allMatches.size} unique Ligue 1 matches so far\n`
        );
      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        continue;
      }
    }

    const matchesArray = Array.from(allMatches.values());
    console.log(`\n✅ Total unique Ligue 1 matches: ${matchesArray.length}\n`);

    // 5. Match with DB events and update/create offers
    console.log("================================================================================");
    console.log("🔍 Matching with DB events and creating Offers...");
    console.log("================================================================================");
    console.log("");

    const stats = {
      totalMatches: matchesArray.length,
      matchesUpdated: 0,
      matchesSkipped: 0,
      offersCreated: 0,
      offersUpdated: 0,
      offersSkipped: 0,
    };

    for (let i = 0; i < matchesArray.length; i++) {
      const htMatch = matchesArray[i];
      const progress = `[${i + 1}/${matchesArray.length}]`;

      if (!htMatch.homeTeam.id || !htMatch.awayTeam.id) {
        console.log(
          `${progress} ⚠️  Skipping ${htMatch.htEventName}: Home or away team not found in DB`
        );
        stats.matchesSkipped++;
        continue;
      }

      // Find matching event in DB
      const htDate = new Date(htMatch.dateTime);
      const dateStart = new Date(htDate);
      dateStart.setHours(dateStart.getHours() - 24);
      const dateEnd = new Date(htDate);
      dateEnd.setHours(dateEnd.getHours() + 24);

      const dbEvent = await FootballEvent.findOne({
        league: league._id,
        date: { $gte: dateStart, $lte: dateEnd },
        $or: [
          {
            homeTeam: htMatch.homeTeam.id,
            awayTeam: htMatch.awayTeam.id,
          },
          {
            homeTeam: htMatch.awayTeam.id,
            awayTeam: htMatch.homeTeam.id,
          },
        ],
      });

      if (!dbEvent) {
        console.log(
          `${progress} ⚠️  Skipping ${htMatch.htEventName}: No matching DB event found`
        );
        stats.matchesSkipped++;
        continue;
      }

      // Update supplierExternalIds and minPrice
      let eventChanged = false;
      const updateEventData = {};

      // Update supplierExternalIds
      const existingSupplierExternalId = dbEvent.supplierExternalIds.find(
        (s) => s.supplierRef.toString() === supplier._id.toString()
      );

      const newSupplierExternalIdEntry = {
        supplierRef: supplier._id,
        supplierExternalId: htMatch.htPerformanceId,
        metadata: new Map([
          ["url", htMatch.url],
          ["affiliateUrl", htMatch.affiliateUrl],
          ["minPrice", htMatch.priceRange?.min_price],
          ["maxPrice", htMatch.priceRange?.max_price],
          ["currency", htMatch.priceRange?.currency],
          ["ticketGroupsCount", htMatch.ticketGroupsCount],
          ["helloTicketsEventId", htMatch.helloTicketsEventId],
        ]),
      };

      if (existingSupplierExternalId) {
        if (
          existingSupplierExternalId.supplierExternalId !== htMatch.htPerformanceId ||
          existingSupplierExternalId.metadata.get("affiliateUrl") !== htMatch.affiliateUrl ||
          existingSupplierExternalId.metadata.get("minPrice") !== htMatch.priceRange?.min_price
        ) {
          // Remove old entry and add new one
          await FootballEvent.findByIdAndUpdate(dbEvent._id, {
            $pull: { supplierExternalIds: { supplierRef: supplier._id } },
          });
          await FootballEvent.findByIdAndUpdate(dbEvent._id, {
            $push: { supplierExternalIds: newSupplierExternalIdEntry },
          });
          eventChanged = true;
        }
      } else {
        await FootballEvent.findByIdAndUpdate(dbEvent._id, {
          $push: { supplierExternalIds: newSupplierExternalIdEntry },
        });
        eventChanged = true;
      }

      // Update minPrice
      if (
        htMatch.priceRange?.min_price !== undefined &&
        htMatch.priceRange.min_price > 0 &&
        (dbEvent.minPrice?.amount !== htMatch.priceRange.min_price ||
          dbEvent.minPrice?.currency !== htMatch.priceRange.currency)
      ) {
        updateEventData.minPrice = {
          amount: htMatch.priceRange.min_price,
          currency: htMatch.priceRange.currency || "EUR",
          updatedAt: new Date(),
        };
        eventChanged = true;
      }

      if (eventChanged) {
        await FootballEvent.findByIdAndUpdate(dbEvent._id, updateEventData);
        stats.matchesUpdated++;
        console.log(
          `${progress} ✅ Updated: ${dbEvent.slug} - HT ID: ${htMatch.htPerformanceId}`
        );
      } else {
        stats.matchesSkipped++;
        console.log(
          `${progress} ⏭️  Skipped: ${dbEvent.slug} (already up-to-date)`
        );
      }

      // Create or update Offer
      if (
        htMatch.priceRange?.min_price !== undefined &&
        htMatch.priceRange.min_price > 0 &&
        htMatch.affiliateUrl
      ) {
        const offerData = {
          fixtureId: dbEvent._id,
          ownerType: "Supplier",
          ownerId: supplier._id,
          price: htMatch.priceRange.min_price,
          currency: htMatch.priceRange.currency || "EUR",
          ticketType: "standard",
          isHospitality: false,
          isAvailable: true,
          url: htMatch.affiliateUrl,
        };

        const existingOffer = await Offer.findOne({
          fixtureId: dbEvent._id,
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
            console.log(
              `   🔄 Offer updated: ${offerData.price} ${offerData.currency}`
            );
          } else {
            stats.offersSkipped++;
            console.log(`   ⏭️  Offer skipped (already up-to-date)`);
          }
        } else {
          const newOffer = new Offer(offerData);
          await newOffer.save();
          stats.offersCreated++;
          console.log(
            `   ➕ Offer created: ${offerData.price} ${offerData.currency}`
          );
        }
      } else {
        stats.offersSkipped++;
        console.log(`   ⚠️  No valid price or URL for offer`);
      }
    }

    console.log("\n================================================================================");
    console.log("📊 SUMMARY");
    console.log("================================================================================");
    console.log(`Total matches from HelloTickets: ${stats.totalMatches}`);
    console.log(`✅ Matches updated: ${stats.matchesUpdated}`);
    console.log(`⏭️  Matches skipped: ${stats.matchesSkipped}`);
    console.log(`✅ Offers created: ${stats.offersCreated}`);
    console.log(`🔄 Offers updated: ${stats.offersUpdated}`);
    console.log(`⏭️  Offers skipped: ${stats.offersSkipped}`);

    // Verification
    console.log("\n================================================================================");
    console.log("🔍 VERIFICATION");
    console.log("================================================================================");

    const totalLigue1MatchesWithHtMapping = await FootballEvent.countDocuments({
      league: league._id,
      "supplierExternalIds.supplierRef": supplier._id,
    });
    console.log(
      `📊 Total Ligue 1 matches with HelloTickets mapping: ${totalLigue1MatchesWithHtMapping}`
    );

    const matchesWithMinPrice = await FootballEvent.countDocuments({
      league: league._id,
      "minPrice.amount": { $exists: true, $ne: null, $gt: 0 },
    });
    console.log(`📊 Matches with minPrice: ${matchesWithMinPrice}`);

    const totalOffersForLeague = await Offer.countDocuments({
      fixtureId: {
        $in: await FootballEvent.find({ league: league._id })
          .select("_id")
          .lean()
          .then((events) => events.map((e) => e._id)),
      },
      ownerType: "Supplier",
      ownerId: supplier._id,
    });
    console.log(`📊 Total offers for ${LEAGUE_NAME}: ${totalOffersForLeague}`);

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

connectDB().then(() => fetchAndCreateLigue1Offers());



