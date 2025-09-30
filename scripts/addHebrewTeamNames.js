import mongoose from "mongoose";
import Team from "../src/models/Team.js";
import { config } from "dotenv";

// Load environment variables
config();

// Hebrew team names mapping
const hebrewTeamNames = {
  // Premier League
  arsenal: "ארסנל",
  chelsea: "צ'לסי",
  liverpool: "ליברפול",
  "manchester-city": "מנצ'סטר סיטי",
  "manchester-united": "מנצ'סטר יונייטד",
  tottenham: "טוטנהאם",
  newcastle: "ניוקאסל",
  brighton: "ברייטון",
  "west-ham": "וסט האם",
  wolves: "וולברהמפטון",
  "crystal-palace": "קריסטל פאלאס",
  everton: "אברטון",
  fulham: "פולהאם",
  leeds: "לידס",
  leicester: "לסטר",
  southampton: "סאות'המפטון",
  burnley: "ברנלי",
  watford: "ווטפורד",
  norwich: "נוריץ'",
  brentford: "ברנטפורד",
  bournemouth: "בורנמות'",
  "aston-villa": "אסטון וילה",
  "nottingham-forest": "נוטינגהאם פורסט",
  sunderland: "סנדרלנד",

  // La Liga
  "real-madrid": "ריאל מדריד",
  barcelona: "ברצלונה",
  "atletico-madrid": "אתלטיקו מדריד",
  sevilla: "סביליה",
  "real-betis": "ריאל בטיס",
  villarreal: "ויאריאל",
  valencia: "ולנסיה",
  "athletic-bilbao": "אתלטיק בילבאו",
  "real-sociedad": "ריאל סוסיאדד",
  "celta-vigo": "סלטה ויגו",
  espanyol: "אספניול",
  getafe: "חתאפה",
  levante: "לבנטה",
  mallorca: "מיורקה",
  cadiz: "קאדיס",
  elche: "אלצ'ה",
  granada: "גרנדה",
  alaves: "אלאבס",
  osasuna: "אוססונה",
  "rayo-vallecano": "ראיו ואיקאנו",
  girona: "חירונה",
  oviedo: "אוביידו",

  // Bundesliga
  "bayern-munich": "באיירן מינכן",
  "borussia-dortmund": "בורוסיה דורטמונד",
  "rb-leipzig": "ר.ב. לייפציג",
  "bayer-leverkusen": "באייר לברקוזן",
  "eintracht-frankfurt": "איינטרכט פרנקפורט",
  "union-berlin": "אוניון ברלין",
  "sc-freiburg": "פרייבורג",
  "1-fc-koln": "קלן",
  mainz: "מיינץ",
  "borussia-mg": "בורוסיה מנשנגלדבך",
  "vfl-bochum": "בוכום",
  augsburg: "אאוגסבורג",
  "vfb-stuttgart": "שטוטגרט",
  "hertha-bsc": "הרטה ברלין",
  "arminia-bielefeld": "בילפלד",
  "greuther-furth": "פורת",

  // Serie A
  juventus: "יובנטוס",
  inter: "אינטר",
  milan: "מילאן",
  napoli: "נאפולי",
  atalanta: "אטאלנטה",
  roma: "רומא",
  lazio: "לאציו",
  fiorentina: "פיורנטינה",
  torino: "טורינו",
  bologna: "בולוניה",
  verona: "ורונה",
  sassuolo: "סאסואולו",
  empoli: "אמפולי",
  spezia: "ספציה",
  salernitana: "סלרניטנה",
  udinese: "אודינזה",
  sampdoria: "סמפדוריה",
  cagliari: "קאליירי",
  genoa: "גנואה",
  venezia: "ונציה",

  // Ligue 1
  psg: "פאריס סן ז'רמן",
  marseille: "מרסיי",
  monaco: "מונקו",
  lyon: "ליון",
  rennes: "רן",
  strasbourg: "שטרסבורג",
  lens: "לאנס",
  nice: "ניס",
  montpellier: "מונפלייה",
  lille: "ליל",
  nantes: "נאנט",
  reims: "ריימס",
  troyes: "טרואה",
  clermont: "קלרמון",
  brest: "ברסט",
  angers: "אנג'ה",
  lorient: "לוריאן",
  "saint-etienne": "סנט אטיין",
  bordeaux: "בורדו",
  metz: "מץ",
  "athletic-club": "אתלטיק בילבאו",
};

