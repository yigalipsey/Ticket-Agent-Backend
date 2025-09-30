import mongoose from "mongoose";
import { config } from "dotenv";
import Venue from "../src/models/Venue.js";

config();

// Hebrew venue names mapping
const hebrewVenueNames = {
  // Real Madrid venues
  "Estadio Santiago Bernabéu": "אצטדיון סנטיאגו ברנבאו",
  "Estadio Alfredo Di Stéfano": "אצטדיון אלפרדו די סטפנו",

  // Barcelona venues
  "Camp Nou": "קאמפ נואו",
  "Estadi Johan Cruyff": "אצטדיון יוהן קרייף",
  "Estadi Olímpic Lluís Companys": "אצטדיון אולימפי לואיס קומפאניס",

  // Atletico Madrid venues
  "Wanda Metropolitano": "ואנדה מטרופוליטנו",
  "Estádio Cívitas Metropolitano": "אצטדיון סיביטס מטרופוליטנו",

  // Valencia venues
  "Estadio de Mestalla": "אצטדיון מסטאיה",
  "Estadio Ciudad de Valencia": "אצטדיון סיודד דה ולנסיה",

  // Sevilla venues
  "Ramón Sánchez-Pizjuán Stadium": "אצטדיון רמון סאנצ'ס-פיזחואן",
  "Estadio Ramón Sánchez-Pizjuán": "אצטדיון רמון סאנצ'ס-פיזחואן",
  "Estadio Ramón Sánchez Pizjuán": "אצטדיון רמון סאנצ'ס פיזחואן",
  "Estadio Benito Villamarín": "אצטדיון בניטו וילמארין",

  // Villarreal venues
  "Estadio de la Cerámica": "אצטדיון דה לה קרמיקה",
  "El Madrigal": "אל מדריגל",

  // Athletic Bilbao venues
  "San Mamés": "סן מאמס",
  "Estadio San Mamés": "אצטדיון סן מאמס",
  "San Mamés Barria": "סן מאמס בריה",

  // Real Sociedad venues
  "Reale Arena": "ריאל ארנה",
  "Anoeta Stadium": "אצטדיון אנואטה",

  // Other Spanish venues
  "Abanca-Balaídos": "אצטדיון בלאדיוס",
  "Stage Front Stadium": "אצטדיון סטייג' פרונט",
  "Estadio de Mendizorroza": "אצטדיון דה מנדיזורוזה",
  "Estadio Coliseum": "אצטדיון קוליסאום",
  "Estadi Municipal de Montilivi": "אצטדיון מוניציפל דה מונטיליבי",
  "Estadio Nuevo Carlos Tartiere": "אצטדיון נואבו קרלוס טרטיירה",
  "Estadio El Sadar": "אצטדיון אל סאדר",
  "Estadio de Vallecas": "אצטדיון דה ואלקה",
  "Estadio Manuel Martínez Valero": "אצטדיון מנואל מרטינס ואלרו",
  "Estadi Mallorca Son Moix": "אצטדיון מיורקה סון מואיקס",

  // Premier League venues
  "Old Trafford": "אולד טראפורד",
  "Emirates Stadium": "אצטדיון אמירטס",
  Anfield: "אנפילד",
  "Stamford Bridge": "סטמפורד ברידג'",
  "Etihad Stadium": "אצטדיון אתיהאד",
  "Tottenham Hotspur Stadium": "אצטדיון טוטנהאם הוטספר",
  "London Stadium": "אצטדיון לונדון",
  "Selhurst Park": "סלהרסט פארק",
  "Goodison Park": "גודיסון פארק",
  "Craven Cottage": "קרייבן קוטג'",
  "King Power Stadium": "אצטדיון קינג פאוור",
  "St. Mary's Stadium": "אצטדיון סנט מרי'ס",
  "Turf Moor": "טורף מור",
  "Vicarage Road": "ויקראג' רואד",
  "Carrow Road": "קארו רואד",
  "Brentford Community Stadium": "אצטדיון ברנטפורד קהילתי",
  "Vitality Stadium": "אצטדיון ויטאליטי",
  "Villa Park": "וילה פארק",
  "City Ground": "סיטי גראונד",
  "Stadium of Light": "אצטדיון האור",
  "St. James' Park": "סנט ג'יימס פארק",
  "Molineux Stadium": "אצטדיון מולינו",
  "Hill Dickinson Stadium": "אצטדיון היל דיקינסון",
  "American Express Stadium": "אצטדיון אמריקן אקספרס",
  "Gtech Community Stadium": "אצטדיון ג'יטק קהילתי",
  "Elland Road": "אלנד רואד",
  "The City Ground": "הסיטי גראונד",

  // Bundesliga venues
  "Allianz Arena": "אליאנץ ארנה",
  "Signal Iduna Park": "סיגנל אידונה פארק",
  Olympiastadion: "אצטדיון אולימפיה",
  "Veltins-Arena": "ולטינס-ארנה",
  "Mercedes-Benz Arena": "מרצדס-בנץ ארנה",
  "Volkswagen Arena": "פולקסווגן ארנה",
  "Red Bull Arena": "רד בול ארנה",
  BayArena: "באיארנה",
  RheinEnergieStadion: "ריין אנרגי שטדיון",
  "Opel Arena": "אופל ארנה",
  "Vonovia Ruhrstadion": "פונוביה רוהר שטדיון",
  "WWK Arena": "WWK ארנה",
  "Mercedes-Benz Arena Stuttgart": "מרצדס-בנץ ארנה שטוטגרט",
  "Olympiastadion Berlin": "אצטדיון אולימפיה ברלין",

  // Serie A venues
  "Allianz Stadium": "אליאנץ שטדיון",
  "San Siro": "סן סירו",
  "Stadio Olimpico": "אצטדיון אולימפיקו",
  "Stadio Diego Armando Maradona": "אצטדיון דייגו ארמנדו מראדונה",
  "Stadio Atleti Azzurri d'Italia": "אצטדיון אתלטי אזורי ד'איטליה",
  "Stadio Artemio Franchi": "אצטדיון ארטמיו פרנקי",
  "Stadio Olimpico Grande Torino": "אצטדיון אולימפיקו גרנדה טורינו",
  "Stadio Renato Dall'Ara": "אצטדיון רנאטו דל'ארה",
  "Mapei Stadium": "אצטדיון מאפיי",
  "Stadio Carlo Castellani": "אצטדיון קרלו קסטלאני",
  "Stadio Alberto Picco": "אצטדיון אלברטו פיקו",
  "Stadio Arechi": "אצטדיון ארצ'י",
  "Stadio Friuli": "אצטדיון פריאולי",
  "Stadio Luigi Ferraris": "אצטדיון לואיג'י פראריס",
  "Sardegna Arena": "סרדיניה ארנה",

  // Ligue 1 venues
  "Parc des Princes": "פארק דה פרינס",
  "Stade Vélodrome": "אצטדיון ולודרום",
  "Stade Louis II": "אצטדיון לואי השני",
  "Groupama Stadium": "אצטדיון גרופמה",
  "Roazhon Park": "רואזון פארק",
  "Stade de la Meinau": "אצטדיון דה לה מינו",
  "Stade Bollaert-Delelis": "אצטדיון בולאר-דלליס",
  "Allianz Riviera": "אליאנץ ריביירה",
  "Stade de la Mosson": "אצטדיון דה לה מוסון",
  "Stade Pierre-Mauroy": "אצטדיון פייר-מורואה",
  "Stade de la Beaujoire": "אצטדיון דה לה בוז'ואר",
  "Stade Auguste-Delaune": "אצטדיון אוגוסט-דלון",
  "Stade de l'Aube": "אצטדיון דה ל'אוב",
  "Stade Gabriel Montpied": "אצטדיון גבריאל מונפיאד",
  "Stade Francis-Le Blé": "אצטדיון פרנסיס-לה בל",
  "Stade Raymond Kopa": "אצטדיון ריימונד קופה",
  "Stade du Moustoir": "אצטדיון דו מוסטואר",
  "Stade Geoffroy-Guichard": "אצטדיון ז'ופרואה-גישרד",
  "Matmut Atlantique": "מאטמוט אטלנטיק",
  "Stade Saint-Symphorien": "אצטדיון סן-סימפוריאן",
};

