import 'dotenv/config';
import mongoose from 'mongoose';
import axios from 'axios';
import Team from '../src/models/Team.js';
import FootballEvent from '../src/models/FootballEvent.js';
import League from '../src/models/League.js';
import Supplier from '../src/models/Supplier.js';

// API Configuration
const API_KEY = 'pub-6a76dc10-12e5-466e-83d5-35b745c485a2';
const API_URL = 'https://api-live.hellotickets.com/v1';

// Real Madrid HelloTickets ID
const REAL_MADRID_HT_ID = '598';

async function connectDB() {
    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is not defined in .env');
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
}

async function fetchPerformerPerformances(performerId, limit = 100) {
    try {
        const { data } = await axios.get(`${API_URL}/performances`, {
            params: {
                performer_id: performerId,
                category_id: 1, // Sports
                limit: limit,
                page: 1,
                is_sellable: true
            },
            headers: {
                Accept: 'application/json',
                'X-Public-Key': API_KEY,
            },
        });
        return data.performances || [];
    } catch (error) {
        console.error(`❌ Error fetching events for performer ${performerId}:`, error.message);
        return [];
    }
}

async function findTeamByHelloTicketsId(htId, supplier) {
    const team = await Team.findOne({
        'suppliersInfo.supplierRef': supplier._id,
        'suppliersInfo.supplierExternalId': htId
    });
    return team;
}

async function findMatchingEvent(homeTeamId, awayTeamId, eventDate) {
    // Search within 24 hours window
    const dateStart = new Date(eventDate);
    dateStart.setHours(dateStart.getHours() - 24);
    const dateEnd = new Date(eventDate);
    dateEnd.setHours(dateEnd.getHours() + 24);

    const event = await FootballEvent.findOne({
        $or: [
            { homeTeam: homeTeamId, awayTeam: awayTeamId },
            { homeTeam: awayTeamId, awayTeam: homeTeamId }
        ],
        date: { $gte: dateStart, $lte: dateEnd }
    }).populate('homeTeam awayTeam league venue');

    return event;
}

