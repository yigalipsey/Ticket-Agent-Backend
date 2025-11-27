import mongoose from "mongoose";
import dotenv from "dotenv";
import Team from "../src/models/Team.js";
import Supplier from "../src/models/Supplier.js";

dotenv.config();

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

const PREMIER_LEAGUE_ID = "68d6809aa0fb97844d2084b9";

async function updateHelloTicketsIds() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB");

        // 1. Get Hello Tickets Supplier
        const supplier = await Supplier.findOne({ slug: "hellotickets" });
        if (!supplier) {
            console.error("Hello Tickets supplier not found!");
            process.exit(1);
        }
        console.log(`Found Supplier: ${supplier.name} (${supplier._id})`);

        // 2. Get Premier League Teams
        const plTeams = await Team.find({ leagueIds: PREMIER_LEAGUE_ID });
        console.log(`Found ${plTeams.length} teams in Premier League (${PREMIER_LEAGUE_ID})`);

        let updatedCount = 0;

        for (const team of plTeams) {
            // Try to find matching team in HELLO_TICKETS_DATA
            // We'll try to match exact name or contains
            const teamName = team.name_en || team.name;

            const match = HELLO_TICKETS_DATA.find(ht => {
                // Normalize names for comparison
                const dbName = teamName.toLowerCase().replace(/[^a-z0-9]/g, "");
                const htName = ht.name.toLowerCase().replace(/[^a-z0-9]/g, "");

                return dbName.includes(htName) || htName.includes(dbName);
            });

            if (match) {
                console.log(`Matched: ${teamName} <-> ${match.name} (ID: ${match.id})`);

                // Update suppliersInfo
                let suppliersInfo = team.suppliersInfo || [];

                // Remove existing Hello Tickets entry if any
                suppliersInfo = suppliersInfo.filter(s => s.supplierRef.toString() !== supplier._id.toString());

                // Add new entry
                suppliersInfo.push({
                    supplierRef: supplier._id,
                    supplierTeamName: match.name,
                    supplierExternalId: match.id
                });

                team.suppliersInfo = suppliersInfo;
                await team.save();
                updatedCount++;
            } else {
                console.log(`⚠️  No match found for: ${teamName}`);
            }
        }

        console.log(`\n=== Update Summary ===`);
        console.log(`Total PL Teams: ${plTeams.length}`);
        console.log(`Updated: ${updatedCount}`);

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected");
    }
}

updateHelloTicketsIds();
