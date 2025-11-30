import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Team from '../src/models/Team.js';
import League from '../src/models/League.js';

dotenv.config();

// Teams to add to Champions League (by slug)
const TEAMS_TO_ADD = [
  'borussia-dortmund',
  'bayer-leverkusen',
  'bayern-munich',
  'eintracht-frankfurt'
];

async function addTeamsToChampionsLeague() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find Champions League
    const championsLeague = await League.findOne({ slug: 'champions-league' });
    if (!championsLeague) {
      console.error('❌ Champions League not found!');
      process.exit(1);
    }
    console.log(`✅ Found Champions League: ${championsLeague.name} (${championsLeague._id})\n`);

    let addedCount = 0;
    let alreadyInLeagueCount = 0;
    let notFoundCount = 0;

    for (const slug of TEAMS_TO_ADD) {
      const team = await Team.findOne({ slug });
      
      if (!team) {
        console.log(`⚠️  Team not found: ${slug}`);
        notFoundCount++;
        continue;
      }

      // Check if team already in Champions League
      const leagueIdStr = championsLeague._id.toString();
      const hasLeague = team.leagueIds.some(
        (lid) => lid.toString() === leagueIdStr
      );

      if (hasLeague) {
        console.log(`ℹ️  ${team.name} (${slug}) already in Champions League`);
        alreadyInLeagueCount++;
      } else {
        // Add league to team
        team.leagueIds.push(championsLeague._id);
        await team.save();
        console.log(`✅ Added ${team.name} (${slug}) to Champions League`);
        addedCount++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Added: ${addedCount} teams`);
    console.log(`   ℹ️  Already in league: ${alreadyInLeagueCount} teams`);
    console.log(`   ⚠️  Not found: ${notFoundCount} teams`);

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addTeamsToChampionsLeague();





