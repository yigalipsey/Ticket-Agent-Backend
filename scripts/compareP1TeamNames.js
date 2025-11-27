import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Team from '../src/models/Team.js';
import League from '../src/models/League.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

/**
 * Compare P1 team names with our database teams
 */
async function compareP1TeamNames() {
    try {
        console.log('🔄 Comparing P1 team names with database...\n');

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Read the team shirt URLs JSON (which has P1 team names)
        const shirtUrlsPath = path.join(__dirname, '../data/team-shirt-urls.json');
        const shirtUrlsData = fs.readFileSync(shirtUrlsPath, 'utf-8');
        const p1Teams = Object.keys(JSON.parse(shirtUrlsData));

        console.log(`📋 Found ${p1Teams.length} teams from P1\n`);

        // Get Premier League teams from our database
        const premierLeague = await League.findOne({
            $or: [
                { name_en: /premier league/i },
                { name: /premier league/i }
            ]
        });

        const ourTeams = await Team.find({
            leagueIds: premierLeague._id
        })
            .select('name_en name_he code slug supplierNames')
            .sort({ name_en: 1 })
            .lean();

        console.log(`📋 Found ${ourTeams.length} teams in our database\n`);
        console.log('================================');
        console.log('🔍 COMPARISON:\n');

        // Create a map for easy lookup
        const ourTeamsMap = new Map();
        ourTeams.forEach(team => {
            ourTeamsMap.set(team.name_en.toLowerCase(), team);
        });

        const matched = [];
        const unmatched = [];

        p1Teams.forEach(p1Name => {
            console.log(`\n📌 P1: "${p1Name}"`);

            // Try to find exact match
            let foundTeam = null;

            // Check if already mapped
            const alreadyMapped = ourTeams.find(t =>
                t.supplierNames?.some(sn => sn.name === p1Name)
            );

            if (alreadyMapped) {
                console.log(`   ✅ Already mapped to: ${alreadyMapped.name_en} (${alreadyMapped.name})`);
                matched.push({ p1Name, ourTeam: alreadyMapped, status: 'mapped' });
                return;
            }

            // Try exact match
            foundTeam = ourTeamsMap.get(p1Name.toLowerCase());

            // Try partial match
            if (!foundTeam) {
                const p1NameLower = p1Name.toLowerCase();
                for (const [key, team] of ourTeamsMap) {
                    if (p1NameLower.includes(key) || key.includes(p1NameLower.split(' ')[0])) {
                        foundTeam = team;
                        break;
                    }
                }
            }

            if (foundTeam) {
                console.log(`   🔍 Possible match: ${foundTeam.name_en} (${foundTeam.name})`);
                console.log(`   Code: ${foundTeam.code}, Slug: ${foundTeam.slug}`);
                matched.push({ p1Name, ourTeam: foundTeam, status: 'suggested' });
            } else {
                console.log(`   ❓ No match found - needs manual mapping`);
                unmatched.push(p1Name);
            }
        });

        console.log('\n\n================================');
        console.log('📊 SUMMARY:\n');
        console.log(`✅ Already mapped: ${matched.filter(m => m.status === 'mapped').length}`);
        console.log(`🔍 Suggested matches: ${matched.filter(m => m.status === 'suggested').length}`);
        console.log(`❓ Needs manual mapping: ${unmatched.length}\n`);

        if (unmatched.length > 0) {
            console.log('❓ Teams needing manual mapping:');
            unmatched.forEach(name => console.log(`   - ${name}`));
            console.log('\n');
        }

        console.log('================================');
        console.log('📋 OUR DATABASE TEAMS:\n');
        ourTeams.forEach((team, index) => {
            const hasMappingFromP1 = matched.some(m =>
                m.ourTeam && m.ourTeam.slug === team.slug
            );
            const icon = hasMappingFromP1 ? '✅' : '⚪';
            console.log(`${icon} ${index + 1}. ${team.name_en} (${team.name}) - ${team.code}`);
        });

        console.log('\n================================\n');

        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    }
}

compareP1TeamNames();