async function run() {
    try {
        await connectDB();

        // Get HelloTickets supplier
        const supplier = await Supplier.findOne({ slug: 'hellotickets' });
        if (!supplier) {
            console.error('❌ HelloTickets supplier not found in database!');
            process.exit(1);
        }

        // Get Real Madrid from our database
        const realMadrid = await findTeamByHelloTicketsId(REAL_MADRID_HT_ID, supplier);
        if (!realMadrid) {
            console.error('❌ Real Madrid not found in database!');
            process.exit(1);
        }

        console.log(`\n🏆 Real Madrid found in DB:`);
        console.log(`   Name: ${realMadrid.name} (${realMadrid.name_en})`);
        console.log(`   Slug: ${realMadrid.slug}`);
        console.log(`   DB ID: ${realMadrid._id}`);
        console.log(`   HelloTickets ID: ${REAL_MADRID_HT_ID}\n`);

        // Fetch all Real Madrid matches from HelloTickets
        console.log('🔍 Fetching Real Madrid matches from HelloTickets API...\n');
        const performances = await fetchPerformerPerformances(REAL_MADRID_HT_ID);

        console.log(`📊 Found ${performances.length} matches on HelloTickets\n`);
        console.log('='.repeat(120));

        const mappingResults = [];

        for (const perf of performances) {
            const eventDate = new Date(perf.start_date.date_time);

            // Find opponent in performers list
            const opponentPerf = perf.performers.find(p =>
                p.id.toString() !== REAL_MADRID_HT_ID &&
                !p.name.includes('UEFA') &&
                !p.name.includes('Champions League') &&
                !p.name.includes('La Liga')
            );

            if (!opponentPerf) {
                console.log(`⚠️  Skipping: ${perf.name} - No opponent found`);
                continue;
            }

            // Try to find opponent in our database
            const opponentTeam = await findTeamByHelloTicketsId(opponentPerf.id.toString(), supplier);

            let mappingStatus = '';
            let dbEvent = null;
            let wouldMap = {
                htPerformanceId: perf.id,
                htPerformanceName: perf.name,
                htDate: eventDate.toISOString(),
                htOpponent: {
                    id: opponentPerf.id,
                    name: opponentPerf.name
                },
                dbHomeTeam: null,
                dbAwayTeam: null,
                dbEvent: null,
                status: ''
            };

            if (opponentTeam) {
                // We know this opponent, try to find the event
                dbEvent = await findMatchingEvent(realMadrid._id, opponentTeam._id, eventDate);

                if (dbEvent) {
                    mappingStatus = '✅ FULL MATCH';
                    wouldMap.status = 'READY_TO_MAP';
                    wouldMap.dbHomeTeam = {
                        id: dbEvent.homeTeam._id,
                        name: dbEvent.homeTeam.name,
                        name_en: dbEvent.homeTeam.name_en
                    };
                    wouldMap.dbAwayTeam = {
                        id: dbEvent.awayTeam._id,
                        name: dbEvent.awayTeam.name,
                        name_en: dbEvent.awayTeam.name_en
                    };
                    wouldMap.dbEvent = {
                        id: dbEvent._id,
                        slug: dbEvent.slug,
                        date: dbEvent.date,
                        league: dbEvent.league.name,
                        venue: dbEvent.venue.name
                    };
                } else {
                    mappingStatus = '⚠️  OPPONENT FOUND, EVENT MISSING';
                    wouldMap.status = 'OPPONENT_FOUND_EVENT_MISSING';
                    wouldMap.dbOpponent = {
                        id: opponentTeam._id,
                        name: opponentTeam.name,
                        name_en: opponentTeam.name_en
                    };
                }
            } else {
                mappingStatus = '❌ OPPONENT NOT IN DB';
                wouldMap.status = 'OPPONENT_NOT_MAPPED';
            }

            mappingResults.push(wouldMap);

            // Print detailed mapping info
            console.log(`\n📅 ${eventDate.toLocaleDateString('he-IL')} - ${eventDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`);
            console.log(`   HelloTickets Performance ID: ${perf.id}`);
            console.log(`   Match: ${perf.name}`);
            console.log(`   Opponent (HT): ${opponentPerf.name} (ID: ${opponentPerf.id})`);
            console.log(`   Status: ${mappingStatus}`);

            if (wouldMap.status === 'READY_TO_MAP') {
                console.log(`   ✅ Would map to DB Event:`);
                console.log(`      Event ID: ${wouldMap.dbEvent.id}`);
                console.log(`      Slug: ${wouldMap.dbEvent.slug}`);
                console.log(`      Home: ${wouldMap.dbHomeTeam.name_en}`);
                console.log(`      Away: ${wouldMap.dbAwayTeam.name_en}`);
                console.log(`      League: ${wouldMap.dbEvent.league}`);
                console.log(`      Venue: ${wouldMap.dbEvent.venue}`);
            } else if (wouldMap.status === 'OPPONENT_FOUND_EVENT_MISSING') {
                console.log(`   ⚠️  Opponent found in DB: ${wouldMap.dbOpponent.name_en}`);
                console.log(`      But no matching event found in our database`);
                console.log(`      → Need to create this event in DB first`);
            } else {
                console.log(`   ❌ Opponent not mapped in our database`);
                console.log(`      → Need to add mapping for: ${opponentPerf.name} (HT ID: ${opponentPerf.id})`);
            }
            console.log('-'.repeat(120));
        }

        // Summary
        console.log('\n' + '='.repeat(120));
        console.log('📊 MAPPING SUMMARY');
        console.log('='.repeat(120));

        const readyToMap = mappingResults.filter(m => m.status === 'READY_TO_MAP').length;
        const opponentFoundEventMissing = mappingResults.filter(m => m.status === 'OPPONENT_FOUND_EVENT_MISSING').length;
        const opponentNotMapped = mappingResults.filter(m => m.status === 'OPPONENT_NOT_MAPPED').length;

        console.log(`\nTotal matches found: ${mappingResults.length}`);
        console.log(`✅ Ready to map: ${readyToMap} (${((readyToMap / mappingResults.length) * 100).toFixed(1)}%)`);
        console.log(`⚠️  Opponent found, event missing: ${opponentFoundEventMissing}`);
        console.log(`❌ Opponent not mapped: ${opponentNotMapped}`);

        // Show unmapped opponents
        const unmappedOpponents = mappingResults
            .filter(m => m.status === 'OPPONENT_NOT_MAPPED')
            .map(m => ({ id: m.htOpponent.id, name: m.htOpponent.name }))
            .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i); // unique

        if (unmappedOpponents.length > 0) {
            console.log('\n❌ Unmapped opponents (need to add to database):');
            unmappedOpponents.forEach(opp => {
                console.log(`   - ${opp.name} (HelloTickets ID: ${opp.id})`);
            });
        }

        // Show events that need to be created
        const eventsToCreate = mappingResults
            .filter(m => m.status === 'OPPONENT_FOUND_EVENT_MISSING');

        if (eventsToCreate.length > 0) {
            console.log('\n⚠️  Events that need to be created in database:');
            eventsToCreate.forEach(evt => {
                console.log(`   - ${evt.htPerformanceName} (${new Date(evt.htDate).toLocaleDateString('he-IL')})`);
            });
        }

        console.log('\n' + '='.repeat(120));

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    }
}

run();
