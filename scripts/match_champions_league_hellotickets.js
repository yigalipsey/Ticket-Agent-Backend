import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";
import FootballEvent from "../src/models/FootballEvent.js";
import League from "../src/models/League.js";
import Supplier from "../src/models/Supplier.js";
import Team from "../src/models/Team.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const DRY_RUN = false; // Set to false to actually update DB

// Paths
const RAW_RESPONSE_PATH = path.resolve(
  __dirname,
  "../data/hellotickets/champions_league_raw_response.json"
);
const MAPPING_PATH = path.resolve(
  __dirname,
  "../data/hellotickets/champions-league-mapping.json"
);

async function connectDB() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined in .env");
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB");
}

/**
 * Load team mapping: HelloTickets ID -> Local Team ObjectId
 */
function loadTeamMapping() {
  const mappingData = JSON.parse(fs.readFileSync(MAPPING_PATH, "utf8"));
  const htIdToLocalId = new Map();
  const localIdToHtId = new Map();

  for (const team of mappingData) {
    if (team.hellotickets_id) {
      const htId = team.hellotickets_id.toString();
      const localId = team.id;
      htIdToLocalId.set(htId, localId);
      localIdToHtId.set(localId, htId);
    }
  }

  console.log(`📋 Loaded ${htIdToLocalId.size} team mappings`);
  return { htIdToLocalId, localIdToHtId };
}

/**
 * Load HelloTickets performances from raw response file
 */
function loadHelloTicketsPerformances() {
  const rawData = JSON.parse(fs.readFileSync(RAW_RESPONSE_PATH, "utf8"));
  const performances = rawData?.api_response?.performances || [];

  console.log(
    `📥 Loaded ${performances.length} performances from HelloTickets`
  );

  // Extract team IDs from each performance
  const enrichedPerformances = performances.map((perf) => {
    const teams = (perf.performers || []).filter(
      (p) => p.id?.toString() !== "12872" // Exclude UEFA Champions League performer
    );

    return {
      htPerformanceId: perf.id.toString(),
      eventName: perf.name,
      dateTime: perf.start_date?.date_time,
      venue: perf.venue?.name || null,
      teams: teams.map((t) => ({
        htId: t.id.toString(),
        name: t.name,
      })),
    };
  });

  return enrichedPerformances;
}

/**
 * Find matching HelloTickets performance for a DB event
 */
function findMatchingPerformance(dbEvent, htPerformances, htIdToLocalId) {
  // Handle both populated and non-populated teams
  const dbHomeTeamId = dbEvent.homeTeam._id
    ? dbEvent.homeTeam._id.toString()
    : dbEvent.homeTeam.toString();
  const dbAwayTeamId = dbEvent.awayTeam._id
    ? dbEvent.awayTeam._id.toString()
    : dbEvent.awayTeam.toString();
  const dbDate = new Date(dbEvent.date);

  // Date range: ±24 hours
  const dateStart = new Date(dbDate);
  dateStart.setHours(dateStart.getHours() - 24);
  const dateEnd = new Date(dbDate);
  dateEnd.setHours(dateEnd.getHours() + 24);

  for (const htPerf of htPerformances) {
    if (htPerf.teams.length !== 2) continue; // Must have exactly 2 teams

    const htTeam1Id = htPerf.teams[0].htId;
    const htTeam2Id = htPerf.teams[1].htId;

    const localTeam1Id = htIdToLocalId.get(htTeam1Id);
    const localTeam2Id = htIdToLocalId.get(htTeam2Id);

    if (!localTeam1Id || !localTeam2Id) continue; // Both teams must be in mapping

    // Check if teams match (home/away or away/home)
    const teamsMatch =
      (localTeam1Id === dbHomeTeamId && localTeam2Id === dbAwayTeamId) ||
      (localTeam1Id === dbAwayTeamId && localTeam2Id === dbHomeTeamId);

    if (!teamsMatch) continue;

    // Check date
    const htDate = new Date(htPerf.dateTime);
    if (htDate >= dateStart && htDate <= dateEnd) {
      // Calculate date difference
      const diffMs = Math.abs(htDate - dbDate);
      const diffHours = diffMs / (1000 * 60 * 60);

      return {
        htPerformanceId: htPerf.htPerformanceId,
        htEventName: htPerf.eventName,
        htDate: htDate.toISOString(),
        dbDate: dbDate.toISOString(),
        dateDifferenceHours: diffHours.toFixed(1),
        venue: htPerf.venue,
        matched: true,
      };
    }
  }

  return null;
}

/**
 * Save mappings to database
 */