// Hebrew city names mapping
const hebrewCityNames = {
  Madrid: "מדריד",
  Barcelona: "ברצלונה",
  Valencia: "ולנסיה",
  Sevilla: "סביליה",
  Villarreal: "ויאריאל",
  Bilbao: "בילבאו",
  "San Sebastián": "סן סבסטיאן",
  "Donostia-San Sebastián": "דונוסטיה-סן סבסטיאן",
  Vigo: "ויגו",
  "Cornella de Llobregat": "קורנלה דה ליוברגט",
  "Vitoria-Gasteiz": "ויטוריה-גסטייז",
  Getafe: "חתאפה",
  Girona: "חירונה",
  Oviedo: "אוביידו",
  Iruñea: "אירוניה",
  Elche: "אלצ'ה",
  "Palma de Mallorca": "פלמה דה מיורקה",
  "Newcastle upon Tyne": "ניוקאסל על הטיין",
  "Bournemouth, Dorset": "בורנמות', דורסט",
  "Wolverhampton, West Midlands": "וולברהמפטון, מערב מידלנדס",
  Burnley: "ברנלי",
  "Liverpool, Merseyside": "ליברפול, מרזיסייד",
  "Falmer, East Sussex": "פלמר, מזרח סאסקס",
  "Brentford, Middlesex": "ברנטפורד, מידלסקס",
  "Leeds, West Yorkshire": "לידס, מערב יורקשייר",
  "Nottingham, Nottinghamshire": "נוטינגהאם, נוטינגהאמשייר",
  London: "לונדון",
  Manchester: "מנצ'סטר",
  Liverpool: "ליברפול",
  Birmingham: "בירמינגהאם",
  Leicester: "לסטר",
  Southampton: "סאות'המפטון",
  Burnley: "ברנלי",
  Watford: "ווטפורד",
  Norwich: "נוריץ'",
  Brentford: "ברנטפורד",
  Bournemouth: "בורנמות'",
  Nottingham: "נוטינגהאם",
  Sunderland: "סנדרלנד",
  Munich: "מינכן",
  Dortmund: "דורטמונד",
  Berlin: "ברלין",
  Gelsenkirchen: "גלזנקירכן",
  Stuttgart: "שטוטגרט",
  Wolfsburg: "וולפסבורג",
  Leipzig: "לייפציג",
  Leverkusen: "לפרקוזן",
  Cologne: "קלן",
  Mainz: "מיינץ",
  Bochum: "בוכום",
  Augsburg: "אאוגסבורג",
  Hertha: "הרטה",
  Turin: "טורינו",
  Milan: "מילאן",
  Rome: "רומא",
  Naples: "נאפולי",
  Bergamo: "ברגאמו",
  Florence: "פירנצה",
  Bologna: "בולוניה",
  Verona: "ורונה",
  Sassuolo: "סאסואולו",
  Empoli: "אמפולי",
  "La Spezia": "לה ספציה",
  Salerno: "סלרנו",
  Udine: "אודינה",
  Genoa: "גנואה",
  Cagliari: "קאליירי",
  Venezia: "ונציה",
  Paris: "פאריס",
  Marseille: "מרסיי",
  Monaco: "מונקו",
  Lyon: "ליון",
  Rennes: "רן",
  Strasbourg: "שטרסבורג",
  Lens: "לאנס",
  Nice: "ניס",
  Montpellier: "מונפלייה",
  Lille: "ליל",
  Nantes: "נאנט",
  Reims: "ריימס",
  Troyes: "טרואה",
  Clermont: "קלרמון",
  Brest: "ברסט",
  Angers: "אנג'ה",
  Lorient: "לוריאן",
  "Saint-Étienne": "סנט אטיין",
  Bordeaux: "בורדו",
  Metz: "מץ",
};

