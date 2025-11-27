import dotenv from "dotenv";
import axios from "axios";
import Team from "../src/models/Team.js";
import Venue from "../src/models/Venue.js";
import League from "../src/models/League.js";
import databaseConnection from "../src/config/database.js";

dotenv.config();

// API Football configuration
const API_FOOTBALL_BASE_URL =
  process.env.API_FOOTBALL_BASE_URL || "https://v3.football.api-sports.io";
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;

if (!API_FOOTBALL_KEY) {
  console.error("❌ API_FOOTBALL_KEY not found in environment variables");
  process.exit(1);
}

// API Football client
const apiClient = axios.create({
  baseURL: API_FOOTBALL_BASE_URL,
  headers: {
    "x-rapidapi-key": API_FOOTBALL_KEY,
    "x-rapidapi-host": "v3.football.api-sports.io",
  },
  timeout: 30000,
});

// Ligue 1 configuration
const LIGUE1_API_FOOTBALL_ID = 61; // API-Football league ID for Ligue 1
const CURRENT_SEASON = 2025;

// Country translations
const countryTranslations = {
  England: "אנגליה",
  Spain: "ספרד",
  Germany: "גרמניה",
  Italy: "איטליה",
  France: "צרפת",
  Greece: "יוון",
  Scotland: "סקוטלנד",
  "Czech Republic": "צ'כיה",
  Portugal: "פורטוגל",
  Cyprus: "קפריסין",
  Austria: "אוסטריה",
  Poland: "פולין",
  Norway: "נורווגיה",
  Sweden: "שוודיה",
  Netherlands: "הולנד",
  Belgium: "בלגיה",
  Switzerland: "שוויץ",
  Moldova: "מולדובה",
  Azerbaijan: "אזרבייג'ן",
  Israel: "ישראל",
  Europe: "אירופה",
  Ukraine: "אוקראינה",
  Russia: "רוסיה",
  Turkey: "טורקיה",
  Croatia: "קרואטיה",
  Serbia: "סרביה",
  Romania: "רומניה",
  Hungary: "הונגריה",
  Slovakia: "סלובקיה",
  Slovenia: "סלובניה",
  Denmark: "דנמרק",
  Finland: "פינלנד",
  Ireland: "אירלנד",
  Wales: "ויילס",
  "Northern Ireland": "צפון אירלנד",
  "Bosnia-Herzegovina": "בוסניה והרצגובינה",
  Bosnia: "בוסניה",
  Herzegovina: "הרצגובינה",
  "North Macedonia": "צפון מקדוניה",
  Macedonia: "מקדוניה",
  Kosovo: "קוסובו",
  Malta: "מלטה",
  Kazakhstan: "קזחסטן",
  Belarus: "בלארוס",
  Iceland: "איסלנד",
  Lichtenstein: "לטנשטיין",
  Armenia: "ארמניה",
  Georgia: "גאורגיה",
  Albania: "אלבניה",
  Montenegro: "מונטנגרו",
  Latvia: "לטביה",
  Lithuania: "ליטא",
  Estonia: "אסטוניה",
};

// Translate country to Hebrew
function translateCountry(country) {
  return countryTranslations[country] || country;
}

// Team name translations
const teamNameTranslations = {
  "Paris Saint Germain": "פריז סן ז'רמן",
  "PSG": "פריז סן ז'רמן",
  "Paris SG": "פריז סן ז'רמן",
  "Olympique Marseille": "אולימפיק מרסיי",
  "Olympique Lyon": "אולימפיק ליון",
  "AS Monaco": "מונקו",
  "Monaco": "מונקו",
  "Lille OSC": "ליל",
  "Lille": "ליל",
  "OGC Nice": "ניס",
  "Nice": "ניס",
  "RC Lens": "לאנס",
  "Lens": "לאנס",
  "Olympique Nimes": "נים",
  "Stade Rennais": "רן",
  "Rennes": "רן",
  "FC Nantes": "נאנט",
  "Nantes": "נאנט",
  "Montpellier HSC": "מונפלייה",
  "Montpellier": "מונפלייה",
  "RC Strasbourg": "שטרסבורג",
  "Strasbourg": "שטרסבורג",
  "Stade Reims": "ריימס",
  "Reims": "ריימס",
  "FC Lorient": "לוריאן",
  "Lorient": "לוריאן",
  "Clermont Foot": "קלרמון",
  "Clermont": "קלרמון",
  "FC Metz": "מץ",
  "Metz": "מץ",
  "Le Havre AC": "לה האבר",
  "Le Havre": "לה האבר",
  "Toulouse FC": "טולוז",
  "Toulouse": "טולוז",
  "FC Bordeaux": "בורדו",
  "Bordeaux": "בורדו",
  "AS Saint-Étienne": "סנט אטיין",
  "Saint-Étienne": "סנט אטיין",
  "Angers SCO": "אנג'ה",
  "Angers": "אנג'ה",
  "Troyes AC": "טרואה",
  "Troyes": "טרואה",
  "AJ Auxerre": "אוסר",
  "Auxerre": "אוסר",
  "AC Ajaccio": "אז'אקסיו",
  "Ajaccio": "אז'אקסיו",
  "Stade Brestois": "ברסט",
  "Brest": "ברסט",
};

