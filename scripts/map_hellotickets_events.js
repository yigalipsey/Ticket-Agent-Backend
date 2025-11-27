import "dotenv/config";
import mongoose from "mongoose";
import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";
import Team from "../src/models/Team.js";
import FootballEvent from "../src/models/FootballEvent.js";
import Supplier from "../src/models/Supplier.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// API Configuration
const API_KEY = "pub-6a76dc10-12e5-466e-83d5-35b745c485a2";
const API_URL = "https://api-live.hellotickets.com/v1";

// Configuration
const DRY_RUN = true; // Set to true to preview without saving

// Paths
const TEAMS_JSON_PATH = path.resolve(
  __dirname,
  "../data/premier_league_teams_hellotickets.json"
);
const CHAMPIONS_LEAGUE_TEAMS_PATH = path.resolve(
  __dirname,
  "../data/champions_league_teams_hellotickets.json"
);
const PREMIER_LEAGUE_MATCHES_PATH = path.resolve(
  __dirname,
  "../data/premier_league_matches_hellotickets.json"
);
const CHAMPIONS_LEAGUE_MATCHES_PATH = path.resolve(
  __dirname,
  "../data/champions_league_matches_hellotickets.json"
);

// Function to detect competition type from event name
function detectCompetition(eventName) {
  const name = eventName.toLowerCase();
  if (name.includes("champions league")) {
    return "champions_league";
  }
  if (name.includes("europa league")) {
    return "europa_league";
  }
  if (name.includes("fa cup")) {
    return "fa_cup";
  }
  if (name.includes("carabao cup") || name.includes("league cup")) {
    return "carabao_cup";
  }
  if (name.includes("premier league")) {
    return "premier_league";
  }
  // Default to premier_league if no specific competition mentioned
  return "premier_league";
}

async function connectDB() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined in .env");
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB");
}

async function fetchPerformerPerformances(performerId) {
  try {
    const { data } = await axios.get(`${API_URL}/performances`, {
      params: {
        performer_id: performerId,
        category_id: 1, // Sports
        limit: 100,
        page: 1,
        is_sellable: true,
      },
      headers: {
        Accept: "application/json",
        "X-Public-Key": API_KEY,
      },
    });
    return data.performances || [];
  } catch (error) {
    console.error(
      `❌ Error fetching events for performer ${performerId}:`,
      error.message
    );
    return [];
  }
}

