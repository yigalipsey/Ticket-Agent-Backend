import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Team from '../src/models/Team.js';
import Supplier from '../src/models/Supplier.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

/**
 * Process Spanish teams: extract shirts, map names, and update DB
 */
async function processSpanishTeams() {
    try {
        console.log('🇪🇸 Processing Spanish La Liga teams...\n');

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Get P1 supplier
        const p1Supplier = await Supplier.findOne({ slug: 'p1-travel' });
        if (!p1Supplier) {
            console.log('❌ P1 Travel supplier not found');
            await mongoose.disconnect();
            return;
        }

        // Read CSV
        const csvPath = path.join(__dirname, '../data/p1-offers.csv');
        const fileContent = fs.readFileSync(csvPath, 'utf-8');
        const records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true
        });

        // Filter for Spanish teams (La Liga)
        const spanishRecords = records.filter(record => {
            const categoryPath = (record.categoryPath || record.CategoryPath || '').toLowerCase();
            return categoryPath.includes('la liga') ||
                categoryPath.includes('spanish league') ||
                categoryPath.includes('primera division');
        });

        console.log(`Found ${spanishRecords.length} Spanish league records\n`);

        // Extract unique teams and their shirt URLs
        const teamData = new Map();

        spanishRecords.forEach(record => {
            const teamName = record.brand || '';
            const shirtUrl = record.home_shirt_image_link || '';

            if (teamName && shirtUrl && !teamData.has(teamName)) {
                teamData.set(teamName, shirtUrl);
            }
        });

        console.log(`📋 Found ${teamData.size} unique Spanish teams with shirt URLs:\n`);

        let updatedCount = 0;
        let notFoundCount = 0;

        for (const [p1Name, shirtUrl] of teamData) {
            console.log(`🔍 Processing: ${p1Name}`);

            // Try to find team in DB
            let team = await Team.findOne({
                $or: [
                    { name_en: p1Name },
                    { name_en: new RegExp(`^${p1Name}$`, 'i') },
                    { name: p1Name },
                    { 'supplierNames.name': p1Name }
                ]
            });

            // If not found exact, try looser search
            if (!team) {
                const allTeams = await Team.find({}).select('name_en name');
                team = allTeams.find(t =>
                    (t.name_en && p1Name.toLowerCase().includes(t.name_en.toLowerCase())) ||
                    (t.name_en && t.name_en.toLowerCase().includes(p1Name.toLowerCase()))
                );
            }

            if (team) {
                // 1. Update Supplier Name Mapping
                const existingMapping = team.supplierNames?.find(
                    sn => sn.supplierId.toString() === p1Supplier._id.toString() && sn.name === p1Name
                );

                if (!existingMapping) {
                    if (!team.supplierNames) team.supplierNames = [];
                    team.supplierNames.push({
                        supplierId: p1Supplier._id,
                        name: p1Name
                    });
                    console.log(`   ✅ Added mapping: "${p1Name}" -> ${team.name_en}`);
                } else {
                    console.log(`   ℹ️  Mapping exists: "${p1Name}" -> ${team.name_en}`);
                }

                // 2. Update Shirt URL
                if (shirtUrl) {
                    team.shirtImageUrl = shirtUrl;
                    console.log(`   🎽 Updated shirt URL`);
                }

                await team.save();
                updatedCount++;
            } else {
                console.log(`   ❌ Team not found in DB`);
                notFoundCount++;
            }
            console.log('');
        }

        console.log('================================');
        console.log(`📊 Summary:`);
        console.log(`✅ Teams updated: ${updatedCount}`);
        console.log(`❌ Teams not found: ${notFoundCount}`);
        console.log('================================\n');

        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB');

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

processSpanishTeams();
