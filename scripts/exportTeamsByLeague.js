import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Team from '../src/models/Team.js';
import League from '../src/models/League.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function exportTeamsByLeague() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Get all leagues
        const leagues = await League.find({}).lean().sort({ name: 1 });
        console.log(`📋 Found ${leagues.length} leagues\n`);

        // Create dataFromMongo directory if it doesn't exist
        const outputDir = path.join(__dirname, '../data/dataFromMongo');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
            console.log(`📁 Created directory: ${outputDir}\n`);
        }

        // Process each league
        for (const league of leagues) {
            console.log(`Processing league: ${league.name} (${league.slug})`);
            
            // Find teams that belong to this league
            const teams = await Team.find({
                leagueIds: league._id
            })
            .select('name slug _id')
            .lean()
            .sort({ name: 1 });

            // Prepare teams data
            const teamsData = teams.map(team => ({
                _id: team._id.toString(),
                name: team.name,
                slug: team.slug
            }));

            // Create filename from league slug
            const filename = `${league.slug}.json`;
            const filepath = path.join(outputDir, filename);

            // Write to file
            fs.writeFileSync(filepath, JSON.stringify(teamsData, null, 2), 'utf8');
            console.log(`  ✅ Exported ${teamsData.length} teams to ${filename}`);
        }

        console.log(`\n📊 Export completed! Files saved to: ${outputDir}`);
        console.log(`📁 Total leagues processed: ${leagues.length}`);

        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

exportTeamsByLeague();