// Hebrew country names mapping
const hebrewCountryNames = {
  Spain: "ספרד",
  England: "אנגליה",
  Germany: "גרמניה",
  Italy: "איטליה",
  France: "צרפת",
};

async function connectToDatabase() {
  try {
    const mongoUri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/ticketagent";
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ Error connecting to MongoDB:", error);
    process.exit(1);
  }
}

async function addHebrewVenueNames() {
  await connectToDatabase();

  try {
    console.log("🚀 Starting to add Hebrew names to venues...");

    // Get all venues
    const venues = await Venue.find({}).lean();
    console.log(`📊 Found ${venues.length} venues to process`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const venue of venues) {
      const updates = {};

      // Add Hebrew venue name if available
      if (hebrewVenueNames[venue.name]) {
        updates.name_he = hebrewVenueNames[venue.name];
        updates.name_en = venue.name; // Keep original name as English
        console.log(
          `🏟️  Adding Hebrew name for ${venue.name}: ${updates.name_he}`
        );
      } else {
        console.log(`⚠️  No Hebrew name found for ${venue.name}`);
        skippedCount++;
        continue;
      }

      // Add Hebrew city name if available
      if (hebrewCityNames[venue.city]) {
        updates.city_he = hebrewCityNames[venue.city];
        updates.city_en = venue.city; // Keep original city as English
        console.log(
          `🏙️  Adding Hebrew city for ${venue.city}: ${updates.city_he}`
        );
      }

      // Add Hebrew country name if available
      if (hebrewCountryNames[venue.country]) {
        updates.country_he = hebrewCountryNames[venue.country];
        updates.country_en = venue.country; // Keep original country as English
        console.log(
          `🌍 Adding Hebrew country for ${venue.country}: ${updates.country_he}`
        );
      }

      // Update the venue
      await Venue.updateOne({ _id: venue._id }, { $set: updates });

      updatedCount++;
      console.log(`✅ Updated venue: ${venue.name_en}`);
    }

    console.log("\n📈 Summary:");
    console.log(`✅ Successfully updated: ${updatedCount} venues`);
    console.log(`⚠️  Skipped (no Hebrew name): ${skippedCount} venues`);
    console.log(`📊 Total processed: ${venues.length} venues`);
    console.log("\n🎉 Script completed successfully!");
  } catch (error) {
    console.error("❌ Error adding Hebrew names:", error);
  } finally {
    await mongoose.disconnect();
    console.log("👋 Disconnected from MongoDB");
  }
}

addHebrewVenueNames();
