import dotenv from "dotenv";
import axios from "axios";
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

// Serie A configuration
const SERIEA_API_FOOTBALL_ID = 135; // API-Football league ID for Serie A
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

// City translations for Italian cities
const cityTranslations = {
  Milan: "מילאנו",
  "Milano": "מילאנו",
  Rome: "רומא",
  "Roma": "רומא",
  Turin: "טורינו",
  "Torino": "טורינו",
  Naples: "נאפולי",
  "Napoli": "נאפולי",
  Florence: "פירנצה",
  "Firenze": "פירנצה",
  Bologna: "בולוניה",
  Genoa: "ג'נובה",
  "Genova": "ג'נובה",
  Verona: "ורונה",
  Parma: "פארמה",
  Cagliari: "קליארי",
  Udine: "אודינה",
  Lecce: "לצ'ה",
  Empoli: "אמפולי",
  Monza: "מונצה",
  Salerno: "סלרנו",
  Sassuolo: "סאסואולו",
  Bergamo: "ברגאמו",
  "Atalanta": "ברגאמו",
};

// Translate city to Hebrew
function translateCity(city) {
  if (!city || city === "Unknown") return undefined;

  const cleanCity = city.trim();

  if (cityTranslations[cleanCity]) {
    return cityTranslations[cleanCity];
  }

  const cityPart = cleanCity.split(/[,/]/)[0].trim();
  if (cityTranslations[cityPart]) {
    return cityTranslations[cityPart];
  }

  for (const [key, value] of Object.entries(cityTranslations)) {
    if (
      key.toLowerCase() === cleanCity.toLowerCase() ||
      key.toLowerCase() === cityPart.toLowerCase()
    ) {
      return value;
    }
  }

  return undefined;
}

// Venue name translations (common Italian stadiums)
const venueNameTranslations = {
  "San Siro": "סן סירו",
  "Stadio Giuseppe Meazza": "סטאדיו ג'וזפה מאצה",
  "Stadio Olimpico": "סטאדיו אולימפיקו",
  "Allianz Stadium": "אצטדיון אליאנץ",
  "Juventus Stadium": "אצטדיון יובנטוס",
  "Stadio Diego Armando Maradona": "סטאדיו דייגו ארמנדו מראדונה",
  "Stadio San Paolo": "סטאדיו סן פאולו",
  "Stadio Artemio Franchi": "סטאדיו ארטמיו פרנקי",
  "Stadio Renato Dall'Ara": "סטאדיו רנאטו דאל'ארא",
  "Stadio Luigi Ferraris": "סטאדיו לואיג'י פרריס",
  "Stadio Marc'Antonio Bentegodi": "סטאדיו מארק אנטוניו בנטגודי",
  "Stadio Ennio Tardini": "סטאדיו אניו טרדיני",
  "Unipol Domus": "אוניפול דומוס",
  "Stadio Friuli": "סטאדיו פריאולי",
  "Stadio Via del Mare": "סטאדיו ויה דל מארה",
  "Stadio Carlo Castellani": "סטאדיו קרלו קסטלאני",
  "U-Power Stadium": "אצטדיון U-Power",
  "Stadio Arechi": "סטאדיו ארצ'י",
  "Mapei Stadium": "אצטדיון מאפיי",
  "Gewiss Stadium": "אצטדיון גוויס",
};

// Translate venue name to Hebrew
function translateVenueName(name) {
  return venueNameTranslations[name] || undefined;
}

// Step 1: Find existing venues for Serie A teams
async function findExistingVenues() {
  try {
    console.log("=".repeat(80));
    console.log("📍 STEP 1: Finding existing venues for Serie A");
    console.log("=".repeat(80));
    console.log("");

    // Find the league
    const league = await League.findOne({
      $or: [
        { slug: "serie-a" },
        { "externalIds.apiFootball": SERIEA_API_FOOTBALL_ID },
      ],
    });

    if (!league) {
      console.log("❌ Serie A not found in database");
      console.log("   Please run create_seriea_league.js first");
      return [];
    }

    console.log(`✅ Found league: ${league.name} (${league.nameHe || "N/A"})`);
    console.log("");

    // Find all venues (we'll check which ones are used by Serie A teams later)
    const allVenues = await Venue.find({}).lean();

    console.log(`📊 Found ${allVenues.length} total venues in database`);
    console.log("");

    return allVenues;
  } catch (error) {
    console.error("❌ Error finding existing venues:", error.message);
    throw error;
  }
}