async function processTeam(teamJson, htIdToLocalId, supplierId) {
  const targetLocalTeam = await Team.findOne({ slug: teamJson.slug });
  if (!targetLocalTeam) {
    console.log(`⚠️  Team '${teamJson.slug}' not found in DB, skipping...`);
    return { matchesToSave: [], unknownOpponents: [], allMatches: [] };
  }

  console.log(
    `\n🔍 Scanning schedule for: ${teamJson.name_en} (HT ID: ${teamJson.helloTicketsId})`
  );

  // Fetch Schedule
  const performances = await fetchPerformerPerformances(
    teamJson.helloTicketsId
  );
  console.log(`Found ${performances.length} events on Hello Tickets.`);

  const matchesToSave = [];
  const unknownOpponents = [];
  const allMatches = []; // Collect ALL matches from HelloTickets

  for (const perf of performances) {
    const eventDate = new Date(perf.start_date.date_time);

    // Find the opponent in the performers list
    const opponentPerf = perf.performers.find(
      (p) =>
        p.id.toString() !== teamJson.helloTicketsId &&
        p.name !== "UEFA Champions League"
    );

    if (!opponentPerf) continue;

    // Collect ALL match data from HelloTickets (regardless of whether we found it in DB)
    const competitionType = detectCompetition(perf.name);
    const matchData = {
      htPerformanceId: perf.id.toString(),
      eventName: perf.name,
      eventDate: eventDate.toISOString().split("T")[0],
      eventDateTime: perf.start_date.date_time,
      competition: competitionType,
      homeTeam: perf.performers.find(
        (p) => p.id.toString() === teamJson.helloTicketsId
      )?.name,
      homeTeamHtId: teamJson.helloTicketsId,
      homeTeamSlug: teamJson.slug,
      awayTeam: opponentPerf.name,
      awayTeamHtId: opponentPerf.id.toString(),
      venue: perf.venue?.name || null,
      venueCity: perf.venue?.city || null,
      venueAddress: perf.venue?.address || null,
    };

    let opponentLocalId = htIdToLocalId[opponentPerf.id.toString()];
    let localEvent = null;
    let status = "❓ Unknown Opponent";
    let dateDifference = "N/A";

    // If we know the opponent, try to find the local event
    if (opponentLocalId) {
      // First try with date range ±24 hours
      const dateStart = new Date(eventDate);
      dateStart.setHours(dateStart.getHours() - 24);
      const dateEnd = new Date(eventDate);
      dateEnd.setHours(dateEnd.getHours() + 24);

      localEvent = await FootballEvent.findOne({
        $or: [
          { homeTeam: targetLocalTeam._id, awayTeam: opponentLocalId },
          { homeTeam: opponentLocalId, awayTeam: targetLocalTeam._id },
        ],
        date: { $gte: dateStart, $lte: dateEnd },
      });

      if (localEvent) {
        status = "✅ MATCH FOUND";
        // Calculate date difference in hours
        const diffHours = Math.abs(
          (eventDate - new Date(localEvent.date)) / (1000 * 60 * 60)
        );
        if (diffHours > 1) {
          dateDifference = `${diffHours.toFixed(1)} hours`;
        }
      } else {
        // Try without date restriction to find similar matches with different dates
        localEvent = await FootballEvent.findOne({
          $or: [
            { homeTeam: targetLocalTeam._id, awayTeam: opponentLocalId },
            { homeTeam: opponentLocalId, awayTeam: targetLocalTeam._id },
          ],
        });

        if (localEvent) {
          status = "⚠️ MATCH FOUND - DATE DIFFERENT";
          // Calculate date difference
          const diffMs = eventDate - new Date(localEvent.date);
          const diffHours = Math.abs(diffMs / (1000 * 60 * 60));
          const diffDays = Math.abs(diffMs / (1000 * 60 * 60 * 24));

          if (diffDays >= 1) {
            dateDifference = `${diffDays.toFixed(1)} days`;
          } else {
            dateDifference = `${diffHours.toFixed(1)} hours`;
          }
        } else {
          status = "❌ Event Not Found in DB";
        }
      }
    } else {
      // Unknown opponent - check if it's a Champions League match
      const competitionType = detectCompetition(perf.name);
      const isChampionsLeague = competitionType === "champions_league";

      if (isChampionsLeague) {
        // Check if we already have this opponent
        const existingOpponent = unknownOpponents.find(
          (o) => o.helloTicketsId === opponentPerf.id.toString()
        );

        const matchInfo = {
          eventName: perf.name,
          eventDate: eventDate.toISOString().split("T")[0],
          eventDateTime: perf.start_date.date_time,
          htPerformanceId: perf.id.toString(),
          homeTeam: perf.performers.find(
            (p) => p.id.toString() === teamJson.helloTicketsId
          )?.name,
          homeTeamHtId: teamJson.helloTicketsId,
          homeTeamSlug: teamJson.slug,
          awayTeam: opponentPerf.name,
          awayTeamHtId: opponentPerf.id.toString(),
          venue: perf.venue?.name || null,
          venueCity: perf.venue?.city || null,
        };

        if (!existingOpponent) {
          unknownOpponents.push({
            helloTicketsId: opponentPerf.id.toString(),
            helloTicketsName: opponentPerf.name,
            matches: [matchInfo],
          });
        } else {
          existingOpponent.matches.push(matchInfo);
        }
      }
    }

    // Add mapping info to match data
    matchData.localEventId = localEvent ? localEvent._id.toString() : null;
    matchData.localEventSlug = localEvent ? localEvent.slug : null;
    matchData.localEventDate = localEvent
      ? new Date(localEvent.date).toISOString().split("T")[0]
      : null;
    matchData.mappingStatus = status;
    matchData.dateDifference = dateDifference;
    matchData.opponentLocalId = opponentLocalId
      ? opponentLocalId.toString()
      : null;

    // Add to all matches collection
    allMatches.push(matchData);

    // If we found a match, add it to the list to save
    if (localEvent) {
      matchesToSave.push({
        localEvent,
        htPerformanceId: perf.id.toString(),
        htEventName: perf.name,
        htDate: eventDate.toISOString().split("T")[0],
        localDate: new Date(localEvent.date).toISOString().split("T")[0],
        status,
        dateDifference,
        teamName: teamJson.name_en,
        opponentName: opponentPerf.name,
      });
    }
  }

  return { matchesToSave, unknownOpponents, allMatches };
}

