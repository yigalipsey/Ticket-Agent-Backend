import mongoose from "mongoose";
import Team from "../src/models/Team.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * סקריפט לעדכון צבעים של קבוצות
 * מוסיף לכל קבוצה צבע ראשי וצבע משני
 */

// הגדרת צבעים לפי שמות קבוצות
const TEAM_COLORS = {
  // Premier League
  "manchester-united": { primary: "#DA020E", secondary: "#000000" },
  "manchester-city": { primary: "#6CABDD", secondary: "#FFFFFF" },
  liverpool: { primary: "#C8102E", secondary: "#00B2A9" },
  chelsea: { primary: "#034694", secondary: "#FFFFFF" },
  arsenal: { primary: "#EF0107", secondary: "#9C824A" },
  "tottenham-hotspur": { primary: "#132257", secondary: "#FFFFFF" },
  "newcastle-united": { primary: "#241F20", secondary: "#FFFFFF" },
  "brighton-and-hove-albion": { primary: "#0057B8", secondary: "#FFFFFF" },
  "west-ham-united": { primary: "#7A263A", secondary: "#1BB1E7" },
  "aston-villa": { primary: "#95BFE5", secondary: "#670E36" },
  "crystal-palace": { primary: "#C4122E", secondary: "#1B458F" },
  fulham: { primary: "#000000", secondary: "#CC0000" },
  bournemouth: { primary: "#DA020E", secondary: "#000000" },
  wolves: { primary: "#FDB913", secondary: "#231F20" },
  everton: { primary: "#003399", secondary: "#FFFFFF" },
  "leicester-city": { primary: "#0053A0", secondary: "#FDBE11" },
  burnley: { primary: "#8CCCE5", secondary: "#DA020E" },
  "sheffield-united": { primary: "#EE2737", secondary: "#FFFFFF" },
  "luton-town": { primary: "#F78F1E", secondary: "#FFFFFF" },
  brentford: { primary: "#EF3340", secondary: "#FFFFFF" },

  // La Liga
  "real-madrid": { primary: "#FFFFFF", secondary: "#FFD900" },
  barcelona: { primary: "#A50044", secondary: "#004D98" },
  "atletico-madrid": { primary: "#CE3524", secondary: "#FFFFFF" },
  sevilla: { primary: "#D10020", secondary: "#FFFFFF" },
  "real-sociedad": { primary: "#0033A0", secondary: "#FFFFFF" },
  valencia: { primary: "#FF6600", secondary: "#000000" },
  villareal: { primary: "#FFCD00", secondary: "#000000" },
  "athletic-bilbao": { primary: "#ED1C24", secondary: "#1A1A1A" },
  getafe: { primary: "#0066FF", secondary: "#FFFFFF" },
  girona: { primary: "#DC143C", secondary: "#FFFFFF" },
  osasuna: { primary: "#9D2933", secondary: "#FFC312" },
  "rayo-vallecano": { primary: "#FF0000", secondary: "#FFD700" },
  levante: { primary: "#DC143C", secondary: "#000000" },
  alaves: { primary: "#0055A4", secondary: "#FFFFFF" },
  espanyol: { primary: "#1C448E", secondary: "#FF0000" },
  cadiz: { primary: "#FFD700", secondary: "#000000" },
  mallorca: { primary: "#C8102E", secondary: "#FFFF00" },
  granada: { primary: "#C8102E", secondary: "#FFFFFF" },
  "celta-vigo": { primary: "#1E90FF", secondary: "#FFD700" },
  "real-betis": { primary: "#0A7A3A", secondary: "#FFFFFF" },
  "las-palmas": { primary: "#FFD700", secondary: "#0066FF" },

  // Serie A
  juventus: { primary: "#000000", secondary: "#FFFFFF" },
  "inter-milan": { primary: "#0068A8", secondary: "#000000" },
  "ac-milan": { primary: "#FB090B", secondary: "#000000" },
  napoli: { primary: "#0A4D9C", secondary: "#6CACE4" },
  roma: { primary: "#7B003F", secondary: "#FFD700" },
  lazio: { primary: "#6699FF", secondary: "#FFFFFF" },
  atalanta: { primary: "#000000", secondary: "#0069A8" },
  fiorentina: { primary: "#490E3D", secondary: "#FFFFFF" },
  torino: { primary: "#8B0000", secondary: "#FFFFFF" },
  bologna: { primary: "#A6192E", secondary: "#0000FF" },
  genoa: { primary: "#0068A8", secondary: "#DC143C" },
  lecce: { primary: "#FFFF00", secondary: "#000000" },
  sassuolo: { primary: "#00AD83", secondary: "#000000" },
  frosinone: { primary: "#FFD700", secondary: "#0000FF" },
  udinese: { primary: "#000000", secondary: "#FFFFFF" },
  empoli: { primary: "#0000FF", secondary: "#FFFFFF" },
  monza: { primary: "#DC143C", secondary: "#FFFFFF" },
  salernitana: { primary: "#DC143C", secondary: "#FFFFFF" },
  verona: { primary: "#FF4500", secondary: "#1E90FF" },
  cagliari: { primary: "#0066FF", secondary: "#FF0000" },

  // Bundesliga
  "bayern-munich": { primary: "#DC052D", secondary: "#FFFFFF" },
  "borussia-dortmund": { primary: "#FDE100", secondary: "#000000" },
  "rb-leipzig": { primary: "#DC143C", secondary: "#FFFFFF" },
  "bayer-leverkusen": { primary: "#E21F26", secondary: "#000000" },
  "eintracht-frankfurt": { primary: "#DC0000", secondary: "#000000" },
  wolfsburg: { primary: "#4F9BFF", secondary: "#FFFFFF" },
  hoffenheim: { primary: "#0066CC", secondary: "#FFFFFF" },
  "vfl-bochum": { primary: "#0046AD", secondary: "#FFFFFF" },
  "union-berlin": { primary: "#DC143C", secondary: "#000000" },
  freiburg: { primary: "#DC143C", secondary: "#FFFFFF" },
  mainz: { primary: "#DC143C", secondary: "#FFFFFF" },
  augsburg: { primary: "#DC143C", secondary: "#FFFFFF" },
  stuttgart: { primary: "#FFFFFF", secondary: "#DC143C" },
  "borussia-monchengladbach": { primary: "#000000", secondary: "#0085CC" },
  heidenheim: { primary: "#0066CC", secondary: "#DC143C" },
  cologne: { primary: "#DC0000", secondary: "#FFFFFF" },
  darmstadt: { primary: "#0066CC", secondary: "#DC143C" },

  // Ligue 1
  "paris-saint-germain": { primary: "#004170", secondary: "#ED1C24" },
  marseille: { primary: "#009EE0", secondary: "#FFFFFF" },
  lyon: { primary: "#FFFFFF", secondary: "#004170" },
  monaco: { primary: "#ED1C24", secondary: "#FFFFFF" },
  lille: { primary: "#DC143C", secondary: "#FFFFFF" },
  nice: { primary: "#0066FF", secondary: "#DC143C" },
  lens: { primary: "#FFD700", secondary: "#DC143C" },
  rennes: { primary: "#DC143C", secondary: "#000000" },
  nantes: { primary: "#0066FF", secondary: "#FFD700" },
  strasbourg: { primary: "#0066FF", secondary: "#DC143C" },
  lorient: { primary: "#FFD700", secondary: "#0066FF" },
  clermont: { primary: "#DC143C", secondary: "#FFFFFF" },
  toulouse: { primary: "#800080", secondary: "#FFFFFF" },
  "le-havre": { primary: "#0066CC", secondary: "#DC143C" },
  metz: { primary: "#DC0000", secondary: "#000000" },
  montpellier: { primary: "#FFD700", secondary: "#0066FF" },
  reims: { primary: "#DC143C", secondary: "#FFFFFF" },
  brest: { primary: "#0085CC", secondary: "#DC143C" },

  // Champions League
  porto: { primary: "#0046AD", secondary: "#FFFFFF" },
  benfica: { primary: "#DC143C", secondary: "#FFFFFF" },
  ajax: { primary: "#D2122E", secondary: "#FFFFFF" },
  psv: { primary: "#DC143C", secondary: "#000000" },
  celtic: { primary: "#00843D", secondary: "#FFFFFF" },
  rangers: { primary: "#0039A6", secondary: "#FFFFFF" },
  "shakhtar-donetsk": { primary: "#FFD700", secondary: "#000000" },
  "dinamo-zagreb": { primary: "#0066CC", secondary: "#DC143C" },
  galatasaray: { primary: "#DC143C", secondary: "#FFD700" },
  fenerbahce: { primary: "#FFD700", secondary: "#0066CC" },
  besiktas: { primary: "#000000", secondary: "#FFFFFF" },
  olympiacos: { primary: "#DC143C", secondary: "#FFFFFF" },
  basel: { primary: "#DC0000", secondary: "#0066CC" },
  "young-boys": { primary: "#FFD700", secondary: "#000000" },
  "club-brugge": { primary: "#0066CC", secondary: "#000000" },
  genk: { primary: "#0066CC", secondary: "#FFD700" },
  salzburg: { primary: "#FF0000", secondary: "#FFFFFF" },
  "slavia-prague": { primary: "#DC143C", secondary: "#FFFFFF" },
  "spartak-moscow": { primary: "#DC143C", secondary: "#000000" },
  zenit: { primary: "#0066CC", secondary: "#FFFFFF" },
};

