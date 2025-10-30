import dotenv from "dotenv";
import axios from "axios";
import mongoose from "mongoose";
import Venue from "./src/models/Venue.js";
import Team from "./src/models/Team.js";
import League from "./src/models/League.js";
import databaseConnection from "./src/config/database.js";

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

// UEFA Europa League configuration
const UEFA_EUROPA_LEAGUE_ID = 141; // Database leagueId
const API_FOOTBALL_LEAGUE_ID = 3; // API-Football league ID
const CURRENT_SEASON = 2025;

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

const cityTranslations = {
  London: "לונדון",
  Manchester: "מנצ'סטר",
  Birmingham: "ברמינגהאם",
  Liverpool: "ליברפול",
  Edinburgh: "אדינבורו",
  Glasgow: "גלאזגו",
  Madrid: "מדריד",
  Barcelona: "ברצלונה",
  Seville: "סביליה",
  Sevilla: "סביליה",
  Bilbao: "בילבאו",
  "San Sebastián": "סן סבסטיאן",
  "Donostia-San Sebastián": "סן סבסטיאן",
  Milan: "מילאנו",
  Rome: "רומא",
  Turin: "טורינו",
  Naples: "נאפולי",
  Paris: "פריז",
  Lyon: "ליון",
  Marseille: "מרסיי",
  Berlin: "ברלין",
  Munich: "מינכן",
  Hamburg: "המבורג",
  Frankfurt: "פרנקפורט",
  Amsterdam: "אמסטרדם",
  Rotterdam: "רוטרדם",
  Porto: "פורטו",
  Lisbon: "ליסבון",
  Athens: "אתונה",
  Thessaloníki: "תסלוניקי",
  Istanbul: "איסטנבול",
  Kyiv: "קייב",
  Kiev: "קייב",
  Vienna: "וינה",
  Prague: "פראג",
  Warsaw: "וורשה",
  Warszawa: "וורשה",
  Kraków: "קראקוב",
  Budapest: "בודפשט",
  Bucharest: "בוקרשט",
  Bucureşti: "בוקרשט",
  Zagreb: "זאגרב",
  Belgrade: "בלגרד",
  Beograd: "בלגרד",
  Stockholm: "סטוקהולם",
  "Tel-Aviv": "תל אביב",
  "Tel Aviv": "תל אביב",
  "Beer Sheva": "באר שבע",
  "Petach-Tikva": "פתח תקווה",
  Dublin: "דבלין",
  Basel: "בזל",
  Bern: "ברן",
  Zurich: "ציריך",
  Brussels: "בריסל",
  Brussel: "בריסל",
  Sofia: "סופיה",
  Plovdiv: "פלובדיב",
  Razgrad: "ראזגרד",
  Cluj: "קלוז'",
  "Cluj-Napoca": "קלוז' נאפוקה",
  Braga: "ברגה",
  Tiraspol: "טיראספול",
  Mostar: "מוסטאר",
  Nice: "ניס",
  "Décines-Charpieu": "דסין-שארפיה",
  "Villeneuve d'Ascq": "וילנב-ד'אסק",
  Utrecht: "אוטרכט",
  Alkmaar: "אלקמר",
  Enschede: "אנסחדה",
  Deventer: "דבנטר",
  Aberdeen: "אברדין",
  "Nottingham, Nottinghamshire": "נוטינגהאם",
  Nottingham: "נוטינגהאם",
  Sinsheim: "זינסהיים",
  "Freiburg im Breisgau": "פרייבורג",
  Stuttgart: "שטוטגרט",
  Bergen: "ברגן",
  Poznań: "פוזנן",
  Göteborg: "גטבורג",
  Borås: "בוראוס",
  Malmö: "מאלמה",
  Herning: "הרנינג",
  Białystok: "ביאליסטוק",
  Kópavogur: "קופאווגור",
  Vigo: "ויגו",
  Bologna: "בולוניה",
  Rijeka: "רייקא",
  Larnaca: "לרנקה",
  Levkosía: "ניקוסיה",
  Piraeus: "פיראוס",
  Maribor: "מריבור",
  Lugano: "לוגאנו",
  Tetovo: "טטובו",
  Plzeň: "פלזן",
  Graz: "גראץ",
  Bratislava: "ברטיסלאבה",
  Genk: "גנק",
  Wolfsberg: "וולפסברג",
  Trnava: "טרנבה",
  Tammerfors: "טמפרה",
  Kuopio: "קואופיו",
  Fredrikstad: "פרדריקסטד",
  Olomouc: "אולומוץ",
  "Wals-Siezenheim": "וולס-סיזנהיים",
  Linz: "לינץ",
  Samsun: "סמסון",
  Armavir: "ארמביר",
  Ostrava: "אוסטרבה",
  Aktobe: "אקטובה",
  Kostanay: "קוסטניי",
  Hamrun: "חמרון",
  Gnjilane: "גניליאן",
  Gjilan: "גילן",
  "Bačka Topola": "באצ'קה טופולה",
  "Banja Luka": "בניה לוקה",
  Pristina: "פרישטינה",
  Ružomberok: "רוזומברוק",
  Panevėžys: "פנבז'יס",
  Riga: "ריגה",
  Celje: "צליה",
  "Kryvyi Rih": "קריבוי רוג",
  Hunedoara: "הונדוארה",
  "Santa Coloma": "סנטה קולומה",
  Gibraltar: "גיברלטר",
  Lancy: "לנסי",
  Masazir: "מאסזיר",
  Paks: "פאקס",
};

