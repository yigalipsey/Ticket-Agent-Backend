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
const LA_LIGA_ID = "68da875303bee90385d564b9";
const SUPPLIER_SLUG = "hellotickets";

function loadRaw() {
  const raw = JSON.parse(fs.readFileSync(RAW_FILE, "utf8"));
  return raw.performances || [];
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
        name: team.name_en || team.name,
        slug: team.slug,
      });
    }
  }
  return map;
}

const OUTPUT_REPORT = path.resolve(
  __dirname,
  "../data/la_liga_unmatched_report.json"
);

async function run() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  try {
    const supplier = await Supplier.findOne({ slug: SUPPLIER_SLUG });
    const teamMap = await buildTeamMap(supplier);
    const performances = loadRaw();

    const now = new Date();
    const categories = {
      unknownTeams: [],
      missingInDb: [],
      pastEvents: [],
      matched: [],
    };

    for (const perf of performances) {
      const performers = (perf.performers || []).filter(
        (p) => p.id?.toString() !== "12872"
      );
      if (performers.length !== 2) {
        categories.unknownTeams.push({
          id: perf.id,
          name: perf.name,
          reason: "Unexpected performers count",
        });
        continue;
      }

      const mapped = performers.map((p) => ({
        htId: p.id?.toString(),
        map: teamMap.get(p.id?.toString()),
        name: p.name,
      }));

      if (mapped.some((m) => !m.map)) {
        categories.unknownTeams.push({
          id: perf.id,
          name: perf.name,
          teams: mapped.map((m) => ({
            htId: m.htId,
            name: m.name,
            mapped: Boolean(m.map),
          })),
        });
        continue;
      }

      const perfDate = new Date(perf.start_date?.date_time);
      if (Number.isNaN(perfDate)) {
        categories.unknownTeams.push({
          id: perf.id,
          name: perf.name,
          reason: "Invalid date",
        });
        continue;
      }

      const windowStart = new Date(perfDate);
      windowStart.setHours(windowStart.getHours() - 36);
      const windowEnd = new Date(perfDate);
      windowEnd.setHours(windowEnd.getHours() + 36);

      const [teamA, teamB] = mapped;

      const dbEvent = await FootballEvent.findOne({
        league: LA_LIGA_ID,
        date: { $gte: windowStart, $lte: windowEnd },
        $or: [
          { homeTeam: teamA.map.teamId, awayTeam: teamB.map.teamId },
          { homeTeam: teamB.map.teamId, awayTeam: teamA.map.teamId },
        ],
      })
        .select("date slug")
        .lean();

      if (!dbEvent) {
        categories.missingInDb.push({
          id: perf.id,
          name: perf.name,
          date: perf.start_date?.date_time,
          teams: [teamA.map.name, teamB.map.name],
        });
        continue;
      }

      if (dbEvent.date < now) {
        categories.pastEvents.push({
          slug: dbEvent.slug,
          date: dbEvent.date,
        });
        continue;
      }

      categories.matched.push({
        slug: dbEvent.slug,
        helloTicketsId: perf.id,
      });
    }

    const report = {
      generated_at: new Date().toISOString(),
      total_performances: performances.length,
      matched_events: categories.matched.length,
      unknown_teams_or_competitions: categories.unknownTeams,
      missing_in_db: categories.missingInDb,
      past_events: categories.pastEvents,
    };

    fs.writeFileSync(OUTPUT_REPORT, JSON.stringify(report, null, 2), "utf8");

    console.log("📊 La Liga HelloTickets Coverage Report");
    console.log("---------------------------------------");
    console.log(`Total performances: ${performances.length}`);
    console.log(`Matched events: ${categories.matched.length}`);
    console.log(
      `Unknown teams / competitions: ${categories.unknownTeams.length}`
    );
    console.log(`Missing in DB: ${categories.missingInDb.length}`);
    console.log(`Past events skipped: ${categories.pastEvents.length}`);
    console.log(`Report saved to: ${OUTPUT_REPORT}`);

    if (categories.unknownTeams.length > 0) {
      console.log("\n⚠️  Unknown teams / competitions examples:");
      categories.unknownTeams.slice(0, 10).forEach((item) => {
        console.log(
          ` - ${item.name} (HT ID ${item.id}) teams: ${JSON.stringify(
            item.teams || item.reason
          )}`
        );
      });
      if (categories.unknownTeams.length > 10) {
        console.log(`   ...and ${categories.unknownTeams.length - 10} more`);
      }
    }

    if (categories.missingInDb.length > 0) {
      console.log("\n⚠️  Performances not found in DB:");
      categories.missingInDb.slice(0, 10).forEach((item) => {
        console.log(
          ` - ${item.name} (${item.date}) teams: ${item.teams.join(" vs ")}`
        );
      });
      if (categories.missingInDb.length > 10) {
        console.log(`   ...and ${categories.missingInDb.length - 10} more`);
      }
    }
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