// Translate team name to Hebrew
function translateTeamName(name) {
  // Try exact match first
  if (teamNameTranslations[name]) {
    return teamNameTranslations[name];
  }

  // Try partial match
  for (const [key, value] of Object.entries(teamNameTranslations)) {
    if (name.includes(key) || key.includes(name)) {
      return value;
    }
  }

  return undefined;
}

// Generate slug from team name
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 100);
}

// Step 1: Find existing teams for Ligue 1
async function findExistingTeams() {
  try {
    console.log("=".repeat(80));
    console.log("📍 STEP 1: Finding existing teams for Ligue 1");
    console.log("=".repeat(80));
    console.log("");

    // Find the league
    const league = await League.findOne({
      $or: [
        { slug: "ligue-1" },
        { "externalIds.apiFootball": LIGUE1_API_FOOTBALL_ID },
      ],
    });

    if (!league) {
      console.log("❌ Ligue 1 not found in database");
      console.log("   Please run create_ligue1_league.js first");
      return [];
    }

    console.log(`✅ Found league: ${league.name} (${league.nameHe || "N/A"})`);
    console.log("");

    // Find all teams in this league
    const teams = await Team.find({ leagueIds: league._id })
      .populate("venueId")
      .lean();

    console.log(
      `📊 Found ${teams.length} existing teams in Ligue 1`
    );
    console.log("");

    if (teams.length > 0) {
      console.log("🏟️  Existing teams:");
      teams.forEach((team, index) => {
        console.log(
          `${index + 1}. ${team.name_en || team.name} (${team.name})`
        );
        console.log(`   Code: ${team.code}`);
        console.log(
          `   Country: ${team.country_en}${
            team.country_he ? ` (${team.country_he})` : ""
          }`
        );
        console.log(`   Team ID: ${team.teamId}`);
        console.log(
          `   API-Football ID: ${team.apiFootballId || team.externalIds?.apiFootball || "N/A"}`
        );
        console.log("");
      });
    }

    console.log("=".repeat(80));
    console.log("");

    return teams;
  } catch (error) {
    console.error("❌ Error finding existing teams:", error.message);
    throw error;
  }
}

// Step 2: Fetch teams from API-Football
async function fetchTeamsFromAPI() {
  try {
    console.log("=".repeat(80));
    console.log("📍 STEP 2: Fetching teams from API-Football");
    console.log("=".repeat(80));
    console.log("");

    console.log(
      `🔍 Fetching teams for Ligue 1 (ID: ${LIGUE1_API_FOOTBALL_ID}, Season: ${CURRENT_SEASON})...`
    );
    console.log("");

    const teamsResponse = await apiClient.get("/teams", {
      params: {
        league: LIGUE1_API_FOOTBALL_ID,
        season: CURRENT_SEASON,
      },
    });

    if (
      !teamsResponse.data ||
      !teamsResponse.data.response ||
      teamsResponse.data.response.length === 0
    ) {
      console.log("❌ No teams found in API response");
      return [];
    }

    console.log(
      `✅ Found ${teamsResponse.data.response.length} teams in API response`
    );
    console.log("");

    return teamsResponse.data.response;
  } catch (error) {
    console.error("❌ Error fetching teams from API:", error.message);
    if (error.response) {
      console.error("API Response:", error.response.data);
    }
    throw error;
  }
}

