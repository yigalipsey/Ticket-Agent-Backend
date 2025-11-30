import "dotenv/config";
import axios from "axios";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { fileURLToPath } from "url";

import FootballEvent from "../src/models/FootballEvent.js";
import Supplier from "../src/models/Supplier.js";
import Team from "../src/models/Team.js"; // eslint-disable-line no-unused-vars

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_URL = "https://api-live.hellotickets.com/v1";
const API_KEY =
  process.env.HELLO_TICETS_API_KEY ||
  "pub-6a76dc10-12e5-466e-83d5-35b745c485a2";

const LEEDS_PERFORMER_ID = "20682";
const SUPPLIER_SLUG = "hellotickets";
const PREMIER_LEAGUE_ID = "68d6809aa0fb97844d2084b9";
const TEAM_FILE = path.resolve(
  __dirname,
  "../data/premier_league_teams_hellotickets.json"
);

function loadTeamMappings() {
  const raw = fs.readFileSync(TEAM_FILE, "utf8");
  const parsed = JSON.parse(raw);

  const idToSlug = new Map();
  const slugToId = new Map();

  for (const team of parsed.teams || []) {
    if (team.helloTicketsId) {
      idToSlug.set(team.helloTicketsId.toString(), team.slug);
    }
    if (team.slug) {
      slugToId.set(team.slug, team.helloTicketsId?.toString());
    }
  }

  return { idToSlug, slugToId };
}

async function fetchLeedsPerformances() {
  const params = {
    performer_id: LEEDS_PERFORMER_ID,
    category_id: 1,
    limit: 100,
    page: 1,
    is_sellable: true,
  };

  const { data } = await axios.get(`${API_URL}/performances`, {
    params,
    headers: {
      Accept: "application/json",
      "X-Public-Key": API_KEY,
    },
  });

  return data.performances || [];
}

function normalizeDate(date) {
  return date.toISOString().split("T")[0];
}

function buildMetadata(perf) {
  const metadata = {
    helloTicketsUrl: perf.url || null,
    ticketGroupsCount: perf.ticket_groups_count ?? null,
    helloTicketsEventId: perf.event_id ?? null,
    source: "api-fetch-single-call",
  };

  if (perf.start_date) {
    metadata.htLocalDate = perf.start_date.local_date || null;
    metadata.htLocalTime = perf.start_date.local_time || null;
  }

  Object.keys(metadata).forEach((key) => {
    if (metadata[key] === null || metadata[key] === undefined) {
      delete metadata[key];
    }
  });

  return metadata;
}

async function run() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined");
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected");

  try {
    const supplier = await Supplier.findOne({ slug: SUPPLIER_SLUG });
    if (!supplier) {
      throw new Error(`Supplier '${SUPPLIER_SLUG}' not found`);
    }

    const { idToSlug } = loadTeamMappings();

    console.log(
      "\n📥 Fetching Leeds performances from HelloTickets (single call)..."
    );
    const performances = await fetchLeedsPerformances();
    console.log(`✅ Retrieved ${performances.length} performances from API`);

    const now = new Date();

    const events = await FootballEvent.find({
      league: PREMIER_LEAGUE_ID,
      date: { $gte: now },
    })
      .select("date slug supplierExternalIds minPrice")
      .populate("homeTeam", "name slug")
      .populate("awayTeam", "name slug")
      .lean();

    const leedsEvents = events.filter((event) => {
      if (!event.homeTeam?.slug) return false;
      if (event.homeTeam.slug !== "leeds") return false;
      const hasSupplier = event.supplierExternalIds?.some(
        (entry) => entry.supplierRef?.toString() === supplier._id.toString()
      );
      return !hasSupplier;
    });

    console.log(`📝 Leeds home games needing mapping: ${leedsEvents.length}`);

    const stats = {
      totalPerformances: performances.length,
      eventsNeedingMapping: leedsEvents.length,
      matched: 0,
      unmatchedEvents: [],
    };

    for (const event of leedsEvents) {
      const eventDate = new Date(event.date);
      const opponentSlug = event.awayTeam?.slug;
      if (!opponentSlug) {
        stats.unmatchedEvents.push({
          slug: event.slug,
          reason: "Missing opponent slug",
        });
        continue;
      }

      const performance = performances.find((perf) => {
        if (!perf.start_date?.date_time || !perf.performers) return false;
        const perfDate = new Date(perf.start_date.date_time);
        const diffHours = Math.abs(perfDate - eventDate) / (1000 * 60 * 60);
        if (diffHours > 36) return false;

        const opponentPerf = perf.performers.find(
          (p) => p.id?.toString() !== LEEDS_PERFORMER_ID
        );
        if (!opponentPerf) return false;
        const perfOpponentSlug = idToSlug.get(opponentPerf.id?.toString());
        if (!perfOpponentSlug) return false;
        return perfOpponentSlug === opponentSlug;
      });

      if (!performance) {
        stats.unmatchedEvents.push({
          slug: event.slug,
          reason: "No matching performance",
        });
        continue;
      }

      const metadata = buildMetadata(performance);

      const update = {
        $pull: {
          supplierExternalIds: {
            supplierRef: supplier._id,
          },
        },
        $push: {
          supplierExternalIds: {
            supplierRef: supplier._id,
            supplierExternalId: performance.id.toString(),
            metadata,
          },
        },
      };

      if (performance.price_range?.min_price !== undefined) {
        update.$set = {
          minPrice: {
            amount: performance.price_range.min_price,
            currency: performance.price_range.currency || "EUR",
            updatedAt: new Date(),
          },
        };
      }

      await FootballEvent.findByIdAndUpdate(event._id, update);
      stats.matched++;
      console.log(`   ✅ Mapped ${event.slug} -> HT ID ${performance.id}`);
    }

    console.log("\n📊 Leeds Mapping Summary");
    console.log("------------------------");
    console.log(
      `Performances fetched (single call): ${stats.totalPerformances}`
    );
    console.log(`Events needing mapping: ${stats.eventsNeedingMapping}`);
    console.log(`✅ Successfully matched: ${stats.matched}`);
    console.log(`⚠️  Unmatched events: ${stats.unmatchedEvents.length}`);
    stats.unmatchedEvents.forEach((item) =>
      console.log(`   - ${item.slug}: ${item.reason}`)
    );
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});