async function saveMappings(matchesToSave, supplierId) {
  let saved = 0;
  let updated = 0;
  let skipped = 0;

  for (const match of matchesToSave) {
    try {
      const { localEvent, htPerformanceId } = match;

      // Check if mapping already exists
      const existingMapping = localEvent.supplierExternalIds?.find(
        (m) =>
          m.supplierRef.toString() === supplierId.toString() &&
          m.supplierExternalId === htPerformanceId
      );

      if (existingMapping) {
        skipped++;
        continue;
      }

      // Remove old mapping for this supplier if exists
      if (!localEvent.supplierExternalIds) {
        localEvent.supplierExternalIds = [];
      }

      localEvent.supplierExternalIds = localEvent.supplierExternalIds.filter(
        (m) => m.supplierRef.toString() !== supplierId.toString()
      );

      // Add new mapping
      localEvent.supplierExternalIds.push({
        supplierRef: supplierId,
        supplierExternalId: htPerformanceId,
        metadata: {
          htEventName: match.htEventName,
          mappedAt: new Date(),
        },
      });

      await localEvent.save();
      saved++;
    } catch (error) {
      console.error(
        `❌ Error saving mapping for event ${match.localEvent._id}:`,
        error.message
      );
      skipped++;
    }
  }

  return { saved, updated, skipped };
}