async function updateTeamColors() {
  try {
    console.log("🔌 Connecting to database...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected successfully!\n");

    console.log("📊 Updating team colors...\n");

    // Get all teams
    const teams = await Team.find({});
    console.log(`Found ${teams.length} teams in the database\n`);

    let updatedCount = 0;
    let notFoundCount = 0;
    const teamsWithoutColors = [];

    for (const team of teams) {
      const teamSlug = team.slug;
      const colors = TEAM_COLORS[teamSlug];

      if (colors) {
        team.primaryColor = colors.primary;
        team.secondaryColor = colors.secondary;
        await team.save();
        console.log(
          `   ✅ ${
            team.name_he || team.name_en || team.name
          } (${teamSlug}) - Primary: ${colors.primary}, Secondary: ${
            colors.secondary
          }`
        );
        updatedCount++;
      } else {
        console.log(`   ⚠️  No colors defined for: ${teamSlug}`);
        teamsWithoutColors.push({
          slug: teamSlug,
          name: team.name_he || team.name_en || team.name,
        });
        notFoundCount++;
      }
    }

    // Summary
    console.log("\n📈 Summary:");
    console.log(`   ✅ Updated: ${updatedCount} teams`);
    console.log(`   ⚠️  Not found in colors mapping: ${notFoundCount} teams`);

    // Show teams without colors
    if (teamsWithoutColors.length > 0) {
      console.log("\n⚠️  Teams without predefined colors:");
      teamsWithoutColors.forEach((team, index) => {
        console.log(`   ${index + 1}. ${team.name} (${team.slug})`);
      });
      console.log(
        "\n💡 You can add colors for these teams in the TEAM_COLORS object."
      );
    }

    console.log("\n✅ Script completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Run the script
updateTeamColors();
