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

async function verifyAndRemoveNameHe() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Get all teams
        const teams = await Team.find({})
            .select('name name_en name_he code slug teamId')
            .lean()
            .sort({ name: 1 });

        console.log(`📊 Total teams in database: ${teams.length}\n`);

        // Check if name field contains Hebrew
        let teamsWithNonHebrewNames = [];
        let teamsWithNameHe = [];

        teams.forEach(team => {
            // Check if name contains Hebrew
            if (!team.name || !containsHebrew(team.name)) {
                teamsWithNonHebrewNames.push(team);
            }
            
            // Track teams that have name_he field
            if (team.name_he) {
                teamsWithNameHe.push(team);
            }
        });

        console.log('─'.repeat(80));
        console.log('📋 VERIFICATION RESULTS:');
        console.log('─'.repeat(80));
        console.log(`Total teams: ${teams.length}`);
        console.log(`Teams with Hebrew names in 'name' field: ${teams.length - teamsWithNonHebrewNames.length}`);
        console.log(`Teams with non-Hebrew names in 'name' field: ${teamsWithNonHebrewNames.length}`);
        console.log(`Teams with 'name_he' field: ${teamsWithNameHe.length}`);
        console.log('─'.repeat(80));

        // Show teams with non-Hebrew names if any
        if (teamsWithNonHebrewNames.length > 0) {
            console.log('\n⚠️  WARNING: Found teams with non-Hebrew names in "name" field:\n');
            teamsWithNonHebrewNames.slice(0, 10).forEach((team, index) => {
                console.log(`${index + 1}. Name: "${team.name}"`);
                console.log(`   Name EN: ${team.name_en || 'N/A'}`);
                console.log(`   Name HE: ${team.name_he || 'N/A'}`);
                console.log(`   Code: ${team.code || 'N/A'}`);
                console.log('─'.repeat(80));
            });
            if (teamsWithNonHebrewNames.length > 10) {
                console.log(`\n... and ${teamsWithNonHebrewNames.length - 10} more teams\n`);
            }
        }

        // Show sample of teams with name_he
        if (teamsWithNameHe.length > 0) {
            console.log('\n📋 Sample teams with "name_he" field:\n');
            teamsWithNameHe.slice(0, 5).forEach((team, index) => {
                console.log(`${index + 1}. Name: "${team.name}"`);
                console.log(`   Name EN: ${team.name_en || 'N/A'}`);
                console.log(`   Name HE: "${team.name_he}"`);
                console.log(`   Code: ${team.code || 'N/A'}`);
                console.log('─'.repeat(80));
            });
        }

        // If all teams have Hebrew names, proceed with removal
        if (teamsWithNonHebrewNames.length === 0) {
            console.log('\n✅ All teams have Hebrew names in "name" field!');
            console.log('\n🗑️  Proceeding to remove "name_he" field from all teams...\n');

            // Remove name_he from all teams
            const result = await Team.updateMany(
                { name_he: { $exists: true } },
                { $unset: { name_he: "" } }
            );

            console.log(`✅ Removed "name_he" field from ${result.modifiedCount} teams`);
            console.log(`📊 Matched ${result.matchedCount} teams`);
        } else {
            console.log('\n❌ Cannot proceed: Some teams have non-Hebrew names in "name" field');
            console.log('Please fix these teams first before removing "name_he"');
        }

        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

verifyAndRemoveNameHe();



