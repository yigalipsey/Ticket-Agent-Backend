import "dotenv/config";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { fileURLToPath } from "url";

import FootballEvent from "../src/models/FootballEvent.js";
import Supplier from "../src/models/Supplier.js";
import Team from "../src/models/Team.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RAW_FILE = path.resolve(
  __dirname,
  "../data/hellotickets/la_liga_raw_response.json"
);
const OUTPUT_FILE = path.resolve(
  __dirname,
  "../data/la_liga_matches_hellotickets.json"
);

const SUPPLIER_SLUG = "hellotickets";
const LA_LIGA_ID = "68da875303bee90385d564b9";

const AFFILIATE_PARAMS = "tap_a=141252-18675a&tap_s=8995852-00a564";

function appendAffiliate(url) {
  if (!url) return null;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${AFFILIATE_PARAMS}`;
}

function loadRawPerformances() {
  const raw = JSON.parse(fs.readFileSync(RAW_FILE, "utf8"));
  return {
    fetchedAt: raw.fetched_at,
    performances: raw.performances || [],
  };
}

async function buildTeamMap(supplier) {
  const teams = await Team.find({ leagueIds: LA_LIGA_ID }).lean();
  const map = new Map();

  for (const team of teams) {
    const htEntry = (team.suppliersInfo || []).find(
      (info) => info.supplierRef?.toString() === supplier._id.toString()
    );
    if (htEntry?.supplierExternalId) {
      map.set(htEntry.supplierExternalId.toString(), {
        teamId: team._id.toString(),
        slug: team.slug,
        name: team.name_en || team.name,
      });
    }
  }

  return map;
}

function normalizeDate(dateStr) {
  return new Date(dateStr).toISOString();
}

async function run() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined");
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB");

  try {
    const supplier = await Supplier.findOne({ slug: SUPPLIER_SLUG });
    if (!supplier) {
      throw new Error(`Supplier '${SUPPLIER_SLUG}' not found`);
    }

    const teamMap = await buildTeamMap(supplier);

    const { fetchedAt, performances } = loadRawPerformances();
    console.log(
      `📄 Loaded ${performances.length} performances from raw La Liga file`
    );

    const now = new Date();

    const matchesOutput = [];
    const stats = {
      totalPerformances: performances.length,
      matched: 0,
      skippedUnknownTeams: 0,
      skippedPastEvents: 0,
      dbEventsMissing: 0,
    };

    for (const perf of performances) {
      const performers = (perf.performers || []).filter(
        (p) => p.id?.toString() !== "12872" // just in case
      );
      if (performers.length !== 2) {
        stats.skippedUnknownTeams++;
        continue;
      }

      const teamEntries = performers.map((p) => {
        const mapEntry = teamMap.get(p.id?.toString());
        return mapEntry
          ? { ...mapEntry, htId: p.id.toString(), name: p.name }
          : null;
      });

      if (teamEntries.includes(null)) {
        stats.skippedUnknownTeams++;
        continue;
      }

      const [teamA, teamB] = teamEntries;
      const perfDate = new Date(perf.start_date?.date_time);
      if (Number.isNaN(perfDate)) {
        stats.skippedUnknownTeams++;
        continue;
      }

      const windowStart = new Date(perfDate);
      windowStart.setHours(windowStart.getHours() - 36);
      const windowEnd = new Date(perfDate);
      windowEnd.setHours(windowEnd.getHours() + 36);

      const dbEvent = await FootballEvent.findOne({
        league: LA_LIGA_ID,
        date: { $gte: windowStart, $lte: windowEnd },
        $or: [
          { homeTeam: teamA.teamId, awayTeam: teamB.teamId },
          { homeTeam: teamB.teamId, awayTeam: teamA.teamId },
        ],
      })
        .populate("homeTeam", "name slug suppliersInfo")
        .populate("awayTeam", "name slug suppliersInfo");

      if (!dbEvent) {
        stats.dbEventsMissing++;
        continue;
      }

      if (dbEvent.date < now) {
        stats.skippedPastEvents++;
        continue;
      }

      const metadata = {
        helloTicketsUrl: perf.url,
        helloTicketsAffiliateUrl: appendAffiliate(perf.url),
        ticketGroupsCount: perf.ticket_groups_count,
        helloTicketsEventId: perf.event_id,
        fetchedAt,
      };

      const update = {
        supplierExternalIds: [
          {
            supplierRef: supplier._id,
            supplierExternalId: perf.id.toString(),
            metadata,
          },
        ],
      };

      await FootballEvent.findByIdAndUpdate(
        dbEvent._id,
        {
          $pull: {
            supplierExternalIds: { supplierRef: supplier._id },
          },
          $push: update.supplierExternalIds[0],
          ...(perf.price_range?.min_price !== undefined && {
            $set: {
              minPrice: {
                amount: perf.price_range.min_price,
                currency: perf.price_range.currency || "EUR",
                updatedAt: new Date(),
              },
            },
          }),
        },
        { new: true }
      );

      stats.matched++;

      const homeTeamInfo = dbEvent.homeTeam
        ? {
            name: dbEvent.homeTeam.name,
            slug: dbEvent.homeTeam.slug,
            helloTicketsId:
              dbEvent.homeTeam.suppliersInfo?.find(
                (info) =>
                  info.supplierRef?.toString() === supplier._id.toString()
              )?.supplierExternalId || null,
          }
        : null;

      const awayTeamInfo = dbEvent.awayTeam
        ? {
            name: dbEvent.awayTeam.name,
            slug: dbEvent.awayTeam.slug,
            helloTicketsId:
              dbEvent.awayTeam.suppliersInfo?.find(
                (info) =>
                  info.supplierRef?.toString() === supplier._id.toString()
              )?.supplierExternalId || null,
          }
        : null;

      matchesOutput.push({
        htPerformanceId: perf.id.toString(),
        eventName: perf.name,
        eventDate: perf.start_date?.local_date || null,
        eventDateTime: perf.start_date?.date_time || null,
        homeTeam: homeTeamInfo,
        awayTeam: awayTeamInfo,
        venue: {
          name: perf.venue?.name || null,
          city: perf.venue?.city || null,
          address: perf.venue?.address || null,
        },
        localEventId: dbEvent._id.toString(),
        localEventSlug: dbEvent.slug,
        localEventDate: normalizeDate(dbEvent.date),
        mappingStatus: "✅ MATCH FOUND",
        helloTicketsUrl: perf.url || null,
        helloTicketsAffiliateUrl: appendAffiliate(perf.url),
        minPrice: perf.price_range?.min_price ?? null,
        maxPrice: perf.price_range?.max_price ?? null,
        currency: perf.price_range?.currency || null,
        ticketGroupsCount: perf.ticket_groups_count ?? null,
        helloTicketsEventId: perf.event_id ?? null,
      });
    }

    fs.writeFileSync(
      OUTPUT_FILE,
      JSON.stringify(
        {
          fetched_at: fetchedAt,
          total_performances: performances.length,
          matched_events: matchesOutput.length,
          matches: matchesOutput,
          stats,
        },
        null,
        2
      ),
      "utf8"
    );

    console.log("\n📊 La Liga HelloTickets Update Summary");
    console.log("--------------------------------------");
    console.log(`Total performances: ${stats.totalPerformances}`);
    console.log(`Matched & updated events: ${stats.matched}`);
    console.log(`Skipped past events: ${stats.skippedPastEvents}`);
    console.log(`Skipped unknown teams: ${stats.skippedUnknownTeams}`);
    console.log(`DB events missing: ${stats.dbEventsMissing}`);
    console.log(`📁 Matches file: ${OUTPUT_FILE}`);
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
