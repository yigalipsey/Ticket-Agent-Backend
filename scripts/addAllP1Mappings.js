import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Team from '../src/models/Team.js';
import Supplier from '../src/models/Supplier.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

/**
 * Add ALL P1 team names from the JSON file to the database mappings
 */
async function addAllP1Mappings() {
    try {
        console.log('🔄 Adding ALL P1 team name mappings...\n');

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Get P1 supplier
        const p1Supplier = await Supplier.findOne({ slug: 'p1-travel' });
        if (!p1Supplier) {
            console.log('❌ P1 Travel supplier not found');
            await mongoose.disconnect();
            return;
        }

        // Read the P1 data
        const shirtUrlsPath = path.join(__dirname, '../data/team-shirt-urls.json');
        const shirtUrlsData = fs.readFileSync(shirtUrlsPath, 'utf-8');
        const p1Data = JSON.parse(shirtUrlsData);
        const p1TeamNames = Object.keys(p1Data);

        console.log(`📋 Processing ${p1TeamNames.length} teams from P1 data...\n`);

        let updatedCount = 0;

        for (const p1Name of p1TeamNames) {
            // Try to find the team in our DB
            // We search by:
            // 1. Exact English name match
            // 2. Partial English name match (e.g. "Arsenal" in "Arsenal FC")
            // 3. Existing supplier mapping (if we already added it)

            let team = await Team.findOne({
                $or: [
                    { name_en: p1Name }, // Exact match
                    { name_en: new RegExp(`^${p1Name}$`, 'i') }, // Case insensitive
                    { name: p1Name },
                    { 'suppliersInfo.supplierTeamName': p1Name } // Already mapped
                ]
            });

            // If not found exact, try looser search (e.g. "Manchester United" vs "Manchester United FC")
            if (!team) {
                // Try finding our team name inside P1 name or vice versa
                const allTeams = await Team.find({}).select('name_en name');
                team = allTeams.find(t =>
                    (t.name_en && p1Name.toLowerCase().includes(t.name_en.toLowerCase())) ||
                    (t.name_en && t.name_en.toLowerCase().includes(p1Name.toLowerCase()))
                );
            }

            if (team) {
                // Check if this specific mapping already exists
                const existingMapping = team.suppliersInfo?.find(
                    sn => sn.supplierRef.toString() === p1Supplier._id.toString() && sn.supplierTeamName === p1Name
                );

                if (!existingMapping) {
                    if (!team.suppliersInfo) team.suppliersInfo = [];

                    team.suppliersInfo.push({
                        supplierRef: p1Supplier._id,
                        supplierTeamName: p1Name
                    });

                    await team.save();
                    console.log(`✅ Added mapping: "${p1Name}" -> ${team.name_en}`);
                    updatedCount++;
                } else {
                    console.log(`ℹ️  Already mapped: "${p1Name}" -> ${team.name_en}`);
                }
            } else {
                console.log(`❌ Could not match P1 team: "${p1Name}" to any DB team`);
            }
        }

        console.log(`\n✨ Update complete! Added ${updatedCount} new mappings.`);

        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB');

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

addAllP1Mappings();
