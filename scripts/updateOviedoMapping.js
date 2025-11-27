import mongoose from "mongoose";
import dotenv from "dotenv";
import Team from "../src/models/Team.js";
import Supplier from "../src/models/Supplier.js";

dotenv.config();

async function updateOviedoMapping() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGODB_URI);

        const supplier = await Supplier.findOne({ slug: "hellotickets" });
        if (!supplier) {
            console.error("Hello Tickets supplier not found!");
            return;
        }

        // Find Oviedo team
        const oviedo = await Team.findOne({
            $or: [
                { name_en: "Oviedo" },
                { name: "Oviedo" },
                { name_en: /Oviedo/i }
            ]
        });

        if (!oviedo) {
            console.error("Oviedo team not found in DB!");
            return;
        }

        console.log(`Found team: ${oviedo.name_en || oviedo.name} (${oviedo._id})`);

        let suppliersInfo = oviedo.suppliersInfo || [];

        // Remove existing Hello Tickets entry if any
        suppliersInfo = suppliersInfo.filter(s => s.supplierRef.toString() !== supplier._id.toString());

        // Add correct entry
        suppliersInfo.push({
            supplierRef: supplier._id,
            supplierTeamName: "Real Oviedo",
            supplierExternalId: "28700"
        });

        oviedo.suppliersInfo = suppliersInfo;
        await oviedo.save();

        console.log("✅ Successfully updated Oviedo mapping for Hello Tickets (ID: 28700)");

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await mongoose.disconnect();
    }
}

updateOviedoMapping();