// Translate city to Hebrew
function translateCity(city) {
  if (!city || city === "Unknown") return undefined;

  // Clean the city name - remove extra spaces and normalize
  const cleanCity = city.trim();

  // Try exact match first
  if (cityTranslations[cleanCity]) {
    return cityTranslations[cleanCity];
  }

  // Try to match the first part before comma or slash
  const cityPart = cleanCity.split(/[,/]/)[0].trim();
  if (cityTranslations[cityPart]) {
    return cityTranslations[cityPart];
  }

  // Try case-insensitive match
  for (const [key, value] of Object.entries(cityTranslations)) {
    if (
      key.toLowerCase() === cleanCity.toLowerCase() ||
      key.toLowerCase() === cityPart.toLowerCase()
    ) {
      return value;
    }
  }

  // For common patterns, try to extract just the city name
  // Handle "City, Region" or "City / Region" patterns
  const simpleCity = cityPart.split(" ")[0];
  if (cityTranslations[simpleCity]) {
    return cityTranslations[simpleCity];
  }

  // If no translation found, return undefined (will use English)
  return undefined;
}

// Common venue name translations
const venueNameTranslations = {
  "Old Trafford": "אולד טראפורד",
  "Villa Park": "וילה פארק",
  "The City Ground": "הסיטי גראונד",
  "Decathlon Arena – Stade Pierre-Mauroy": "דקאתלון ארנה – סטאד פיר מורואה",
  "Groupama Stadium": "אצטדיון גרופמה",
  "Allianz Riviera": "אליאנץ ריביירה",
  "Europa-Park Stadion": "אצטדיון אירופה פארק",
  "Stuttgart Arena": "ארנה שטוטגרט",
  "Stadion Galgenwaard": "אצטדיון גאלגנוורד",
  "Stadion Feijenoord": "אצטדיון פיינורד",
  "Estádio Do Dragão": "אצטדיון הדרקון",
  "Estádio Municipal de Braga": "אצטדיון בראגה",
  "Celtic Park": "פארק סלטיק",
  "Easter Road Stadium": "אצטדיון איסטר רוד",
  "Pittodrie Stadium": "אצטדיון פיטודרי",
  "Ibrox Stadium": "אצטדיון איברוקס",
  "Stadio Olimpico": "סטאדיו אולימפיקו",
  "Stadio Renato Dall'Ara": "סטאדיו רנאטו דאל'ארא",
  "Abanca-Balaídos": "אבנקה באלידוס",
  "Estadio Benito Villamarín": "אצטדיון בניטו ויאמארין",
  "Tüpraş Stadyumu": "אצטדיון טופראש",
  "NSK Olimpiiskyi": "אצטדיון אולימפי",
  "St. Jakob-Park": "סנט יאקוב פארק",
  "Lotto Park": "אצטדיון לוטו",
  "Arena Naţională": "ארנה נציונלה",
  "Stadion HNK Rijeka": "אצטדיון רייקא",
  "Yaakov Turner Toto Stadium": "אצטדיון יעקב טרנר",
  "Stadion Wankdorf": "אצטדיון ואנקדורף",
  "Huvepharma Arena": "ארנה הובפרמה",
  "Doosan Aréna": "ארנה דוסון",
  "Bolshaya Sportivnaya Arena": "אצטדיון בולשאיה",
  "Red Bull Arena": "ארנה רד בול",
  "Stadion Dynamo im. Valeriy Lobanovskyi": "אצטדיון דינמו",
  "Stadion Partizana": "אצטדיון פרטיזן",
  "Stadion Bijeli Brijeg": "אצטדיון בייג'לי ברייג'",
  "Stadion Rajko Mitić": "אצטדיון ראג'קו מיטיץ'",
  "Bloomfield Stadium": "אצטדיון בלומפילד",
  "Stadio di Cornaredo": "סטאדיו די קורנרדו",
  "Ecolog Arena": "ארנה אקולוג",
  "Ülker Stadyumu Fenerbahçe Şükrü Saracoğlu Spor Kompleksi":
    "אצטדיון אולקר פנרבצ'ה",
  "AEK Arena - George Karapatakis": "ארנה א.א.ק",
  "Stadio Apóstolos Nikolaidis": "סטאדיו אפוסטולוס ניקולאידיס",
  "Stadio Toumbas": "סטאדיו טומבאס",
  "Stadion Maksimir": "אצטדיון מקסימיר",
  "Merkur Arena": "ארנה מרקור",
  "Vivacom Arena - Georgi Asparuhov": "ארנה ויבאקום",
  "Groupama Aréna": "ארנה גרופמה",
  "Štadión Tehelné pole": "אצטדיון טכלינה פולה",
  "Victoria Stadium": "אצטדיון ויקטוריה",
  "Stadiumi Fadil Vokrri": "אצטדיון פאדיל ווקרי",
  "Cegeka Arena": "ארנה צגקה",
  "Lavanttal Arena": "ארנה לבנטל",
  "CITY ARENA – Štadión Antona Malatinského": "סיטי ארנה",
  "Ratinan Stadion": "אצטדיון רטינאן",
  "Väre Areena": "וורה ארנה",
  "Nye Fredrikstad Stadion": "אצטדיון פרדריקסטד החדש",
  "Stade de Genève": "סטאד דה ז'נבה",
  "Stadionul Dr. Constantin Rădulescu": 'אצטדיון ד"ר קונסטנטין רדולסקו',
  "Andrův stadion": "אצטדיון אנדרוב",
  "Paksi FC Stadion": "אצטדיון פאקסי",
  "Samsun Yeni 19 Mayıs Stadyumu": "אצטדיון סמסון",
  "Armaviri Hakob Tonoyani Stadium": "אצטדיון ארמביר",
  "Městský stadion - Vítkovice Aréna": "אצטדיון ויטקוביצה",
  "Tolka Park": "טולקה פארק",
  "LNK Sporta Parks": "פארק ספורטה אל.אן.קיי",
  "Stadion Z'dežele": "אצטדיון זד'זלה",
  "Ortalyq stadıon": "אצטדיון אורטלי",
  "Victor Tedesco Stadium": "אצטדיון ויקטור טדסקו",
  "Bank Respublika Arena": "ארנה בנק רספובליקה",
  "Stadiumi me bar sintetik Gjilan": "אצטדיון ג'ילן",
  Kópavogsvöllur: "קופאווגסוולור",
  "Brann Stadion": "אצטדיון בראן",
  "Stadion Miejski Legii Warszawa im. Marszałka Józefa Piłsudskiego":
    "אצטדיון לגיה ורשה",
  "Enea Stadion": "אצטדיון אניה",
  "Bravida Arena": "ארנה בראבידה",
  "Eleda Stadion": "אצטדיון אלדה",
  "MCH Arena": "ארנה MCH",
  "De Adelaarshorst": "אצטדיון אדלארשורסט",
};