async function run() {
  try {
    await connectDB();

    // 1. Find HelloTickets Supplier
    const supplier = await Supplier.findOne({ slug: "hellotickets" });
    if (!supplier) {
      throw new Error("HelloTickets supplier not found in database");
    }
    console.log(`✅ Found supplier: ${supplier.name} (${supplier._id})`);

    // 2. Load Teams JSON & Build Map
    const teamsData = JSON.parse(fs.readFileSync(TEAMS_JSON_PATH, "utf8"));
    const htIdToLocalId = {};

    // Load known mappings
    for (const teamJson of teamsData.teams) {
      const team = await Team.findOne({ slug: teamJson.slug });
      if (team) {
        htIdToLocalId[teamJson.helloTicketsId] = team._id;
      }
    }

    console.log(`\n📋 Processing ${teamsData.teams.length} teams...\n`);

    // 3. Process each team and collect matches
    const allMatchesToSave = [];
    const allUnknownOpponents = new Map(); // Use Map to avoid duplicates
    const matchesByCompetition = {
      premier_league: [],
      champions_league: [],
      europa_league: [],
      fa_cup: [],
      carabao_cup: [],
      other: [],
    };

    for (const teamJson of teamsData.teams) {
      const { matchesToSave, unknownOpponents, allMatches } = await processTeam(
        teamJson,
        htIdToLocalId,
        supplier._id
      );
      allMatchesToSave.push(...matchesToSave);

      // Sort matches by competition type
      for (const match of allMatches) {
        const competition = match.competition || "other";
        if (matchesByCompetition[competition]) {
          matchesByCompetition[competition].push(match);
        } else {
          matchesByCompetition.other.push(match);
        }
      }

      // Collect unknown opponents (Champions League teams)
      for (const opponent of unknownOpponents) {
        const key = opponent.helloTicketsId;
        if (allUnknownOpponents.has(key)) {
          // Merge matches
          const existing = allUnknownOpponents.get(key);
          existing.matches.push(...opponent.matches);
        } else {
          allUnknownOpponents.set(key, opponent);
        }
      }
    }

    // 4. Display summary table
    console.log(
      `\n\n📊 SUMMARY - Found ${allMatchesToSave.length} matches to map:\n`
    );
    const summaryTable = allMatchesToSave.map((match, idx) => ({
      "#": idx + 1,
      Team: match.teamName,
      Opponent: match.opponentName,
      "HT Date": match.htDate,
      "Local Date": match.localDate,
      "Date Diff": match.dateDifference,
      Status: match.status,
      "HT ID": match.htPerformanceId,
      "Local Event": match.localEvent.slug,
    }));

    console.table(summaryTable);

    // 5. Show statistics
    const stats = {
      found: allMatchesToSave.length,
      "date-different": allMatchesToSave.filter((m) =>
        m.status.includes("DATE DIFFERENT")
      ).length,
      "date-ok": allMatchesToSave.filter(
        (m) => !m.status.includes("DATE DIFFERENT")
      ).length,
    };

    console.log(`\n📈 Statistics:`);
    console.log(`   ✅ Matches found: ${stats.found}`);
    console.log(`   ⚠️  With date difference: ${stats["date-different"]}`);
    console.log(`   ✅ Date matches: ${stats["date-ok"]}`);
    console.log(
      `   🌍 Champions League teams found: ${allUnknownOpponents.size}`
    );

    // 6. Save matches by competition to separate JSON files
    const formatMatchData = (matches, competitionName) => ({
      fetched_at: new Date().toISOString(),
      competition: competitionName,
      total_matches: matches.length,
      matches: matches.map((match) => ({
        htPerformanceId: match.htPerformanceId,
        eventName: match.eventName,
        eventDate: match.eventDate,
        eventDateTime: match.eventDateTime,
        homeTeam: {
          name: match.homeTeam,
          helloTicketsId: match.homeTeamHtId,
          slug: match.homeTeamSlug,
        },
        awayTeam: {
          name: match.awayTeam,
          helloTicketsId: match.awayTeamHtId,
        },
        venue: {
          name: match.venue,
          city: match.venueCity,
          address: match.venueAddress,
        },
        // Mapping info (if found in local DB)
        localEventId: match.localEventId,
        localEventSlug: match.localEventSlug,
        localEventDate: match.localEventDate,
        mappingStatus: match.mappingStatus,
        dateDifference: match.dateDifference,
        opponentLocalId: match.opponentLocalId,
      })),
    });

    // Save Premier League matches
    if (matchesByCompetition.premier_league.length > 0) {
      const premierLeagueData = formatMatchData(
        matchesByCompetition.premier_league,
        "Premier League"
      );
      fs.writeFileSync(
        PREMIER_LEAGUE_MATCHES_PATH,
        JSON.stringify(premierLeagueData, null, 2),
        "utf8"
      );
      console.log(
        `\n💾 Saved ${matchesByCompetition.premier_league.length} Premier League matches to: ${PREMIER_LEAGUE_MATCHES_PATH}`
      );
    }

    // Save Champions League matches
    if (matchesByCompetition.champions_league.length > 0) {
      const championsLeagueData = formatMatchData(
        matchesByCompetition.champions_league,
        "Champions League"
      );
      fs.writeFileSync(
        CHAMPIONS_LEAGUE_MATCHES_PATH,
        JSON.stringify(championsLeagueData, null, 2),
        "utf8"
      );
      console.log(
        `\n💾 Saved ${matchesByCompetition.champions_league.length} Champions League matches to: ${CHAMPIONS_LEAGUE_MATCHES_PATH}`
      );
    }

    // Save other competitions
    const competitionPaths = {
      europa_league: path.resolve(
        __dirname,
        "../data/europa_league_matches_hellotickets.json"
      ),
      fa_cup: path.resolve(
        __dirname,
        "../data/fa_cup_matches_hellotickets.json"
      ),
      carabao_cup: path.resolve(
        __dirname,
        "../data/carabao_cup_matches_hellotickets.json"
      ),
      other: path.resolve(__dirname, "../data/other_matches_hellotickets.json"),
    };

    const competitionNames = {
      europa_league: "Europa League",
      fa_cup: "FA Cup",
      carabao_cup: "Carabao Cup",
      other: "Other",
    };

    for (const [competition, filePath] of Object.entries(competitionPaths)) {
      if (matchesByCompetition[competition].length > 0) {
        const competitionData = formatMatchData(
          matchesByCompetition[competition],
          competitionNames[competition]
        );
        fs.writeFileSync(
          filePath,
          JSON.stringify(competitionData, null, 2),
          "utf8"
        );
        console.log(
          `\n💾 Saved ${matchesByCompetition[competition].length} ${competitionNames[competition]} matches to: ${filePath}`
        );
      }
    }

    // 7. Save Champions League teams and matches to file
    if (allUnknownOpponents.size > 0) {
      const allMatches = [];
      Array.from(allUnknownOpponents.values()).forEach((opponent) => {
        allMatches.push(...opponent.matches);
      });

      const championsLeagueData = {
        fetched_at: new Date().toISOString(),
        teams: {
          total: allUnknownOpponents.size,
          list: Array.from(allUnknownOpponents.values()).map((opponent) => ({
            helloTicketsId: opponent.helloTicketsId,
            helloTicketsName: opponent.helloTicketsName,
            matches_count: opponent.matches.length,
          })),
        },
        matches: {
          total: allMatches.length,
          list: allMatches.map((match) => ({
            htPerformanceId: match.htPerformanceId,
            eventName: match.eventName,
            eventDate: match.eventDate,
            eventDateTime: match.eventDateTime,
            homeTeam: {
              name: match.homeTeam,
              helloTicketsId: match.homeTeamHtId,
              slug: match.homeTeamSlug,
            },
            awayTeam: {
              name: match.awayTeam,
              helloTicketsId: match.awayTeamHtId,
            },
            venue: {
              name: match.venue,
              city: match.venueCity,
            },
          })),
        },
      };

      fs.writeFileSync(
        CHAMPIONS_LEAGUE_TEAMS_PATH,
        JSON.stringify(championsLeagueData, null, 2),
        "utf8"
      );

      console.log(
        `\n💾 Saved Champions League data to: ${CHAMPIONS_LEAGUE_TEAMS_PATH}`
      );
      console.log(`   📋 Teams: ${allUnknownOpponents.size}`);
      console.log(`   ⚽ Matches: ${allMatches.length}`);
      console.log("\n📋 Champions League teams found:");
      Array.from(allUnknownOpponents.values()).forEach((opponent) => {
        console.log(
          `   - ${opponent.helloTicketsName} (ID: ${opponent.helloTicketsId}) - ${opponent.matches.length} match(es)`
        );
      });
    }

    // 6. Ask for confirmation before saving
    if (!DRY_RUN && allMatchesToSave.length > 0) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise((resolve) => {
        rl.question(
          `\n❓ Do you want to save ${allMatchesToSave.length} mappings to database? (yes/no): `,
          resolve
        );
      });

      rl.close();

      if (answer.toLowerCase() === "yes" || answer.toLowerCase() === "y") {
        console.log(
          `\n💾 Saving ${allMatchesToSave.length} mappings to database...`
        );
        const result = await saveMappings(allMatchesToSave, supplier._id);
        console.log(`\n✅ Saved: ${result.saved}`);
        console.log(`⏭️  Skipped (already exists): ${result.skipped}`);
      } else {
        console.log("\n❌ Save cancelled by user.");
      }
    } else if (DRY_RUN) {
      console.log("\n⚠️  DRY RUN MODE: No changes were made to the database.");
    } else {
      console.log("\n⚠️  No matches found to save.");
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
