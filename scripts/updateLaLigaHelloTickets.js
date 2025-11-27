import mongoose from "mongoose";
import dotenv from "dotenv";
import Team from "../src/models/Team.js";
import Supplier from "../src/models/Supplier.js";

dotenv.config();

const HELLO_TICKETS_LA_LIGA_DATA = [
    { id: "598", name: "Real Madrid CF" },
    { id: "272", name: "FC Barcelona" },
    { id: "89", name: "Atletico de Madrid" },
    { id: "643", name: "Sevilla FC" },
    { id: "600", name: "Real Sociedad" },
    { id: "597", name: "Real Betis Balompie" },
    { id: "780", name: "Valencia CF" },
    { id: "83", name: "Athletic Club" },
    { id: "594", name: "RC Celta de Vigo" },
    { id: "296", name: "Getafe CF" },
    { id: "1861", name: "RCD Espanyol" },
    { id: "596", name: "RCD Mallorca" },
    { id: "227", name: "Deportivo Alaves" },
    { id: "302", name: "Girona FC" },
    { id: "769", name: "UD Las Palmas" },
    { id: "592", name: "Rayo Vallecano" },
    { id: "28699", name: "Elche CF" },
    { id: "28698", name: "Levante UD" },
    { id: "5976", name: "Villarreal CF" },
    { id: "3768", name: "CA Osasuna" }
];

const DB_TO_HT_MAP = {
    "Real Madrid": "Real Madrid CF",
    "Barcelona": "FC Barcelona",
    "Atletico Madrid": "Atletico de Madrid",
    "Sevilla": "Sevilla FC",
    "Real Sociedad": "Real Sociedad",
    "Real Betis": "Real Betis Balompie",
    "Valencia": "Valencia CF",
    "Athletic Bilbao": "Athletic Club",
    "Athletic Club": "Athletic Club",
    "Celta Vigo": "RC Celta de Vigo",
    "Getafe": "Getafe CF",
    "Espanyol": "RCD Espanyol",
    "Mallorca": "RCD Mallorca",
    "Alaves": "Deportivo Alaves",
    "Girona": "Girona FC",
    "Las Palmas": "UD Las Palmas",
    "Rayo Vallecano": "Rayo Vallecano",
    "Elche": "Elche CF",
    "Levante": "Levante UD",
    "Villarreal": "Villarreal CF",
    "Osasuna": "CA Osasuna"
};

const LA_LIGA_ID = "68da875303bee90385d564b9";

async function updateLaLigaHelloTickets() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGODB_URI);

        const supplier = await Supplier.findOne({ slug: "hellotickets" });
        if (!supplier) {
            console.error("Hello Tickets supplier not found!");
            return;
        }

        const teams = await Team.find({ leagueIds: LA_LIGA_ID });
        console.log(`Processing ${teams.length} La Liga teams...`);

        let updatedCount = 0;
        const notFound = [];

        for (const team of teams) {
            const dbName = team.name_en || team.name;

            let targetHtName = DB_TO_HT_MAP[dbName];

            if (!targetHtName) {
                const directMatch = HELLO_TICKETS_LA_LIGA_DATA.find(d => d.name === dbName);
                if (directMatch) targetHtName = directMatch.name;
            }

            if (!targetHtName) {
                console.log(`⚠️  Skipping ${dbName} - No mapping found`);
                notFound.push(dbName);
                continue;
            }

            const htData = HELLO_TICKETS_LA_LIGA_DATA.find(d => d.name === targetHtName);

            if (!htData) {
                console.log(`⚠️  Skipping ${dbName} - Mapped to ${targetHtName} but data missing`);
                notFound.push(dbName);
                continue;
            }

            let suppliersInfo = team.suppliersInfo || [];
            suppliersInfo = suppliersInfo.filter(s => s.supplierRef.toString() !== supplier._id.toString());

            suppliersInfo.push({
                supplierRef: supplier._id,
                supplierTeamName: htData.name,
                supplierExternalId: htData.id
            });

            team.suppliersInfo = suppliersInfo;
            await team.save();

            console.log(`✅ Updated ${dbName} -> ${htData.name} (ID: ${htData.id})`);
            updatedCount++;
        }

        console.log(`\n=== Summary ===`);
        console.log(`Total La Liga teams in DB: ${teams.length}`);
        console.log(`Updated: ${updatedCount}`);

        if (notFound.length > 0) {
            console.log(`\nTeams not found in Hello Tickets data:`);
            notFound.forEach(name => console.log(`  - ${name}`));
        }

        // Check which Hello Tickets teams are not in our DB
        const dbTeamNames = teams.map(t => t.name_en || t.name);
        const missingInDb = HELLO_TICKETS_LA_LIGA_DATA.filter(ht => {
            const mapped = Object.values(DB_TO_HT_MAP).includes(ht.name);
            const direct = dbTeamNames.includes(ht.name);
            return !mapped && !direct;
        });

        if (missingInDb.length > 0) {
            console.log(`\nHello Tickets teams NOT in our database:`);
            missingInDb.forEach(ht => console.log(`  - ${ht.name} (ID: ${ht.id})`));
        }

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await mongoose.disconnect();
    }
}

updateLaLigaHelloTickets();
