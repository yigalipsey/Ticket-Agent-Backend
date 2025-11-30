import dotenv from "dotenv";
import axios from "axios";
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

// Serie A configuration
const SERIEA_API_FOOTBALL_ID = 135; // API-Football league ID for Serie A
const CURRENT_SEASON = 2025;

// Database leagueId - needs to be unique, check existing leagues first
// This will be determined after checking existing leagues
let SERIEA_LEAGUE_ID = null;

// Fetch league info from API-Football
async function fetchLeagueFromAPI() {
  try {
    console.log("=".repeat(80));
    console.log("📍 STEP 1: Fetching Serie A information from API-Football");
    console.log("=".repeat(80));
    console.log("");

    console.log(
      `🔍 Fetching league info for Serie A (API ID: ${SERIEA_API_FOOTBALL_ID}, Season: ${CURRENT_SEASON})...`
    );
    console.log("");

    const response = await apiClient.get("/leagues", {
      params: {
        id: SERIEA_API_FOOTBALL_ID,
        season: CURRENT_SEASON,
      },
    });

    if (
      !response.data ||
      !response.data.response ||
      response.data.response.length === 0
    ) {
      console.log("❌ No league found in API response");
      return null;
    }

    const leagueData = response.data.response[0].league;
    const countryData = response.data.response[0].country;

    console.log(`✅ Found league: ${leagueData.name}`);
    console.log(`   Country: ${countryData.name}`);
    console.log(`   Type: ${leagueData.type}`);
    console.log(`   Logo: ${leagueData.logo || "N/A"}`);
    console.log("");

    return {
      name: leagueData.name,
      country: countryData.name,
      logo: leagueData.logo,
      type: leagueData.type,
    };
  } catch (error) {
    console.error("❌ Error fetching league from API:", error.message);
    if (error.response) {
      console.error("API Response:", error.response.data);
    }
    throw error;
  }
}

// Find next available leagueId
async function findNextLeagueId() {
  try {
    const maxLeague = await League.findOne({})
      .sort({ leagueId: -1 })
      .select("leagueId")
      .lean();

    if (!maxLeague) {
      return 1;
    }

    return maxLeague.leagueId + 1;
  } catch (error) {
    console.error("❌ Error finding next leagueId:", error.message);
    throw error;
  }
}

// Check if league already exists
async function checkExistingLeague() {
  try {
    // Check by API-Football ID
    const existingByApiId = await League.findOne({
      "externalIds.apiFootball": SERIEA_API_FOOTBALL_ID,
    });

    if (existingByApiId) {
      return {
        exists: true,
        league: existingByApiId,
        reason: "Found by API-Football ID",
      };
    }

    // Check by slug
    const existingBySlug = await League.findOne({
      slug: "serie-a",
    });

    if (existingBySlug) {
      return {
        exists: true,
        league: existingBySlug,
        reason: "Found by slug 'serie-a'",
      };
    }

    // Check by name
    const existingByName = await League.findOne({
      $or: [{ name: "Serie A" }, { name: /^Serie A/i }, { nameHe: "סרייה א'" }],
    });

    if (existingByName) {
      return {
        exists: true,
        league: existingByName,
        reason: "Found by name",
      };
    }

    return { exists: false, league: null, reason: null };
  } catch (error) {
    console.error("❌ Error checking existing league:", error.message);
    throw error;
  }
}

