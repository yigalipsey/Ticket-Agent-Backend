import mongoose from "mongoose";
import dotenv from "dotenv";
import Team from "../src/models/Team.js";
import Supplier from "../src/models/Supplier.js";

dotenv.config();

// The exact list provided by the user
const HELLO_TICKETS_DATA = [
    { id: "444", name: "Manchester City FC" },
    { id: "756", name: "Tottenham Hotspur FC" },
    { id: "422", name: "Liverpool FC" },
    { id: "1836", name: "Chelsea FC" },
    { id: "445", name: "Manchester United FC" },
    { id: "1835", name: "Arsenal FC" },
    { id: "295", name: "Fulham FC" },
    { id: "208", name: "Crystal Palace FC" },
    { id: "81", name: "Aston Villa FC" },
    { id: "520", name: "Newcastle United FC" },
    { id: "268", name: "Everton FC" },
    { id: "802", name: "West Ham United FC" },
    { id: "129", name: "Brentford FC" },
    { id: "53", name: "AFC Bournemouth" },
    { id: "130", name: "Brighton Hove Albion FC" },
    { id: "528", name: "Nottingham Forest FC" },
    { id: "17020", name: "Burnley FC" },
    { id: "28696", name: "Sunderland AFC" },
    { id: "20682", name: "Leeds United FC" },
    { id: "813", name: "Wolverhampton Wanderers FC" },
    { id: "657", name: "Southampton FC" },
    { id: "16149", name: "West Bromwich Albion FC" },
    { id: "407", name: "Leicester City FC" },
    { id: "25234", name: "Watford FC" },
    { id: "22803", name: "Sheffield United FC" },
    { id: "21382", name: "Sheffield Wednesday FC" },
    { id: "29392", name: "Coventry City" },
    { id: "29393", name: "Preston North" },
    { id: "17572", name: "Millwall FC" }
];

// Manual mapping from our DB name_en to the Hello Tickets Name from the list above
// This ensures 100% accuracy based on the user's request
const DB_TO_HT_MAP = {
    "Manchester City": "Manchester City FC",
    "Tottenham Hotspur": "Tottenham Hotspur FC",
    "Liverpool": "Liverpool FC",
    "Chelsea": "Chelsea FC",
    "Manchester United": "Manchester United FC",
    "Arsenal": "Arsenal FC",
    "Fulham": "Fulham FC",
    "Crystal Palace": "Crystal Palace FC",
    "Aston Villa": "Aston Villa FC",
    "Newcastle United": "Newcastle United FC",
    "Everton": "Everton FC",
    "West Ham United": "West Ham United FC",
    "Brentford": "Brentford FC",
    "Bournemouth": "AFC Bournemouth",
    "Brighton & Hove Albion": "Brighton Hove Albion FC",
    "Nottingham Forest": "Nottingham Forest FC",
    "Burnley": "Burnley FC",
    "Sunderland": "Sunderland AFC",
    "Leeds United": "Leeds United FC",
    "Wolves": "Wolverhampton Wanderers FC",
    "Southampton": "Southampton FC",
    "West Bromwich Albion": "West Bromwich Albion FC",
    "Leicester City": "Leicester City FC",
    "Watford": "Watford FC",
    "Sheffield United": "Sheffield United FC",
    "Sheffield Wednesday": "Sheffield Wednesday FC",
    "Coventry City": "Coventry City",
    "Preston North End": "Preston North",
    "Millwall": "Millwall FC",
    // Handling potential variations in DB - based on actual script output
    "Brighton": "Brighton Hove Albion FC",
    "Nottingham": "Nottingham Forest FC",
    "Sheffield Utd": "Sheffield United FC",
    "Preston": "Preston North",
    "Newcastle": "Newcastle United FC",
    "Tottenham": "Tottenham Hotspur FC",
    "West Ham": "West Ham United FC",
    "Leeds": "Leeds United FC"
};

const PREMIER_LEAGUE_ID = "68d6809aa0fb97844d2084b9";

async function forceUpdateHelloTickets() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGODB_URI);

        const supplier = await Supplier.findOne({ slug: "hellotickets" });
        if (!supplier) {
            console.error("Hello Tickets supplier not found!");
            return;
        }

        const teams = await Team.find({ leagueIds: PREMIER_LEAGUE_ID });
        console.log(`Processing ${teams.length} Premier League teams...`);

        for (const team of teams) {
            const dbName = team.name_en || team.name;

            // Find the target name from our map
            let targetHtName = DB_TO_HT_MAP[dbName];

            // If not in map, try to find it in the data list directly (if DB name matches HT name exactly)
            if (!targetHtName) {
                const directMatch = HELLO_TICKETS_DATA.find(d => d.name === dbName);
                if (directMatch) targetHtName = directMatch.name;
            }

            if (!targetHtName) {
                console.log(`⚠️  Skipping ${dbName} - No mapping found in script`);
                continue;
            }

            // Find the full data object
            const htData = HELLO_TICKETS_DATA.find(d => d.name === targetHtName);

            if (!htData) {
                console.log(`⚠️  Skipping ${dbName} - Mapped to ${targetHtName} but data missing in list`);
                continue;
            }

            // Update the team
            let suppliersInfo = team.suppliersInfo || [];

            // Remove old entry
            suppliersInfo = suppliersInfo.filter(s => s.supplierRef.toString() !== supplier._id.toString());

            // Add new exact entry
            suppliersInfo.push({
                supplierRef: supplier._id,
                supplierTeamName: htData.name,
                supplierExternalId: htData.id
            });

            team.suppliersInfo = suppliersInfo;
            await team.save();

            console.log(`✅ Updated ${dbName} -> ${htData.name} (ID: ${htData.id})`);
        }

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await mongoose.disconnect();
    }
}

forceUpdateHelloTickets();
