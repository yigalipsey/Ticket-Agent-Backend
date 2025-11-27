require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_KEY = 'pub-6a76dc10-12e5-466e-83d5-35b745c485a2';
const API_URL = 'https://api-live.hellotickets.com/v1';

async function fetchPerformerPerformances(performerId, options = {}) {
    try {
        const {
            categoryId = 1, // Sports by default
            fromDate = null,
            toDate = null,
            isSellable = true
        } = options;

        console.log(`🔍 Fetching performances for performer ${performerId}...`);

        // Fetch all pages
        let allPerformances = [];
        let page = 1;
        let totalPages = 1;

        do {
            const params = {
                performer_id: performerId,
                category_id: categoryId,
                page: page,
                limit: 100,
                is_sellable: isSellable
            };

            // Add date filters if provided
            if (fromDate) params.from = fromDate;
            if (toDate) params.to = toDate;

            const { data } = await axios.get(`${API_URL}/performances`, {
                params,
                headers: {
                    Accept: 'application/json',
                    'X-Public-Key': API_KEY,
                },
            });

            if (page === 1) {
                console.log(`✅ Found ${data.total_count} total performances.`);
                totalPages = Math.ceil(data.total_count / data.per_page);
            }

            allPerformances = allPerformances.concat(data.performances || []);
            console.log(`📄 Fetched page ${page}/${totalPages} (${allPerformances.length} performances so far)`);
            page++;

        } while (page <= totalPages);

        const outputPath = path.resolve(__dirname, `../data/performer_${performerId}_performances.json`);

        // Ensure data directory exists
        const dataDir = path.dirname(outputPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        const result = {
            performer_id: performerId,
            total_count: allPerformances.length,
            fetched_at: new Date().toISOString(),
            filters: {
                category_id: categoryId,
                from_date: fromDate,
                to_date: toDate,
                is_sellable: isSellable
            },
            performances: allPerformances
        };

        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
        console.log(`\n💾 All ${allPerformances.length} performances saved to ${outputPath}`);

        // Print a summary of the performances
        if (allPerformances.length > 0) {
            console.log('\n📋 Performance Summary (first 15):');
            allPerformances.slice(0, 15).forEach((perf, idx) => {
                const date = perf.start_date?.local_date || 'TBD';
                const time = perf.start_date?.local_time || '';
                const venue = perf.venue?.name || 'Unknown venue';
                const minPrice = perf.price_range?.min_price
                    ? `${perf.price_range.currency} ${perf.price_range.min_price}`
                    : 'N/A';
                const performers = perf.performers?.map(p => p.name).join(' vs ') || '';

                console.log(`\n${idx + 1}. [ID: ${perf.id}] ${perf.name}`);
                console.log(`   📅 ${date} ${time} | 📍 ${venue}`);
                console.log(`   💰 From ${minPrice} | 🎫 ${perf.ticket_groups_count} ticket groups`);
                console.log(`   👥 ${performers}`);
            });

            if (allPerformances.length > 15) {
                console.log(`\n... and ${allPerformances.length - 15} more performances`);
            }
        }

        return result;

    } catch (error) {
        console.error('❌ Error fetching performances:', error.response ? error.response.data : error.message);
        throw error;
    }
}

// Parse command line arguments
const performerId = process.argv[2] || 1835;
const fromDate = process.argv[3] || null; // Format: 2025-12-01T00:00:00Z
const toDate = process.argv[4] || null;   // Format: 2025-12-31T23:59:59Z

fetchPerformerPerformances(performerId, {
    fromDate,
    toDate
}).catch(err => {
    console.error('Script failed:', err.message);
    process.exit(1);
});
