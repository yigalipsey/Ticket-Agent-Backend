import mongoose from 'mongoose';
import 'dotenv/config';
import Team from '../src/models/Team.js';
import FootballEvent from '../src/models/FootballEvent.js';

await mongoose.connect(process.env.MONGODB_URI);

const liverpool = await Team.findOne({ slug: 'liverpool' });
const leeds = await Team.findOne({ slug: 'leeds' });

if (!liverpool || !leeds) {
    console.log('Teams not found');
    process.exit(1);
}

console.log(`Liverpool ID: ${liverpool._id}`);
console.log(`Leeds ID: ${leeds._id}`);

// Search for any match between Liverpool and Leeds around Jan 1, 2026
const matches = await FootballEvent.find({
    $or: [
        { homeTeam: liverpool._id, awayTeam: leeds._id },
        { homeTeam: leeds._id, awayTeam: liverpool._id }
    ],
    date: {
        $gte: new Date('2025-12-15'),
        $lte: new Date('2026-01-15')
    }
}).populate('league');

if (matches.length === 0) {
    console.log('\n❌ No Liverpool vs Leeds match found in DB between Dec 15, 2025 - Jan 15, 2026');

    // Check if Leeds has any matches in that period
    const leedsMatches = await FootballEvent.find({
        $or: [{ homeTeam: leeds._id }, { awayTeam: leeds._id }],
        date: { $gte: new Date('2025-12-01'), $lte: new Date('2026-02-01') }
    }).populate('league').limit(5);

    console.log('\n📋 Leeds matches in Dec 2025 - Jan 2026:');
    leedsMatches.forEach(m => {
        console.log(`- ${m.slug}`);
        console.log(`  Date: ${m.date.toISOString().split('T')[0]}`);
        console.log(`  Round: ${m.round}`);
        console.log(`  League: ${m.league?.name || 'N/A'}`);
    });
} else {
    console.log('\n✅ Found Liverpool vs Leeds match:');
    matches.forEach(m => {
        console.log(`- ${m.slug}`);
        console.log(`  Date: ${m.date}`);
        console.log(`  Round: ${m.round}`);
        console.log(`  League: ${m.league?.name || 'N/A'}`);
    });
}

await mongoose.disconnect();