// Hebrew country names mapping
const hebrewCountryNames = {
  England: "אנגליה",
  Spain: "ספרד",
  Germany: "גרמניה",
  Italy: "איטליה",
  France: "צרפת",
  Portugal: "פורטוגל",
  Netherlands: "הולנד",
  Belgium: "בלגיה",
  Turkey: "טורקיה",
  Russia: "רוסיה",
  Ukraine: "אוקראינה",
  Poland: "פולין",
  "Czech Republic": "צ'כיה",
  Austria: "אוסטריה",
  Switzerland: "שוויץ",
  Scotland: "סקוטלנד",
  Wales: "וויילס",
  Ireland: "אירלנד",
  Norway: "נורווגיה",
  Sweden: "שוודיה",
  Denmark: "דנמרק",
  Finland: "פינלנד",
  Greece: "יוון",
  Croatia: "קרואטיה",
  Serbia: "סרביה",
  Romania: "רומניה",
  Bulgaria: "בולגריה",
  Hungary: "הונגריה",
  Slovakia: "סלובקיה",
  Slovenia: "סלובניה",
  Albania: "אלבניה",
  "Bosnia and Herzegovina": "בוסניה והרצגובינה",
  Montenegro: "מונטנגרו",
  "North Macedonia": "מקדוניה הצפונית",
  Kosovo: "קוסובו",
  Moldova: "מולדובה",
  Belarus: "בלארוס",
  Lithuania: "ליטא",
  Latvia: "לטביה",
  Estonia: "אסטוניה",
  Iceland: "איסלנד",
  Luxembourg: "לוקסמבורג",
  Malta: "מלטה",
  Cyprus: "קפריסין",
  Liechtenstein: "לטנשטיין",
  Andorra: "אנדורה",
  "San Marino": "סן מרינו",
  "Vatican City": "קריית הוותיקן",
  Monaco: "מונקו",
};

async function connectToDatabase() {
  try {
    const mongoUri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/ticketagent";
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ Failed to connect to MongoDB:", error.message);
    process.exit(1);
  }
}

async function addHebrewNames() {
  try {
    console.log("🚀 Starting to add Hebrew names to teams...");

    // Get all teams
    const teams = await Team.find({}).lean();
    console.log(`📊 Found ${teams.length} teams to process`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const team of teams) {
      const updates = {};

      // Add Hebrew team name if available
      if (hebrewTeamNames[team.slug]) {
        updates.name_he = hebrewTeamNames[team.slug];
        console.log(
          `🏷️  Adding Hebrew name for ${team.slug}: ${updates.name_he}`
        );
      } else {
        console.log(`⚠️  No Hebrew name found for ${team.slug}`);
        skippedCount++;
        continue;
      }

      // Add Hebrew country name if available
      if (hebrewCountryNames[team.country]) {
        updates.country_he = hebrewCountryNames[team.country];
        console.log(
          `🌍 Adding Hebrew country for ${team.slug}: ${updates.country_he}`
        );
      }

      // Update the team
      await Team.updateOne({ _id: team._id }, { $set: updates });

      updatedCount++;
      console.log(`✅ Updated team: ${team.slug}`);
    }

    console.log("\n📈 Summary:");
    console.log(`✅ Successfully updated: ${updatedCount} teams`);
    console.log(`⚠️  Skipped (no Hebrew name): ${skippedCount} teams`);
    console.log(`📊 Total processed: ${teams.length} teams`);
  } catch (error) {
    console.error("❌ Error adding Hebrew names:", error);
    throw error;
  }
}

async function main() {
  try {
    await connectToDatabase();
    await addHebrewNames();
    console.log("\n🎉 Script completed successfully!");
  } catch (error) {
    console.error("💥 Script failed:", error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("👋 Disconnected from MongoDB");
  }
}

// Run the script
main();
