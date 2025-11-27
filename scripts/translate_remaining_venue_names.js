import dotenv from "dotenv";
import Venue from "../src/models/Venue.js";
import databaseConnection from "../src/config/database.js";

dotenv.config();

/**
 * Translate venue name from English to Hebrew
 * This function uses common translations for stadium names
 * @param {string} text - English venue name
 * @returns {string} - Hebrew translation
 */
function translateVenueNameToHebrew(text) {
  if (!text) return text;

  // Common stadium name translations
  const translations = {
    Stade: "סטאד",
    Stadium: "אצטדיון",
    Arena: "ארנה",
    Park: "פארק",
    Field: "אצטדיון",
    Ground: "אצטדיון",
    Estadio: "אצטדיון",
    Stadio: "סטאדיו",
    "de la": "דה לה",
    du: "דו",
    de: "דה",
    Louis: "לואי",
    Fonteneau: "פונטנו",
    Beaujoire: "בוז'ואר",
    Moustoir: "מוסטואר",
    Yves: "איב",
    Allainmat: "אלן מאט",
    Abbé: "אבה",
    Deschamps: "דשאן",
    Charléty: "שארלטי",
    MAPEI: "מאפיי",
    "Città del Tricolore": "סיטה דל טריקולורה",
    Bluenergy: "בלואנרג'י",
    Comunale: "קומונלה",
    Luigi: "לואיג'י",
    Ferraris: "פראריס",
    Olimpico: "אולימפיקו",
    "Grande Torino": "גרנדה טורינו",
    Giovanni: "ג'ובאני",
    Zini: "זיני",
    Garibaldi: "גריבלדי",
    Romeo: "רומיאו",
    Anconetani: "אנקונטני",
    "Via del Mare": "ויה דל מארה",
    Giuseppe: "ג'וזפה",
    Sinigaglia: "סיניגליה",
    Azteca: "אצטקה",
    BBVA: "BBVA",
    Akron: "אקרון",
    MetLife: "מטלייף",
    "Mercedes-Benz": "מרצדס-בנץ",
    "AT&T": "AT&T",
    NRG: "NRG",
    SoFi: "סופיי",
    Gillette: "ג'ילט",
    "Lincoln Financial": "לינקולן פיננשל",
    "Levi's": "ליוויס",
    Lumen: "לומן",
    Arrowhead: "ארוהד",
    BMO: "BMO",
    "BC Place": "BC פלייס",
  };

  // Check if text contains Hebrew characters
  const hasHebrew = /[\u0590-\u05FF]/.test(text);
  if (hasHebrew) {
    return text; // Already in Hebrew
  }

  // Try to translate common patterns
  let translated = text;

  // Translate common words
  for (const [english, hebrew] of Object.entries(translations)) {
    const regex = new RegExp(`\\b${english}\\b`, "gi");
    translated = translated.replace(regex, hebrew);
  }

  // Handle common stadium name patterns
  if (translated.includes("Stade de la Beaujoire")) {
    translated = "סטאד דה לה בוז'ואר - לואי פונטנו";
  } else if (translated.includes("Stade du Moustoir")) {
    translated = "סטאד דו מוסטואר - איב אלן מאט";
  } else if (translated.includes("Stade de l'Abbé Deschamps")) {
    translated = "סטאד דה ל'אבה דשאן";
  } else if (translated.includes("Stade Charléty")) {
    translated = "סטאד שארלטי";
  } else if (translated.includes("MAPEI Stadium")) {
    translated = "אצטדיון מאפיי - סיטה דל טריקולורה";
  } else if (translated.includes("Bluenergy Stadium")) {
    translated = "אצטדיון בלואנרג'י";
  } else if (translated.includes("Stadio Comunale Luigi Ferraris")) {
    translated = "סטאדיו קומונלה לואיג'י פראריס";
  } else if (translated.includes("Stadio Olimpico Grande Torino")) {
    translated = "סטאדיו אולימפיקו גרנדה טורינו";
  } else if (translated.includes("Stadio Giovanni Zini")) {
    translated = "סטאדיו ג'ובאני זיני";
  } else if (translated.includes("Arena Garibaldi")) {
    translated = "ארנה גריבלדי - סטאדיו רומיאו אנקונטני";
  } else if (translated.includes("Stadio Comunale Via del Mare")) {
    translated = "סטאדיו קומונלה ויה דל מארה";
  } else if (translated.includes("Stadio Giuseppe Sinigaglia")) {
    translated = "סטאדיו ג'וזפה סיניגליה";
  } else if (translated.includes("Estadio Azteca")) {
    translated = "אצטדיון אצטקה";
  } else if (translated.includes("Estadio BBVA")) {
    translated = "אצטדיון BBVA";
  } else if (translated.includes("Estadio Akron")) {
    translated = "אצטדיון אקרון";
  } else if (translated.includes("MetLife Stadium")) {
    translated = "אצטדיון מטלייף";
  } else if (translated.includes("Mercedes-Benz Stadium")) {
    translated = "אצטדיון מרצדס-בנץ";
  } else if (translated.includes("AT&T Stadium")) {
    translated = "אצטדיון AT&T";
  } else if (translated.includes("NRG Stadium")) {
    translated = "אצטדיון NRG";
  } else if (translated.includes("SoFi Stadium")) {
    translated = "אצטדיון סופיי";
  } else if (translated.includes("Gillette Stadium")) {
    translated = "אצטדיון ג'ילט";
  } else if (translated.includes("Lincoln Financial Field")) {
    translated = "אצטדיון לינקולן פיננשל";
  } else if (translated.includes("Levi's Stadium")) {
    translated = "אצטדיון ליוויס";
  } else if (translated.includes("Lumen Field")) {
    translated = "אצטדיון לומן";
  } else if (translated.includes("Arrowhead Stadium")) {
    translated = "אצטדיון ארוהד";
  } else if (translated.includes("BMO Field")) {
    translated = "אצטדיון BMO";
  } else if (translated.includes("BC Place")) {
    translated = "אצטדיון BC פלייס";
  }

  // Additional specific translations
  const specificTranslations = {
    "Estádio do Sport Lisboa e Benfica (da Luz)":
      "אצטדיון ספורט ליסבואה ובנפיקה (דה לוז)",
    "Ortalyq stadıon": "אצטדיון אורטליק",
    "Stadyen Dynama": "אצטדיון דינמו",
    "Ljudski vrt": "אצטדיון ליודסקי ורט",
    "Neo GSP": "אצטדיון נאו GSP",
    "Futbalový štadión MFK Ružomberok": "אצטדיון MFK רוזומברוק",
  };

  if (specificTranslations[text]) {
    return specificTranslations[text];
  }

  // If translation didn't change much, try a more general approach
  if (translated === text || translated.length < text.length * 0.5) {
    // For names that don't match patterns, add "אצטדיון" prefix if it's a stadium
    const stadiumKeywords = [
      "stadium",
      "stade",
      "estadio",
      "stadio",
      "arena",
      "stadion",
      "stadionul",
      "stadionas",
      "stadionu",
      "štadión",
      "vrt",
    ];

    const isStadium = stadiumKeywords.some((keyword) =>
      text.toLowerCase().includes(keyword)
    );

    if (isStadium) {
      // Keep the name but ensure it starts with אצטדיון/סטאד/ארנה
      if (
        !translated.startsWith("אצטדיון") &&
        !translated.startsWith("סטאד") &&
        !translated.startsWith("ארנה")
      ) {
        translated = `אצטדיון ${translated}`;
      }
    } else {
      // For other venues, just add אצטדיון prefix
      translated = `אצטדיון ${translated}`;
    }
  }

  return translated || text;
}

