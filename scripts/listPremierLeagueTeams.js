import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Team from '../src/models/Team.js';
import League from '../src/models/League.js';
import Supplier from '../src/models/Supplier.js';

dotenv.config();

async function listPremierLeagueTeams() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Find Premier League
        const premierLeague = await League.findOne({
            $or: [
                { name_en: /premier league/i },
                { name: /premier league/i }
            ]
        });

        if (!premierLeague) {
            console.log('❌ Premier League not found');
            await mongoose.disconnect();
            return;
        }

        console.log(`🏆 Premier League ID: ${premierLeague._id}\n`);

        // Find all teams in Premier League
        const teams = await Team.find({
            leagueIds: premierLeague._id
        })
            .populate('supplierNames.supplierId', 'name slug')
            .sort({ name_en: 1 })
            .lean();

        console.log(`📋 Found ${teams.length} Premier League teams:\n`);
        console.log('================================\n');

        teams.forEach((team, index) => {
            console.log(`${index + 1}. ${team.name_en || team.name} (${team.name})`);
            console.log(`   Code: ${team.code}`);
            console.log(`   Slug: ${team.slug}`);

            if (team.supplierNames && team.supplierNames.length > 0) {
                console.log(`   Supplier Names:`);
                team.supplierNames.forEach(sn => {
                    const supplierName = sn.supplierId?.name || sn.supplierId;
                    console.log(`     - ${supplierName}: "${sn.name}"`);
                });
            }

            if (team.shirtImageUrl) {
                console.log(`   🎽 Shirt: ${team.shirtImageUrl}`);
            }

            console.log('');
        });

        console.log('================================');
        console.log(`📊 Total: ${teams.length} teams\n`);

        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    }
}

listPremierLeagueTeams();
