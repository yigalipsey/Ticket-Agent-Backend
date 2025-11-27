import mongoose from "mongoose";
import dotenv from "dotenv";
import Team from "../src/models/Team.js";
import Supplier from "../src/models/Supplier.js";

dotenv.config();

async function updateWolvesMapping() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGODB_URI);

        const supplier = await Supplier.findOne({ slug: "hellotickets" });
        if (!supplier) {
            console.error("Hello Tickets supplier not found!");
            return;
        }

        // Find Wolves team - trying common variations
        const wolves = await Team.findOne({
            $or: [
                { name_en: "Wolves" },
                { name: "Wolves" },
                { name_en: /Wolverhampton/i }
            ]
        });

        if (!wolves) {
            console.error("Wolves team not found in DB!");
            return;
        }

        console.log(`Found team: ${wolves.name_en || wolves.name} (${wolves._id})`);

        let suppliersInfo = wolves.suppliersInfo || [];

        // Remove existing Hello Tickets entry if any
        suppliersInfo = suppliersInfo.filter(s => s.supplierRef.toString() !== supplier._id.toString());

        // Add correct entry
        suppliersInfo.push({
            supplierRef: supplier._id,
            supplierTeamName: "Wolverhampton Wanderers FC",
            supplierExternalId: "813"
        });

        wolves.suppliersInfo = suppliersInfo;
        await wolves.save();

        console.log("✅ Successfully updated Wolves mapping for Hello Tickets (ID: 813)");

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await mongoose.disconnect();
    }
}

updateWolvesMapping();
