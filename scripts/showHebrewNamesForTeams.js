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

async function showHebrewNamesForTeams() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Get all teams
        const teams = await Team.find({})
            .select('name name_en code slug teamId')
            .lean()
            .sort({ name: 1 });

        // Filter teams where name is not in Hebrew
        const teamsWithNonHebrewNames = teams.filter(team => {
            if (!team.name) {
                return true;
            }
            return !containsHebrew(team.name);
        });

        console.log(`📋 Teams with non-Hebrew names: ${teamsWithNonHebrewNames.length}\n`);
        console.log('='.repeat(100));
        console.log('הצעת שמות בעברית:');
        console.log('='.repeat(100));
        console.log();

        teamsWithNonHebrewNames.forEach((team, index) => {
            const hebrewName = getHebrewNameSuggestion(team.name_en || team.name, team.code);
            console.log(`${index + 1}. ${team.name}`);
            console.log(`   שם בעברית מוצע: "${hebrewName}"`);
            console.log(`   Name EN: ${team.name_en || 'N/A'}`);
            console.log(`   Code: ${team.code || 'N/A'}`);
            console.log(`   Slug: ${team.slug || 'N/A'}`);
            console.log(`   Team ID: ${team.teamId || 'N/A'}`);
            console.log('─'.repeat(100));
        });

        console.log();
        console.log(`📊 סה"כ: ${teamsWithNonHebrewNames.length} קבוצות`);
        console.log();

        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

showHebrewNamesForTeams();

