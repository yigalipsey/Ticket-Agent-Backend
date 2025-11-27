import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Team from '../src/models/Team.js';

dotenv.config();

async function listTeams() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        const teams = await Team.find({}).select('name_en name').lean().sort({ name_en: 1 });

        console.log('📋 Teams in database:\n');
        teams.forEach((team, index) => {
            console.log(`${index + 1}. ${team.name_en || team.name}`);
        });

        console.log(`\n📊 Total: ${teams.length} teams`);

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

listTeams();
