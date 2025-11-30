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

/**
 * Get Hebrew name suggestion for a team
 * @param {string} nameEn - English name
 * @param {string} code - Team code
 * @returns {string} - Suggested Hebrew name
 */
function getHebrewNameSuggestion(nameEn, code) {
    const hebrewNames = {
        // Italian teams (Serie A)
        'AC Milan': 'מילאן',
        'AS Roma': 'רומא',
        'Bologna': 'בולוניה',
        'Cagliari': 'קליארי',
        'Como': 'קומו',
        'Cremonese': 'קרמונזה',
        'Fiorentina': 'פיורנטינה',
        'Genoa': 'גנואה',
        'Lazio': 'לאציו',
        'Lecce': 'לצ\'ה',
        'Parma': 'פארמה',
        'Pisa': 'פיזה',
        'Sassuolo': 'ססואולו',
        'Torino': 'טורינו',
        'Udinese': 'אודינזה',
        'Verona': 'ורונה',
        
        // French teams (Ligue 1)
        'Angers': 'אנז\'ה',
        'Auxerre': 'אוסר',
        'Le Havre': 'לה הבר',
        'Lens': 'לאנס',
        'Lille': 'ליל',
        'Lorient': 'לוריאן',
        'Lyon': 'ליון',
        'Metz': 'מץ',
        'Nantes': 'נאנט',
        'Paris FC': 'פריז',
        'Rennes': 'רן',
        'Stade Brestois 29': 'ברסט',
        'Strasbourg': 'שטרסבורג',
        'Toulouse': 'טולוז',
    };
    
    return hebrewNames[nameEn] || nameEn;
}

async function updateTeamsWithHebrewNames() {
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
                return true;
            }
            return !containsHebrew(team.name);
        });

        console.log(`🔍 Found ${teamsWithNonHebrewNames.length} teams with non-Hebrew names\n`);
        console.log('='.repeat(100));
        console.log('🔄 Updating teams with Hebrew names...');
        console.log('='.repeat(100));
        console.log();

        let updatedCount = 0;
        let errorCount = 0;

        // Update each team
        for (const team of teamsWithNonHebrewNames) {
            try {
                const hebrewName = getHebrewNameSuggestion(team.name_en || team.name, team.code);
                
                // Update the team
                await Team.findByIdAndUpdate(team._id, {
                    $set: { name: hebrewName }
                });

                console.log(`✅ Updated: ${team.name_en || team.name} → "${hebrewName}"`);
                updatedCount++;
            } catch (error) {
                console.error(`❌ Error updating team ${team.name_en || team.name}:`, error.message);
                errorCount++;
            }
        }

        console.log();
        console.log('='.repeat(100));
        console.log('📊 Update Summary:');
        console.log('='.repeat(100));
        console.log(`✅ Teams updated: ${updatedCount}`);
        console.log(`❌ Errors: ${errorCount}`);
        console.log();

        // Verify that all teams now have Hebrew names
        console.log('🔍 Verifying all teams have Hebrew names...');
        console.log();

        const allTeams = await Team.find({})
            .select('name name_en code slug teamId')
            .lean();

        const teamsStillWithoutHebrew = allTeams.filter(team => {
            if (!team.name) {
                return true;
            }
            return !containsHebrew(team.name);
        });

        if (teamsStillWithoutHebrew.length === 0) {
            console.log('✅ SUCCESS! All teams now have Hebrew names!');
        } else {
            console.log(`⚠️  WARNING: Found ${teamsStillWithoutHebrew.length} teams still without Hebrew names:`);
            console.log();
            teamsStillWithoutHebrew.forEach((team, index) => {
                console.log(`${index + 1}. ${team.name} (${team.name_en || 'N/A'}) - Code: ${team.code || 'N/A'}`);
            });
        }

        console.log();

        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

updateTeamsWithHebrewNames();




