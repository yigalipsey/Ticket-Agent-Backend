import mongoose from "mongoose";
import dotenv from "dotenv";

// Import models
import Team from "../src/models/Team.js";
import League from "../src/models/League.js";

// טעינת משתני סביבה
dotenv.config();

async function updateTeamLeagueIds() {
  try {
    console.log("=== מתחיל עדכון leagueIds לקבוצות ===");

    // החיבור לדטא-בייס
    const mongoUri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/ticketagent";
    await mongoose.connect(mongoUri);
    console.log("✅ מחובר לדטא-בייס");

    // קבלת כל הקבוצות והליגות
    const teams = await Team.find({}).lean();
    const leagues = await League.find({}).lean();

    console.log(`נמצאו ${teams.length} קבוצות ו-${leagues.length} ליגות`);

    // מיפוי ליגות לפי country
    const leagueByCountry = {};
    leagues.forEach((league) => {
      leagueByCountry[league.country] = league;
    });

    console.log("ליגות לפי מדינה:", leagueByCountry);

    let updatedCount = 0;
    let errorCount = 0;

    // עדכון כל קבוצה
    for (const team of teams) {
      try {
        const league = leagueByCountry[team.country];

        if (league) {
          await Team.findByIdAndUpdate(
            team._id,
            { leagueIds: [league._id] },
            { new: true }
          );

          console.log(
            `✅ עדכון קבוצה ${team.name_he} (${team.country}) → ליגה ${league.nameHe}`
          );
          updatedCount++;
        } else {
          console.log(
            `⚠️  לא נמצאה ליגה עבור קבוצה ${team.name_he} במדינה ${team.country}`
          );
          errorCount++;
        }
      } catch (error) {
        console.error(`❌ שגיאה בעדכון קבוצה ${team.name_he}:`, error.message);
        errorCount++;
      }
    }

    console.log("\n=== סיכום העדכון ===");
    console.log(`✅ עודכנו בהצלחה: ${updatedCount} קבוצות`);
    console.log(`❌ שגיאות: ${errorCount} קבוצות`);
    console.log("=== סיום הסקריפט ===");
  } catch (error) {
    console.error("💥 שגיאה כללית בסקריפט:", error);
  } finally {
    // סגירת החיבור
    await mongoose.connection.close();
    console.log("חיבור לדטא-בייס נסגר");
  }
}

// הפעלת הסקריפט
updateTeamLeagueIds().catch(console.error);