// Step 3: Insert new teams
async function insertNewTeams(apiTeams, existingTeams, league) {
  try {
    console.log("=".repeat(80));
    console.log("📍 STEP 3: Inserting new teams");
    console.log("=".repeat(80));
    console.log("");

    // Create set of existing API-Football IDs
    const existingApiIds = new Set();
    const existingTeamIds = new Set();
    existingTeams.forEach((team) => {
      if (team.apiFootballId) {
        existingApiIds.add(team.apiFootballId);
      }
      if (team.externalIds?.apiFootball) {
        existingApiIds.add(team.externalIds.apiFootball);
      }
      if (team.teamId) {
        existingTeamIds.add(team.teamId);
      }
    });

    console.log(
      `📊 Existing teams in database: ${existingApiIds.size} with API-Football IDs`
    );
    console.log("");

    const newTeams = [];
    const skippedTeams = [];
    const updatedTeams = [];

    for (const item of apiTeams) {
      const teamData = item.team;
      const venueData = item.venue;
      const apiFootballId = teamData.id;

      // Check if team already exists by API-Football ID
      const existingByApiId = await Team.findOne({
        $or: [
          { apiFootballId: apiFootballId },
          { "externalIds.apiFootball": apiFootballId },
        ],
      });

      // Check if team exists by teamId
      const existingByTeamId = await Team.findOne({
        teamId: apiFootballId,
      });

      const existingTeam = existingByApiId || existingByTeamId;

      if (existingTeam) {
        // Check if team needs to be added to this league
        const leagueIdStr = league._id.toString();
        const hasLeague = existingTeam.leagueIds.some(
          (lid) => lid.toString() === leagueIdStr
        );

        if (!hasLeague) {
          // Add league to team
          existingTeam.leagueIds.push(league._id);
          await Team.findByIdAndUpdate(existingTeam._id, {
            leagueIds: existingTeam.leagueIds,
          });

          // Update Hebrew name if missing or same as English
          const updateData = {};
          if (
            !existingTeam.name ||
            existingTeam.name === existingTeam.name_en
          ) {
            const nameHe = translateTeamName(teamData.name);
            if (nameHe) {
              updateData.name = nameHe;
            }
          }
          if (
            !existingTeam.country_he ||
            existingTeam.country_en === "Unknown"
          ) {
            const countryEn = teamData.country || "France";
            const countryHe = translateCountry(countryEn);
            if (countryEn !== "Unknown") {
              updateData.country_en = countryEn;
            }
            updateData.country_he = countryHe;
          }

          if (Object.keys(updateData).length > 0) {
            await Team.findByIdAndUpdate(existingTeam._id, updateData);
          }

          updatedTeams.push({
            name: teamData.name,
            id: apiFootballId,
            reason: "Added to league and updated translations",
          });
          continue;
        }

        skippedTeams.push({
          name: teamData.name,
          id: apiFootballId,
          reason: "Already exists and already in league",
        });
        continue;
      }

      // Find or create venue
      let venue = null;
      if (venueData && venueData.id) {
        venue = await Venue.findOne({
          $or: [
            { venueId: venueData.id },
            { "externalIds.apiFootball": venueData.id },
          ],
        });

        if (!venue) {
          console.log(
            `⚠️  Venue not found for team ${teamData.name}: ${venueData.name} (ID: ${venueData.id})`
          );
          console.log("   Please run create_ligue1_venues.js first");
          skippedTeams.push({
            name: teamData.name,
            id: apiFootballId,
            reason: "Venue not found in database",
          });
          continue;
        }
      } else {
        console.log(`⚠️  No venue data for team ${teamData.name}`);
        skippedTeams.push({
          name: teamData.name,
          id: apiFootballId,
          reason: "No venue data",
        });
        continue;
      }

      // Prepare team data
      const countryEn = teamData.country || "France";
      const countryHe = translateCountry(countryEn);

      const nameEn = teamData.name || "Unknown Team";
      const nameHe = translateTeamName(nameEn);

      const code = teamData.code || "N/A";
      const slug = generateSlug(nameEn);

      // Check if slug already exists
      const existingSlug = await Team.findOne({ slug });
      const finalSlug = existingSlug ? `${slug}-${apiFootballId}` : slug;

      const teamDataNew = {
        name: nameHe || nameEn, // Required field - use Hebrew name if available, otherwise English
        name_en: nameEn,
        code: code,
        slug: finalSlug,
        country_en: countryEn,
        country_he: countryHe,
        logoUrl: teamData.logo || undefined,
        teamId: apiFootballId,
        venueId: venue._id,
        leagueIds: [league._id],
        apiFootballId: apiFootballId,
        externalIds: {
          apiFootball: apiFootballId,
        },
      };

      newTeams.push({
        data: teamDataNew,
        venueName: venueData.name,
      });
    }

    console.log(`📊 Analysis:`);
    console.log(`   Total teams from API: ${apiTeams.length}`);
    console.log(`   Already exist in league: ${skippedTeams.length}`);
    console.log(`   Updated (added to league): ${updatedTeams.length}`);
    console.log(`   New teams to insert: ${newTeams.length}`);
    console.log("");

    if (updatedTeams.length > 0) {
      console.log("🔄 Updated teams (added to league):");
      updatedTeams.forEach((team, index) => {
        console.log(
          `   ${index + 1}. ${team.name} (ID: ${team.id}) - ${team.reason}`
        );
      });
      console.log("");
    }

    if (skippedTeams.length > 0) {
      console.log("⏭️  Skipped teams (already exist or missing venue):");
      skippedTeams.forEach((team, index) => {
        console.log(
          `   ${index + 1}. ${team.name} (ID: ${team.id}) - ${team.reason}`
        );
      });
      console.log("");
    }

    if (newTeams.length === 0) {
      console.log("✅ No new teams to insert. All teams already exist!");
      console.log("");
      return { inserted: 0, skipped: skippedTeams.length, updated: 0 };
    }

    console.log("🆕 New teams to insert:");
    newTeams.forEach((item, index) => {
      console.log(
        `   ${index + 1}. ${item.data.name_en}${
          item.data.name_he ? ` (${item.data.name_he})` : ""
        } (Country: ${item.data.country_en}${
          item.data.country_he ? ` / ${item.data.country_he}` : ""
        }, Venue: ${item.venueName})`
      );
    });
    console.log("");

    // Insert teams
    console.log("💾 Inserting teams into database...");
    console.log("");

    let insertedCount = 0;
    let errorCount = 0;

    for (const item of newTeams) {
      try {
        const team = new Team(item.data);
        await team.save();
        insertedCount++;
        console.log(
          `✅ [${insertedCount}/${newTeams.length}] Inserted: ${item.data.name_en} (ID: ${item.data.teamId}, Slug: ${item.data.slug})`
        );
      } catch (error) {
        errorCount++;
        console.error(
          `❌ Failed to insert ${item.data.name_en}: ${error.message}`
        );
        if (error.code === 11000) {
          console.error(
            `   Duplicate key error - team with slug "${item.data.slug}" or teamId ${item.data.teamId} may already exist`
          );
        }
      }
    }

    console.log("");
    console.log("=".repeat(80));
    console.log("📝 Summary:");
    console.log("=".repeat(80));
    console.log(`   Total teams from API: ${apiTeams.length}`);
    console.log(`   Already exist in league: ${skippedTeams.length}`);
    console.log(`   Updated (added to league): ${updatedTeams.length}`);
    console.log(`   Successfully inserted: ${insertedCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log("=".repeat(80));
    console.log("");

    return {
      inserted: insertedCount,
      updated: updatedTeams.length,
      skipped: skippedTeams.length,
      errors: errorCount,
    };
  } catch (error) {
    console.error("❌ Error inserting teams:", error.message);
    throw error;
  }
}

// Main function
async function main() {
  try {
    // Connect to database
    console.log("🔌 Connecting to database...");
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error("❌ MONGODB_URI not found in environment variables");
      process.exit(1);
    }

    const connected = await databaseConnection.connect(mongoUri);
    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }
    console.log("✅ Connected to database");
    console.log("");

    // Find the league
    const league = await League.findOne({
      $or: [
        { slug: "ligue-1" },
        { "externalIds.apiFootball": LIGUE1_API_FOOTBALL_ID },
      ],
    });

    if (!league) {
      console.log("❌ Ligue 1 not found in database");
      console.log("   Please run create_ligue1_league.js first");
      await databaseConnection.disconnect();
      process.exit(1);
    }

    // Step 1: Find existing teams
    const existingTeams = await findExistingTeams();

    // Step 2: Fetch teams from API
    const apiTeams = await fetchTeamsFromAPI();

    if (apiTeams.length === 0) {
      console.log("❌ No teams found in API response");
      await databaseConnection.disconnect();
      process.exit(0);
    }

    // Step 3: Insert new teams
    const result = await insertNewTeams(apiTeams, existingTeams, league);

    // Disconnect from database
    await databaseConnection.disconnect();
    console.log("✅ Disconnected from database");
    console.log("");

    console.log("🎉 Script completed successfully!");
    console.log("");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    if (databaseConnection.isDatabaseConnected()) {
      await databaseConnection.disconnect();
    }
    process.exit(1);
  }
}

// Run the script
main();


