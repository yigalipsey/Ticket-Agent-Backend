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

// World Cup 2026 configuration
const WORLD_CUP_API_FOOTBALL_ID = 1; // API-Football league ID for World Cup
const CURRENT_SEASON = 2026;

// Country translations (for national teams)
const countryTranslations = {
  England: "אנגליה",
  Spain: "ספרד",
  Germany: "גרמניה",
  Italy: "איטליה",
  France: "צרפת",
  "United States": "ארצות הברית",
  "USA": "ארצות הברית",
  Canada: "קנדה",
  Mexico: "מקסיקו",
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
  Argentina: "ארגנטינה",
  Brazil: "ברזיל",
  "South Korea": "דרום קוריאה",
  "Korea Republic": "דרום קוריאה",
  Japan: "יפן",
  Australia: "אוסטרליה",
  "Saudi Arabia": "ערב הסעודית",
  Qatar: "קטר",
  Morocco: "מרוקו",
  Tunisia: "תוניסיה",
  Egypt: "מצרים",
  Senegal: "סנגל",
  Ghana: "גאנה",
  Nigeria: "ניגריה",
  Cameroon: "קמרון",
  "Ivory Coast": "חוף השנהב",
  "Costa Rica": "קוסטה ריקה",
  "Costa-Rica": "קוסטה ריקה",
  Ecuador: "אקוודור",
  Uruguay: "אורוגוואי",
  Paraguay: "פרגוואי",
  Chile: "צ'ילה",
  Colombia: "קולומביה",
  Peru: "פרו",
  Venezuela: "ונצואלה",
  Panama: "פנמה",
  Jamaica: "ג'מייקה",
  Honduras: "הונדורס",
  "El Salvador": "אל סלבדור",
  "Trinidad and Tobago": "טרינידד וטובגו",
  "New Zealand": "ניו זילנד",
  China: "סין",
  Iran: "איראן",
  "United Arab Emirates": "איחוד האמירויות",
  Oman: "עומאן",
  Iraq: "עיראק",
  Uzbekistan: "אוזבקיסטן",
};

// Translate country to Hebrew
function translateCountry(country) {
  return countryTranslations[country] || country;
}

