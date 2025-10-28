import dotenv from "dotenv";
import databaseConnection from "./src/config/database.js";
import Team from "./src/models/Team.js";

dotenv.config();

const searchTeams = ["Paphos", "Qarabag"];

async function search() {
  await databaseConnection.connect(process.env.MONGODB_URI);
  
  // Get all Champions League teams
  const championsLeague = await Team.db.collection('leagues').findOne({ name: "Champions League" });
  
  if (championsLeague) {
    const allTeams = await Team.find({ leagueIds: championsLeague._id }).select("name_en slug name").lean();
    
    console.log("\nAll Champions League teams:");
    allTeams.forEach(team => {
      console.log(`  - ${team.name_en || team.name} (${team.slug})`);
    });
  }
  
  await databaseConnection.disconnect();
}

search().catch(console.error);