// Translate venue name to Hebrew (optional)
function translateVenueName(name) {
  return venueNameTranslations[name] || undefined;
}

// Step 1: Find existing venues for UEFA Europa League teams
async function findExistingVenues() {
  try {
    console.log("=".repeat(80));
    console.log("📍 STEP 1: Finding existing venues for UEFA Europa League");
    console.log("=".repeat(80));
    console.log("");

    // Find the league
    const league = await League.findOne({ leagueId: UEFA_EUROPA_LEAGUE_ID });
    if (!league) {
      console.log("❌ UEFA Europa League not found in database");
      return [];
    }

    console.log(`✅ Found league: ${league.name} (${league.nameHe})`);
    console.log("");

    // Find all teams in this league
    const teams = await Team.find({ leagueIds: league._id }).populate(
      "venueId"
    );

    console.log(`📊 Found ${teams.length} teams in UEFA Europa League`);
    console.log("");

    // Extract unique venues
    const venueMap = new Map();
    for (const team of teams) {
      if (team.venueId && typeof team.venueId === "object") {
        const venueId = team.venueId._id.toString();
        if (!venueMap.has(venueId)) {
          venueMap.set(venueId, {
            _id: team.venueId._id.toString(),
            name_en: team.venueId.name_en,
            name_he: team.venueId.name_he,
            city_en: team.venueId.city_en,
            city_he: team.venueId.city_he,
            country_en: team.venueId.country_en,
            country_he: team.venueId.country_he,
            capacity: team.venueId.capacity,
            image: team.venueId.image,
            venueId: team.venueId.venueId,
            externalIds: team.venueId.externalIds,
            team: team.name_en || team.name,
          });
        }
      }
    }

    const existingVenues = Array.from(venueMap.values());

    console.log(`🏟️  Found ${existingVenues.length} unique venues:`);
    console.log("");
    existingVenues.forEach((venue, index) => {
      console.log(
        `${index + 1}. ${venue.name_en}${
          venue.name_he ? ` (${venue.name_he})` : ""
        }`
      );
      console.log(
        `   City: ${venue.city_en}${venue.city_he ? ` (${venue.city_he})` : ""}`
      );
      console.log(
        `   Country: ${venue.country_en}${
          venue.country_he ? ` (${venue.country_he})` : ""
        }`
      );
      console.log(`   Capacity: ${venue.capacity || "N/A"}`);
      console.log(`   Venue ID: ${venue.venueId}`);
      console.log(
        `   API-Football ID: ${venue.externalIds?.apiFootball || "N/A"}`
      );
      console.log(`   Image: ${venue.image ? "✅ Yes" : "❌ No"}`);
      console.log(`   Used by team: ${venue.team || "N/A"}`);
      console.log("");
    });

    console.log("=".repeat(80));
    console.log("");

    return existingVenues;
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
      `🔍 Fetching teams for UEFA Europa League (ID: ${API_FOOTBALL_LEAGUE_ID}, Season: ${CURRENT_SEASON})...`
    );
    console.log("");

    const teamsResponse = await apiClient.get("/teams", {
      params: {
        league: API_FOOTBALL_LEAGUE_ID,
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
        teamCountry: item.team.country, // Extract country from team
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
      const countryEn = venueData.country || item.teamCountry || "Unknown";
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
          !existingVenue.name_he ||
          existingVenue.name_he === existingVenue.name_en;
        const cityNeedsUpdate =
          !existingVenue.city_he ||
          existingVenue.city_he === existingVenue.city_en;
        const countryNeedsUpdate =
          !existingVenue.country_he || existingVenue.country_en === "Unknown";

        const needsUpdate =
          nameNeedsUpdate || cityNeedsUpdate || countryNeedsUpdate;

        if (needsUpdate) {
          const updateData = {};
          // Update name_he if missing or if it's the same as name_en (not translated)
          if (
            (!existingVenue.name_he ||
              existingVenue.name_he === existingVenue.name_en) &&
            nameHe
          ) {
            updateData.name_he = nameHe;
          }
          // Update city_he if missing or if it's the same as city_en (not translated)
          if (
            (!existingVenue.city_he ||
              existingVenue.city_he === existingVenue.city_en) &&
            cityHe
          ) {
            updateData.city_he = cityHe;
          }
          // Update country if missing or Unknown
          if (
            !existingVenue.country_he ||
            existingVenue.country_en === "Unknown"
          ) {
            if (countryEn !== "Unknown") {
              updateData.country_en = countryEn;
            }
            updateData.country_he = countryHe;
          } else if (
            existingVenue.country_en === "Unknown" &&
            countryEn !== "Unknown"
          ) {
            updateData.country_en = countryEn;
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
        name_en: nameEn,
        name_he: nameHe || undefined, // Translated if available, undefined otherwise
        city_en: cityEn,
        city_he: cityHe || undefined, // Translated city (only if translation exists)
        country_en: countryEn !== "Unknown" ? countryEn : undefined,
        country_he: countryEn !== "Unknown" ? countryHe : undefined,
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