async function saveMappings(matches, supplierId) {
  let saved = 0;
  let skipped = 0;
  let errors = 0;

  for (const match of matches) {
    try {
      const { dbEvent, htPerformanceId, htEventName } = match;

      // Check if mapping already exists
      const existingMapping = dbEvent.supplierExternalIds?.find(
        (m) =>
          m.supplierRef.toString() === supplierId.toString() &&
          m.supplierExternalId === htPerformanceId
      );

      if (existingMapping) {
        skipped++;
        continue;
      }

      // Remove old mapping for this supplier if exists
      if (!dbEvent.supplierExternalIds) {
        dbEvent.supplierExternalIds = [];
      }

      dbEvent.supplierExternalIds = dbEvent.supplierExternalIds.filter(
        (m) => m.supplierRef.toString() !== supplierId.toString()
      );

      // Add new mapping
      dbEvent.supplierExternalIds.push({
        supplierRef: supplierId,
        supplierExternalId: htPerformanceId,
        metadata: {
          htEventName: htEventName,
          mappedAt: new Date(),
        },
      });

      await dbEvent.save();
      saved++;
    } catch (error) {
      console.error(
        `❌ Error saving mapping for event ${match.dbEvent._id}:`,
        error.message
      );
      errors++;
    }
  }

  return { saved, skipped, errors };
}

async function run() {
  try {
    await connectDB();

    // 1. Find HelloTickets Supplier
    const supplier = await Supplier.findOne({ slug: "hellotickets" });
    if (!supplier) {
      throw new Error("HelloTickets supplier not found in database");
    }
    console.log(`✅ Found supplier: ${supplier.name} (${supplier._id})\n`);

    // 2. Find Champions League
    const championsLeague = await League.findOne({ slug: "champions-league" });
    if (!championsLeague) {
      throw new Error("Champions League not found in database");
    }
    console.log(
      `✅ Found league: ${championsLeague.name} (${championsLeague._id})\n`
    );

    // 3. Load team mapping
    const { htIdToLocalId } = loadTeamMapping();

    // 4. Load HelloTickets performances
    const htPerformances = loadHelloTicketsPerformances();

    // 5. Find all Champions League events in DB
    const dbEvents = await FootballEvent.find({
      league: championsLeague._id,
    })
      .populate("homeTeam", "name slug")
      .populate("awayTeam", "name slug")
      .lean();

    console.log(
      `\n🔍 Found ${dbEvents.length} Champions League events in DB\n`
    );

    // 6. Match events
    const matches = [];
    const unmatched = [];

    for (const dbEvent of dbEvents) {
      const match = findMatchingPerformance(
        dbEvent,
        htPerformances,
        htIdToLocalId
      );

      if (match) {
        matches.push({
          dbEvent: await FootballEvent.findById(dbEvent._id), // Get full document for saving
          htPerformanceId: match.htPerformanceId,
          htEventName: match.htEventName,
          htDate: match.htDate,
          dbDate: match.dbDate,
          dateDifferenceHours: match.dateDifferenceHours,
          venue: match.venue,
          homeTeam: dbEvent.homeTeam.name,
          awayTeam: dbEvent.awayTeam.name,
          slug: dbEvent.slug,
        });
      } else {
        unmatched.push({
          _id: dbEvent._id.toString(),
          slug: dbEvent.slug,
          homeTeam: dbEvent.homeTeam.name,
          awayTeam: dbEvent.awayTeam.name,
          date: new Date(dbEvent.date).toISOString(),
        });
      }
    }

    // 7. Display results
    console.log("=".repeat(80));
    console.log("📊 MATCHING RESULTS");
    console.log("=".repeat(80));
    console.log(`\n✅ Matches found: ${matches.length}`);
    console.log(`❌ Unmatched events: ${unmatched.length}\n`);

    if (matches.length > 0) {
      console.log("\n📋 MATCHED EVENTS:\n");
      const table = matches.map((match, idx) => ({
        "#": idx + 1,
        "DB Event": match.slug,
        "Home Team": match.homeTeam,
        "Away Team": match.awayTeam,
        "DB Date": new Date(match.dbDate).toISOString().split("T")[0],
        "HT Date": new Date(match.htDate).toISOString().split("T")[0],
        "Date Diff (h)": match.dateDifferenceHours,
        "HT ID": match.htPerformanceId,
      }));
      console.table(table);
    }

    if (unmatched.length > 0) {
      console.log("\n⚠️  UNMATCHED EVENTS:\n");
      const unmatchedTable = unmatched.map((event, idx) => ({
        "#": idx + 1,
        Slug: event.slug,
        "Home Team": event.homeTeam,
        "Away Team": event.awayTeam,
        Date: new Date(event.date).toISOString().split("T")[0],
      }));
      console.table(unmatchedTable);
    }

    // 8. Ask for confirmation before saving
    if (!DRY_RUN && matches.length > 0) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise((resolve) => {
        rl.question(
          `\n❓ Do you want to save ${matches.length} mappings to database? (yes/no): `,
          resolve
        );
      });

      rl.close();

      if (answer.toLowerCase() === "yes" || answer.toLowerCase() === "y") {
        console.log(`\n💾 Saving ${matches.length} mappings to database...`);
        const result = await saveMappings(matches, supplier._id);
        console.log(`\n✅ Saved: ${result.saved}`);
        console.log(`⏭️  Skipped (already exists): ${result.skipped}`);
        if (result.errors > 0) {
          console.log(`❌ Errors: ${result.errors}`);
        }
      } else {
        console.log("\n❌ Save cancelled by user.");
      }
    } else if (DRY_RUN) {
      console.log("\n⚠️  DRY RUN MODE: No changes were made to the database.");
      console.log("   Set DRY_RUN = false to enable database updates.");
    } else {
      console.log("\n⚠️  No matches found to save.");
    }
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
}

run();