// National team name translations
const teamNameTranslations = {
  "Argentina": "ארגנטינה",
  "Brazil": "ברזיל",
  "France": "צרפת",
  "Germany": "גרמניה",
  "Spain": "ספרד",
  "Italy": "איטליה",
  "England": "אנגליה",
  "Netherlands": "הולנד",
  "Belgium": "בלגיה",
  "Portugal": "פורטוגל",
  "Croatia": "קרואטיה",
  "Uruguay": "אורוגוואי",
  "Mexico": "מקסיקו",
  "United States": "ארצות הברית",
  "USA": "ארצות הברית",
  "Canada": "קנדה",
  "Japan": "יפן",
  "South Korea": "דרום קוריאה",
  "Korea Republic": "דרום קוריאה",
  "Australia": "אוסטרליה",
  "Morocco": "מרוקו",
  "Senegal": "סנגל",
  "Tunisia": "תוניסיה",
  "Egypt": "מצרים",
  "Ghana": "גאנה",
  "Nigeria": "ניגריה",
  "Cameroon": "קמרון",
  "Ivory Coast": "חוף השנהב",
  "Saudi Arabia": "ערב הסעודית",
  "Qatar": "קטר",
  "Iran": "איראן",
  "Ecuador": "אקוודור",
  "Costa Rica": "קוסטה ריקה",
  "Panama": "פנמה",
  "Poland": "פולין",
  "Denmark": "דנמרק",
  "Switzerland": "שוויץ",
  "Serbia": "סרביה",
  "Wales": "ויילס",
  "Ukraine": "אוקראינה",
  "Turkey": "טורקיה",
  "Sweden": "שוודיה",
  "Norway": "נורווגיה",
  "Austria": "אוסטריה",
  "Czech Republic": "צ'כיה",
  "Hungary": "הונגריה",
  "Scotland": "סקוטלנד",
  "Ireland": "אירלנד",
  "Greece": "יוון",
  "Romania": "רומניה",
  "Slovakia": "סלובקיה",
  "Slovenia": "סלובניה",
  "Finland": "פינלנד",
  "Iceland": "איסלנד",
  "Albania": "אלבניה",
  "North Macedonia": "צפון מקדוניה",
  "Bosnia-Herzegovina": "בוסניה והרצגובינה",
  "Israel": "ישראל",
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

// Step 1: Find existing teams for World Cup 2026
async function findExistingTeams() {
  try {
    console.log("=".repeat(80));
    console.log("📍 STEP 1: Finding existing teams for World Cup 2026");
    console.log("=".repeat(80));
    console.log("");

    // Find the league
    const league = await League.findOne({
      $or: [
        { slug: "world-cup-2026" },
        { "externalIds.apiFootball": WORLD_CUP_API_FOOTBALL_ID },
      ],
    });

    if (!league) {
      console.log("❌ World Cup 2026 not found in database");
      console.log("   Please run create_worldcup2026_league.js first");
      return [];
    }

    console.log(`✅ Found league: ${league.name} (${league.nameHe || "N/A"})`);
    console.log("");

    // Find all teams in this league
    const teams = await Team.find({ leagueIds: league._id })
      .populate("venueId")
      .lean();

    console.log(
      `📊 Found ${teams.length} existing teams in World Cup 2026`
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

// Step 2: Fetch teams from API-Football (from fixtures)
async function fetchTeamsFromAPI() {
  try {
    console.log("=".repeat(80));
    console.log("📍 STEP 2: Fetching teams from API-Football");
    console.log("=".repeat(80));
    console.log("");

    console.log(
      `🔍 Fetching fixtures for World Cup 2026 (ID: ${WORLD_CUP_API_FOOTBALL_ID}, Season: ${CURRENT_SEASON})...`
    );
    console.log("");

    // Fetch fixtures to extract teams
    const fixturesResponse = await apiClient.get("/fixtures", {
      params: {
        league: WORLD_CUP_API_FOOTBALL_ID,
        season: CURRENT_SEASON,
      },
    });

    if (
      !fixturesResponse.data ||
      !fixturesResponse.data.response ||
      fixturesResponse.data.response.length === 0
    ) {
      console.log("❌ No fixtures found in API response");
      return [];
    }

    console.log(
      `✅ Found ${fixturesResponse.data.response.length} fixtures in API response`
    );
    console.log("");

    // Extract unique teams from fixtures
    const teamsMap = new Map();
    fixturesResponse.data.response.forEach((fixture) => {
      const homeTeam = fixture.teams?.home;
      const awayTeam = fixture.teams?.away;

      if (homeTeam && homeTeam.id) {
        if (!teamsMap.has(homeTeam.id)) {
          teamsMap.set(homeTeam.id, {
            team: homeTeam,
            venue: fixture.venue,
          });
        }
      }

      if (awayTeam && awayTeam.id) {
        if (!teamsMap.has(awayTeam.id)) {
          teamsMap.set(awayTeam.id, {
            team: awayTeam,
            venue: null, // Away team doesn't have a home venue
          });
        }
      }
    });

    const teams = Array.from(teamsMap.values());

    console.log(`✅ Found ${teams.length} unique teams from fixtures`);
    console.log("");

    return teams;
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
            const countryEn = teamData.country || "Unknown";
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

      // For national teams, we might not have a venue
      // We'll use a default venue or skip if no venue is available
      let venue = null;
      
      // Try to find any venue from the country (for national teams, use a default venue from their country)
      // For now, we'll skip teams without venues or use a placeholder
      // Actually, let's check if we can find a venue by country
      if (teamData.country) {
        // Try to find a venue from the team's country
        const countryVenue = await Venue.findOne({
          country_en: teamData.country,
        }).lean();
        
        if (countryVenue) {
          venue = countryVenue;
        }
      }

      // If still no venue, we'll need to create teams without venueId
      // But Team model requires venueId, so we need to handle this differently
      // Let's skip teams without venues for now and log a warning
      if (!venue) {
        console.log(
          `⚠️  No venue found for team ${teamData.name} (Country: ${teamData.country || "Unknown"})`
        );
        console.log("   Team will be created without venue (national teams may not have home venues)");
        // We'll need to create a placeholder venue or modify the model
        // For now, let's skip
        skippedTeams.push({
          name: teamData.name,
          id: apiFootballId,
          reason: "No venue available (national team)",
        });
        continue;
      }

      // Prepare team data
      const countryEn = teamData.country || "Unknown";
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
        })`
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
        { slug: "world-cup-2026" },
        { "externalIds.apiFootball": WORLD_CUP_API_FOOTBALL_ID },
      ],
    });

    if (!league) {
      console.log("❌ World Cup 2026 not found in database");
      console.log("   Please run create_worldcup2026_league.js first");
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


