import "dotenv/config";
import mongoose from "mongoose";
import axios from "axios";
import Venue from "../src/models/Venue.js";
import Team from "../src/models/Team.js";
import League from "../src/models/League.js";

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

// Bundesliga configuration
const BUNDESLIGA_LEAGUE_ID = 78; // API-Football league ID for Bundesliga
const CURRENT_SEASON = 2025;

// Simple translation functions (can be enhanced later)
function translateCountry(countryEn) {
  const translations = {
    Germany: "גרמניה",
    England: "אנגליה",
    Spain: "ספרד",
    Italy: "איטליה",
    France: "צרפת",
  };
  return translations[countryEn] || countryEn;
}

function translateCity(cityEn) {
  // Common German cities
  const translations = {
    Munich: "מינכן",
    Berlin: "ברלין",
    Dortmund: "דורטמונד",
    Frankfurt: "פרנקפורט",
    Hamburg: "המבורג",
    Cologne: "קלן",
    Stuttgart: "שטוטגרט",
    Leverkusen: "לברקוזן",
    Wolfsburg: "וולפסבורג",
    Bremen: "ברמן",
    Mainz: "מיינץ",
    Freiburg: "פרייבורג",
    Augsburg: "אאוגסבורג",
    Heidenheim: "היידנהיים",
    Mönchengladbach: "מנשנגלדבך",
    Hoffenheim: "הופנהיים",
    Leipzig: "לייפציג",
  };
  return translations[cityEn] || cityEn;
}

function translateVenueName(nameEn) {
  // Common venue name patterns
  const patterns = {
    "Allianz Arena": "אליאנץ ארנה",
    "Signal Iduna Park": "סיגנל אידונה פארק",
    Olympiastadion: "אולימפיסטאדיון",
    "Volkswagen Arena": "פולקסווגן ארנה",
    BayArena: "באיארנה",
    "Mercedes-Benz Arena": "מרצדס-בנץ ארנה",
    "Red Bull Arena": "רד בול ארנה",
    "PreZero Arena": "פרה-זירו ארנה",
    "WWK Arena": "WWK ארנה",
    "Vonovia Ruhrstadion": "פונוביה רשטאדיון",
    "Opel Arena": "אופל ארנה",
    "Europa-Park Stadion": "יורופה-פארק שטאדיון",
    "Mewa Arena": "מאווה ארנה",
    "Millerntor-Stadion": "מילרנטור-שטאדיון",
    "Voith-Arena": "ווית-ארנה",
    "Stadion An der Alten Försterei": "שטאדיון אן דר אלטן פורסטריי",
  };

  // Try exact match first
  if (patterns[nameEn]) {
    return patterns[nameEn];
  }

  // Try partial matches
  for (const [en, he] of Object.entries(patterns)) {
    if (nameEn.includes(en) || en.includes(nameEn)) {
      return he;
    }
  }

  return nameEn;
}

async function connectDB() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined in .env");
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");
}