// Create or update league
async function createOrUpdateLeague(apiLeagueData) {
  try {
    console.log("=".repeat(80));
    console.log("📍 STEP 2: Creating/Updating Serie A in database");
    console.log("=".repeat(80));
    console.log("");

    // Check if league already exists
    const existing = await checkExistingLeague();

    if (existing.exists) {
      console.log(`ℹ️  League already exists: ${existing.reason}`);
      console.log(`   League ID: ${existing.league.leagueId}`);
      console.log(
        `   Name: ${existing.league.name}${
          existing.league.nameHe ? ` (${existing.league.nameHe})` : ""
        }`
      );
      console.log(`   Slug: ${existing.league.slug}`);
      console.log("");

      // Check if needs update
      const needsUpdate =
        !existing.league.externalIds?.apiFootball ||
        !existing.league.nameHe ||
        existing.league.nameHe !== "סרייה א'";

      if (needsUpdate) {
        console.log("🔄 Updating league with missing information...");
        const updateData = {};

        if (!existing.league.externalIds?.apiFootball) {
          updateData["externalIds.apiFootball"] = SERIEA_API_FOOTBALL_ID;
        }

        if (!existing.league.nameHe || existing.league.nameHe !== "סרייה א'") {
          updateData.nameHe = "סרייה א'";
        }

        if (
          !existing.league.countryHe ||
          existing.league.countryHe !== "איטליה"
        ) {
          updateData.countryHe = "איטליה";
        }

        if (Object.keys(updateData).length > 0) {
          await League.findByIdAndUpdate(existing.league._id, updateData, {
            new: true,
          });
          console.log("✅ League updated successfully");
          console.log(
            `   Updated fields: ${Object.keys(updateData).join(", ")}`
          );
        } else {
          console.log("✅ League is up to date");
        }
      } else {
        console.log("✅ League already exists and is up to date");
      }

      console.log("");
      return existing.league;
    }

    // Find next available leagueId
    const nextLeagueId = await findNextLeagueId();
    SERIEA_LEAGUE_ID = nextLeagueId;

    console.log(`📊 Next available leagueId: ${nextLeagueId}`);
    console.log("");

    // Prepare league data
    const leagueData = {
      leagueId: nextLeagueId,
      name: apiLeagueData.name,
      nameHe: "סרייה א'",
      slug: "serie-a",
      country: apiLeagueData.country,
      countryHe: "איטליה",
      logoUrl: apiLeagueData.logo || undefined,
      type: apiLeagueData.type === "League" ? "League" : "League",
      externalIds: {
        apiFootball: SERIEA_API_FOOTBALL_ID,
      },
    };

    console.log("🆕 Creating new league with the following data:");
    console.log(`   League ID: ${leagueData.leagueId}`);
    console.log(`   Name: ${leagueData.name} (${leagueData.nameHe})`);
    console.log(`   Slug: ${leagueData.slug}`);
    console.log(`   Country: ${leagueData.country} (${leagueData.countryHe})`);
    console.log(`   Type: ${leagueData.type}`);
    console.log(`   API-Football ID: ${leagueData.externalIds.apiFootball}`);
    console.log(`   Logo: ${leagueData.logoUrl || "N/A"}`);
    console.log("");

    // Create league
    const newLeague = new League(leagueData);
    await newLeague.save();

    console.log("✅ League created successfully!");
    console.log(`   Database ID: ${newLeague._id}`);
    console.log("");

    return newLeague;
  } catch (error) {
    console.error("❌ Error creating/updating league:", error.message);
    if (error.code === 11000) {
      console.error(
        "   Duplicate key error - league with this slug may already exist"
      );
    }
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

    // Step 1: Fetch league from API
    const apiLeagueData = await fetchLeagueFromAPI();

    if (!apiLeagueData) {
      console.log("❌ Could not fetch league data from API");
      await databaseConnection.disconnect();
      process.exit(1);
    }

    // Step 2: Create or update league
    const league = await createOrUpdateLeague(apiLeagueData);

    // Verification
    console.log("=".repeat(80));
    console.log("🔍 VERIFICATION");
    console.log("=".repeat(80));
    console.log("");

    const verifiedLeague = await League.findById(league._id).lean();
    console.log("📊 League in database:");
    console.log(`   League ID: ${verifiedLeague.leagueId}`);
    console.log(
      `   Name: ${verifiedLeague.name}${
        verifiedLeague.nameHe ? ` (${verifiedLeague.nameHe})` : ""
      }`
    );
    console.log(`   Slug: ${verifiedLeague.slug}`);
    console.log(
      `   Country: ${verifiedLeague.country}${
        verifiedLeague.countryHe ? ` (${verifiedLeague.countryHe})` : ""
      }`
    );
    console.log(`   Type: ${verifiedLeague.type}`);
    console.log(
      `   API-Football ID: ${verifiedLeague.externalIds?.apiFootball || "N/A"}`
    );
    console.log("");

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