// Step 2: Fetch venues from API-Football
async function fetchVenuesFromAPI() {
  try {
    console.log("=".repeat(80));
    console.log("📍 STEP 2: Fetching venues from API-Football");
    console.log("=".repeat(80));
    console.log("");

    console.log(
      `🔍 Fetching teams for Serie A (ID: ${SERIEA_API_FOOTBALL_ID}, Season: ${CURRENT_SEASON})...`
    );
    console.log("");

    const teamsResponse = await apiClient.get("/teams", {
      params: {
        league: SERIEA_API_FOOTBALL_ID,
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
      console.log(`   Country: ${item.venue.country || item.teamCountry || "N/A"}`);
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

// Step 3: Insert new venues
async function insertNewVenues(apiVenues, existingVenues) {
  try {
    console.log("=".repeat(80));
    console.log("📍 STEP 3: Inserting new venues");
    console.log("=".repeat(80));
    console.log("");

    // Create set of existing API-Football IDs
    const existingApiIds = new Set();
    existingVenues.forEach((venue) => {
      if (venue.externalIds?.apiFootball) {
        existingApiIds.add(venue.externalIds.apiFootball);
      }
      if (venue.venueId) {
        existingApiIds.add(venue.venueId);
      }
    });

    console.log(
      `📊 Existing venues in database: ${existingApiIds.size} with API-Football IDs`
    );
    console.log("");

    const newVenues = [];
    const skippedVenues = [];
    const updatedVenues = [];

    for (const item of apiVenues) {
      const venueData = item.venue;
      const apiFootballId = venueData.id;

      // Prepare Hebrew translations
      const countryEn = venueData.country || item.teamCountry || "Italy";
      const countryHe = translateCountry(countryEn);
      const cityEn = venueData.city || "Unknown";
      const cityHe = translateCity(cityEn);
      const nameEn = venueData.name || "Unknown Venue";
      const nameHe = translateVenueName(nameEn);

      // Check if venue already exists by API-Football ID
      const existingByApiId = await Venue.findOne({
        "externalIds.apiFootball": apiFootballId,
      });

      // Check if venue exists by venueId
      const existingByVenueId = await Venue.findOne({
        venueId: apiFootballId,
      });

      const existingVenue = existingByApiId || existingByVenueId;

      if (existingVenue) {
        // Check if venue needs Hebrew translation updates
        const nameNeedsUpdate =
          !existingVenue.name_en ||
          existingVenue.name_en === nameEn;
        const cityNeedsUpdate =
          !existingVenue.city_he ||
          existingVenue.city_he === existingVenue.city_en;
        const countryNeedsUpdate =
          !existingVenue.country_he || existingVenue.country_en === "Unknown";

        const needsUpdate =
          nameNeedsUpdate || cityNeedsUpdate || countryNeedsUpdate;

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

          if (Object.keys(updateData).length > 0) {
            await Venue.findByIdAndUpdate(existingVenue._id, updateData, {
              new: true,
            });
            updatedVenues.push({
              name: venueData.name,
              id: apiFootballId,
              updatedFields: Object.keys(updateData),
            });
            continue;
          }
        }

        skippedVenues.push({
          name: venueData.name,
          id: apiFootballId,
          reason: "Already exists (no updates needed)",
        });
        continue;
      }

      const newVenueData = {
        name_en: nameHe || nameEn,
        city_en: cityEn,
        city_he: cityHe || undefined,
        country_en: countryEn !== "Unknown" ? countryEn : "Italy",
        country_he: countryEn !== "Unknown" ? countryHe : "איטליה",
        capacity: venueData.capacity || null,
        address_en: venueData.address || undefined,
        image: venueData.image || undefined,
        venueId: apiFootballId,
        externalIds: {
          apiFootball: apiFootballId,
        },
      };

      newVenues.push({
        data: newVenueData,
        team: item.team,
      });
    }

    console.log(`📊 Analysis:`);
    console.log(`   Total venues from API: ${apiVenues.length}`);
    console.log(`   Already exist (no updates): ${skippedVenues.length}`);
    console.log(`   Updated with Hebrew: ${updatedVenues.length}`);
    console.log(`   New venues to insert: ${newVenues.length}`);
    console.log("");

    if (updatedVenues.length > 0) {
      console.log("🔄 Updated venues with Hebrew translations:");
      updatedVenues.forEach((venue, index) => {
        console.log(
          `   ${index + 1}. ${venue.name} (ID: ${
            venue.id
          }) - Updated: ${venue.updatedFields.join(", ")}`
        );
      });
      console.log("");
    }

    if (skippedVenues.length > 0) {
      console.log("⏭️  Skipped venues (already exist):");
      skippedVenues.forEach((venue, index) => {
        console.log(
          `   ${index + 1}. ${venue.name} (ID: ${venue.id}) - ${venue.reason}`
        );
      });
      console.log("");
    }

    if (newVenues.length === 0) {
      console.log("✅ No new venues to insert. All venues already exist!");
      console.log("");
      return { inserted: 0, skipped: skippedVenues.length };
    }

    console.log("🆕 New venues to insert:");
    newVenues.forEach((item, index) => {
      console.log(
        `   ${index + 1}. ${item.data.name_en} (City: ${
          item.data.city_en
        }, Country: ${item.data.country_en})`
      );
    });
    console.log("");

    // Insert venues
    console.log("💾 Inserting venues into database...");
    console.log("");

    let insertedCount = 0;
    let errorCount = 0;

    for (const item of newVenues) {
      try {
        const venue = new Venue(item.data);
        await venue.save();
        insertedCount++;
        console.log(
          `✅ [${insertedCount}/${newVenues.length}] Inserted: ${item.data.name_en} (ID: ${item.data.venueId})`
        );
      } catch (error) {
        errorCount++;
        console.error(
          `❌ Failed to insert ${item.data.name_en}: ${error.message}`
        );
      }
    }

    console.log("");
    console.log("=".repeat(80));
    console.log("📝 Summary:");
    console.log("=".repeat(80));
    console.log(`   Total venues from API: ${apiVenues.length}`);
    console.log(`   Already exist (no updates): ${skippedVenues.length}`);
    console.log(`   Updated with Hebrew: ${updatedVenues.length}`);
    console.log(`   Successfully inserted: ${insertedCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log("=".repeat(80));
    console.log("");

    return {
      inserted: insertedCount,
      updated: updatedVenues.length,
      skipped: skippedVenues.length,
      errors: errorCount,
    };
  } catch (error) {
    console.error("❌ Error inserting venues:", error.message);
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

    // Step 1: Find existing venues
    const existingVenues = await findExistingVenues();

    // Step 2: Fetch venues from API
    const apiVenues = await fetchVenuesFromAPI();

    if (apiVenues.length === 0) {
      console.log("❌ No venues found in API response");
      await databaseConnection.disconnect();
      process.exit(0);
    }

    // Step 3: Insert new venues
    const result = await insertNewVenues(apiVenues, existingVenues);

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