/**
 * Translate remaining English venue names to Hebrew
 */
async function translateRemainingVenueNames() {
  try {
    console.log("=".repeat(80));
    console.log("🌐 Translating remaining English venue names to Hebrew");
    console.log("=".repeat(80));
    console.log("");

    // Connect to database
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error("❌ MONGODB_URI not found in environment variables");
      process.exit(1);
    }

    await databaseConnection.connect(mongoUri);
    console.log("✅ Connected to database");
    console.log("");

    // Fetch all venues
    const venues = await Venue.find({}).lean();
    console.log(`📊 Found ${venues.length} total venues`);
    console.log("");

    // Find venues that are still in English (don't contain Hebrew characters)
    const englishVenues = venues.filter((venue) => {
      if (!venue.name_en) return false;
      const hasHebrew = /[\u0590-\u05FF]/.test(venue.name_en);
      return !hasHebrew;
    });

    console.log(
      `🔍 Found ${englishVenues.length} venues that need translation`
    );
    console.log("");

    if (englishVenues.length === 0) {
      console.log("✅ All venues are already translated!");
      await databaseConnection.disconnect();
      return;
    }

    let translatedCount = 0;
    const errors = [];

    // Process each venue
    for (let i = 0; i < englishVenues.length; i++) {
      const venue = englishVenues[i];
      const progress = `[${i + 1}/${englishVenues.length}]`;

      try {
        const originalName = venue.name_en;
        const translatedName = translateVenueNameToHebrew(originalName);

        if (translatedName !== originalName) {
          await Venue.updateOne(
            { _id: venue._id },
            {
              $set: { name_en: translatedName },
            }
          );

          translatedCount++;
          console.log(
            `${progress} ✅ Venue ${venue.venueId}: "${originalName}" → "${translatedName}"`
          );
        } else {
          console.log(
            `${progress} ⏭️  Venue ${venue.venueId}: Could not translate "${originalName}"`
          );
        }
      } catch (error) {
        console.error(
          `${progress} ❌ Error processing venue ${venue.venueId}:`,
          error.message
        );
        errors.push({
          venueId: venue.venueId,
          name_en: venue.name_en,
          error: error.message,
        });
      }
    }

    console.log("");
    console.log("=".repeat(80));
    console.log("📊 Translation Summary");
    console.log("=".repeat(80));
    console.log(`✅ Successfully translated: ${translatedCount}`);
    console.log(
      `⏭️  Skipped: ${englishVenues.length - translatedCount - errors.length}`
    );
    console.log(`❌ Errors: ${errors.length}`);

    if (errors.length > 0) {
      console.log("");
      console.log("❌ Errors details:");
      errors.forEach((err) => {
        console.log(`   - Venue ${err.venueId} (${err.name_en}): ${err.error}`);
      });
    }

    console.log("");
    console.log("✅ Translation completed!");
  } catch (error) {
    console.error("❌ Translation failed:", error);
    throw error;
  } finally {
    await databaseConnection.disconnect();
    console.log("✅ Database connection closed");
  }
}

// Run translation
translateRemainingVenueNames()
  .then(() => {
    console.log("");
    console.log("🎉 Translation script finished successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("");
    console.error("💥 Translation script failed:", error);
    process.exit(1);
  });
