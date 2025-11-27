import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Team from '../src/models/Team.js';

dotenv.config();

async function checkMissingTeams() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        const missingTeams = [
            'West Ham United',
            'Aston Villa FC',
            'Tottenham Hotspur',
            'Bournemouth FC',
            'Fulham FC',
            'Burnley FC'
        ];

        console.log('🔍 Searching for missing teams in database...\n');

        for (const teamName of missingTeams) {
            console.log(`Looking for: "${teamName}"`);

            // Search with partial match
            const teams = await Team.find({
                $or: [
                    { name_en: new RegExp(teamName.split(' ')[0], 'i') },
                    { name: new RegExp(teamName.split(' ')[0], 'i') }
                ]
            }).select('name_en name').lean();

            if (teams.length > 0) {
                console.log('  Found similar:');
                teams.forEach(t => console.log(`    - ${t.name_en || t.name}`));
            } else {
                console.log('  ❌ Not found');
            }
            console.log('');
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkMissingTeams();