async function fetchVenuesFromAPI() {
  try {
    console.log("=".repeat(80));
    console.log("📍 STEP 1: Fetching venues from API-Football");
    console.log("=".repeat(80));
    console.log("");

    console.log(
      `🔍 Fetching teams for Bundesliga (ID: ${BUNDESLIGA_LEAGUE_ID}, Season: ${CURRENT_SEASON})...`
    );
    console.log("");

    const teamsResponse = await apiClient.get("/teams", {
      params: {
        league: BUNDESLIGA_LEAGUE_ID,
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

    // Extract venues from teams with team country info
    const venues = teamsResponse.data.response
      .map((item) => ({
        venue: item.venue,
        team: item.team.name,
        teamCountry: item.team.country,
      }))
      .filter((item) => item.venue !== null && item.venue !== undefined);

    // Remove duplicates by venue ID
    const uniqueVenues = [];
    const seenIds = new Set();
    for (const item of venues) {
      if (item.venue.id && !seenIds.has(item.venue.id)) {
        seenIds.add(item.venue.id);
        uniqueVenues.push(item);
      }
    }

    console.log(`🏟️  Found ${uniqueVenues.length} unique venues from API`);
    console.log("");

    // Display venues
    uniqueVenues.forEach((item, index) => {
      console.log(`${index + 1}. ${item.venue.name}`);
      console.log(`   City: ${item.venue.city || "N/A"}`);
      console.log(`   Country: ${item.venue.country || "N/A"}`);
      console.log(`   Capacity: ${item.venue.capacity || "N/A"}`);
      console.log(`   Venue ID: ${item.venue.id}`);
      console.log(`   Image: ${item.venue.image ? "✅ Yes" : "❌ No"}`);
      console.log(`   Team: ${item.team}`);
      console.log("");
    });

    console.log("=".repeat(80));
    console.log("");

    return uniqueVenues;
  } catch (error) {
    console.error("❌ Error fetching venues from API:", error.message);
    if (error.response) {
      console.error("API Response:", error.response.data);
    }
    throw error;
  }
}

async function findExistingVenues() {
  try {
    console.log("=".repeat(80));
    console.log("📍 STEP 2: Finding existing venues in database");
    console.log("=".repeat(80));
    console.log("");

    const existingVenues = await Venue.find({}).lean();

    console.log(
      `📊 Found ${existingVenues.length} existing venues in database`
    );
    console.log("");

    return existingVenues;
  } catch (error) {
    console.error("❌ Error finding existing venues:", error.message);
    throw error;
  }
}

async function upsertVenues(apiVenues, existingVenues) {
  try {
    console.log("=".repeat(80));
    console.log("📍 STEP 3: Upserting venues");
    console.log("=".repeat(80));
    console.log("");

    // Create maps for quick lookup
    const existingByApiId = new Map();
    const existingByVenueId = new Map();

    existingVenues.forEach((venue) => {
      if (venue.externalIds?.apiFootball) {
        existingByApiId.set(venue.externalIds.apiFootball, venue);
      }
      if (venue.venueId) {
        existingByVenueId.set(venue.venueId, venue);
      }
    });

    console.log(
      `📊 Existing venues: ${existingByApiId.size} with API-Football IDs, ${existingByVenueId.size} with venueId`
    );
    console.log("");

    const newVenues = [];
    const skippedVenues = [];
    const updatedVenues = [];

    for (const item of apiVenues) {
      const venueData = item.venue;
      const apiFootballId = venueData.id;

      // Prepare Hebrew translations
      const countryEn = venueData.country || item.teamCountry || "Germany";
      const countryHe = translateCountry(countryEn);
      const cityEn = venueData.city || "Unknown";
      const cityHe = translateCity(cityEn);
      const nameEn = venueData.name || "Unknown Venue";
      const nameHe = translateVenueName(nameEn);
      // After migration: name_en contains Hebrew, so use nameHe if available, otherwise nameEn
      const finalNameEn = nameHe || nameEn;

      // Check if venue already exists
      const existingByApi = existingByApiId.get(apiFootballId);
      const existingByVenueIdCheck = existingByVenueId.get(apiFootballId);
      const existingVenue = existingByApi || existingByVenueIdCheck;

      if (existingVenue) {
        // Check if updates are needed
        const needsUpdate =
          !existingVenue.name_en ||
          existingVenue.name_en === nameEn ||
          !existingVenue.city_he ||
          existingVenue.city_he === existingVenue.city_en ||
          !existingVenue.country_he ||
          existingVenue.country_en === "Unknown" ||
          !existingVenue.externalIds?.apiFootball;

        if (needsUpdate) {
          const updateData = {};

          if (
            (!existingVenue.name_en || existingVenue.name_en === nameEn) &&
            nameHe
          ) {
            updateData.name_en = nameHe;
          }

          if (
            (!existingVenue.city_he ||
              existingVenue.city_he === existingVenue.city_en) &&
            cityHe
          ) {
            updateData.city_he = cityHe;
          }

          if (
            !existingVenue.country_he ||
            existingVenue.country_en === "Unknown"
          ) {
            if (countryEn !== "Unknown") {
              updateData.country_en = countryEn;
            }
            updateData.country_he = countryHe;
          }

          if (!existingVenue.externalIds?.apiFootball) {
            updateData.externalIds = {
              ...existingVenue.externalIds,
              apiFootball: apiFootballId,
            };
          }

          if (Object.keys(updateData).length > 0) {
            await Venue.findByIdAndUpdate(existingVenue._id, updateData, {
              new: true,
            });
            updatedVenues.push({
              name: venueData.name,
              id: apiFootballId,
              updatedFields: Object.keys(updateData),
            });
            console.log(
              `✅ Updated: ${venueData.name} (${Object.keys(updateData).join(
                ", "
              )})`
            );
            continue;
          }
        }

        skippedVenues.push({
          name: venueData.name,
          id: apiFootballId,
          reason: "Already exists (no updates needed)",
        });
        console.log(`⏭️  Skipped: ${venueData.name} (already exists)`);
        continue;
      }

      // Create new venue
      const newVenueData = {
        name_en: finalNameEn,
        city_en: cityEn,
        city_he: cityHe,
        country_en: countryEn,
        country_he: countryHe,
        capacity: venueData.capacity || null,
        address_en: venueData.address || null,
        image: venueData.image || null,
        venueId: apiFootballId,
        externalIds: {
          apiFootball: apiFootballId,
        },
      };

      const newVenue = new Venue(newVenueData);
      await newVenue.save();

      newVenues.push({
        name: venueData.name,
        id: apiFootballId,
      });
      console.log(`✅ Created: ${venueData.name} (ID: ${apiFootballId})`);
    }

    console.log("");
    console.log("=".repeat(80));
    console.log("📊 SUMMARY");
    console.log("=".repeat(80));
    console.log(`✅ Created: ${newVenues.length} new venues`);
    console.log(`🔄 Updated: ${updatedVenues.length} existing venues`);
    console.log(
      `⏭️  Skipped: ${skippedVenues.length} venues (no changes needed)`
    );
    console.log("");

    return {
      newVenues,
      updatedVenues,
      skippedVenues,
    };
  } catch (error) {
    console.error("❌ Error upserting venues:", error.message);
    throw error;
  }
}

async function verifyTeamVenues() {
  try {
    console.log("=".repeat(80));
    console.log("📍 STEP 4: Verifying team-venue relationships");
    console.log("=".repeat(80));
    console.log("");

    const bundesliga = await League.findOne({ slug: "bundesliga" });
    if (!bundesliga) {
      throw new Error("Bundesliga league not found in database");
    }

    const teams = await Team.find({ leagueIds: bundesliga._id })
      .populate("venueId", "name_en city_en venueId")
      .lean();

    console.log(`📋 Found ${teams.length} Bundesliga teams\n`);

    const teamsWithoutVenue = [];
    const teamsWithVenue = [];

    for (const team of teams) {
      if (!team.venueId) {
        teamsWithoutVenue.push({
          name: team.name_en || team.name,
          slug: team.slug,
        });
      } else {
        teamsWithVenue.push({
          name: team.name_en || team.name,
          venue: team.venueId.name_en,
        });
      }
    }

    if (teamsWithoutVenue.length > 0) {
      console.log(`⚠️  Teams without venue (${teamsWithoutVenue.length}):`);
      teamsWithoutVenue.forEach((team) => {
        console.log(`   - ${team.name} (${team.slug})`);
      });
      console.log("");
    }

    console.log(`✅ Teams with venue: ${teamsWithVenue.length}`);
    if (teamsWithVenue.length > 0) {
      console.log("\nSample teams with venues:");
      teamsWithVenue.slice(0, 5).forEach((team) => {
        console.log(`   - ${team.name} → ${team.venue}`);
      });
    }

    console.log("");
    console.log("=".repeat(80));
    console.log("");

    return {
      teamsWithoutVenue,
      teamsWithVenue,
    };
  } catch (error) {
    console.error("❌ Error verifying team venues:", error.message);
    throw error;
  }
}

async function run() {
  try {
    await connectDB();

    // Step 1: Fetch venues from API
    const apiVenues = await fetchVenuesFromAPI();

    if (apiVenues.length === 0) {
      console.log("❌ No venues found from API");
      await mongoose.disconnect();
      return;
    }

    // Step 2: Find existing venues
    const existingVenues = await findExistingVenues();

    // Step 3: Upsert venues
    const result = await upsertVenues(apiVenues, existingVenues);

    // Step 4: Verify team-venue relationships
    await verifyTeamVenues();

    console.log(
      "================================================================================"
    );
    console.log("✅ Done! All Bundesliga venues are ready");
    console.log(
      "================================================================================"
    );
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    if (error.response) {
      console.error(
        "Response data:",
        JSON.stringify(error.response.data, null, 2)
      );
    }
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
}

run();

