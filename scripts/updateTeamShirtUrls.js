import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Team from '../src/models/Team.js';
import Supplier from '../src/models/Supplier.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

/**
 * Update Premier League teams with shirt image URLs from P1
 */
async function updateTeamShirtUrls() {
    try {
        console.log('🔄 Starting team shirt URL update...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Read the shirt URLs JSON file
        const shirtUrlsPath = path.join(__dirname, '../data/team-shirt-urls.json');
        const shirtUrlsData = fs.readFileSync(shirtUrlsPath, 'utf-8');
        const teamShirtUrls = JSON.parse(shirtUrlsData);

        console.log(`📋 Found ${Object.keys(teamShirtUrls).length} teams with shirt URLs\n`);

        // Get P1 supplier ID
        const p1Supplier = await Supplier.findOne({ slug: 'p1-travel' });

        if (!p1Supplier) {
            console.log('⚠️  P1 supplier not found. Team matching may be less accurate.');
        }

        let updatedCount = 0;
        let notFoundCount = 0;
        const notFoundTeams = [];

        // Update each team
        for (const [teamName, shirtUrl] of Object.entries(teamShirtUrls)) {
            console.log(`🔍 Looking for team: ${teamName}`);

            let team;

            // First, try to find by supplier name mapping (if P1 supplier exists)
            if (p1Supplier) {
                team = await Team.findOne({
                    'supplierNames': {
                        $elemMatch: {
                            supplierId: p1Supplier._id,
                            name: teamName
                        }
                    }
                });
            }

            // If not found, try traditional name matching
            if (!team) {
                team = await Team.findOne({
                    $or: [
                        { name_en: teamName },
                        { name_en: new RegExp(`^${teamName}$`, 'i') },
                        { name: teamName },
                        { name: new RegExp(`^${teamName}$`, 'i') }
                    ]
                });
            }

            if (team) {
                // Update the shirt image URL
                team.shirtImageUrl = shirtUrl;
                await team.save();

                console.log(`   ✅ Updated: ${team.name_en || team.name}`);
                console.log(`   🎽 URL: ${shirtUrl}\n`);
                updatedCount++;
            } else {
                console.log(`   ❌ Team not found in database\n`);
                notFoundCount++;
                notFoundTeams.push(teamName);
            }
        }

        console.log('\n================================');
        console.log('📊 Update Summary:');
        console.log('================================');
        console.log(`✅ Teams updated: ${updatedCount}`);
        console.log(`❌ Teams not found: ${notFoundCount}`);

        if (notFoundTeams.length > 0) {
            console.log('\n⚠️  Teams not found in database:');
            notFoundTeams.forEach(team => console.log(`   - ${team}`));
            console.log('\n💡 Tip: Check if team names in P1 CSV match your database team names');
        }

        console.log('\n✨ Update complete!\n');

        // Disconnect from MongoDB
        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    }
}

// Run the update
updateTeamShirtUrls();
