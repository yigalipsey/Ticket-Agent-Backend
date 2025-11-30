import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Team from '../src/models/Team.js';

dotenv.config();

/**
 * Check if a string contains Hebrew characters
 * @param {string} str - String to check
 * @returns {boolean} - True if string contains Hebrew characters
 */
function containsHebrew(str) {
    if (!str || typeof str !== 'string') {
        return false;
    }
    // Hebrew Unicode range: \u0590-\u05FF
    const hebrewRegex = /[\u0590-\u05FF]/;
    return hebrewRegex.test(str);
}

async function findTeamsWithNonHebrewNames() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Get all teams
        const teams = await Team.find({})
            .select('name name_en code slug teamId')
            .lean()
            .sort({ name: 1 });

        console.log(`📊 Total teams in database: ${teams.length}\n`);

        // Filter teams where name is not in Hebrew
        const teamsWithNonHebrewNames = teams.filter(team => {
            if (!team.name) {
                return true; // Include teams with no name
            }
            return !containsHebrew(team.name);
        });

        console.log(`🔍 Teams with non-Hebrew names: ${teamsWithNonHebrewNames.length}\n`);

        if (teamsWithNonHebrewNames.length > 0) {
            console.log('📋 List of teams with non-Hebrew names:\n');
            console.log('─'.repeat(80));
            teamsWithNonHebrewNames.forEach((team, index) => {
                console.log(`${index + 1}. Name: "${team.name}"`);
                console.log(`   Name EN: ${team.name_en || 'N/A'}`);
                console.log(`   Code: ${team.code || 'N/A'}`);
                console.log(`   Slug: ${team.slug || 'N/A'}`);
                console.log(`   Team ID: ${team.teamId || 'N/A'}`);
                console.log('─'.repeat(80));
            });
        } else {
            console.log('✅ All teams have Hebrew names!');
        }

        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

findTeamsWithNonHebrewNames();




