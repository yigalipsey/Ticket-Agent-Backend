const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// Path to the CSV file generated in the previous step
const CSV_PATH = path.resolve(__dirname, '../data/performers_sports.csv');

// List of teams to verify (ID and expected Name)
const TEAMS_TO_VERIFY = [
    { id: 444, name: 'Manchester City FC' },
    { id: 756, name: 'Tottenham Hotspur FC' },
    { id: 422, name: 'Liverpool FC' },
    { id: 1836, name: 'Chelsea FC' },
    { id: 445, name: 'Manchester United FC' },
    { id: 1835, name: 'Arsenal FC' },
    { id: 295, name: 'Fulham FC' },
    { id: 208, name: 'Crystal Palace FC' },
    { id: 81, name: 'Aston Villa FC' },
    { id: 520, name: 'Newcastle United FC' },
    { id: 268, name: 'Everton FC' },
    { id: 802, name: 'West Ham United FC' },
    { id: 129, name: 'Brentford FC' },
    { id: 53, name: 'AFC Bournemouth' },
    { id: 130, name: 'Brighton Hove Albion FC' },
    { id: 528, name: 'Nottingham Forest FC' },
    { id: 17020, name: 'Burnley FC' },
    { id: 28696, name: 'Sunderland AFC' },
    { id: 20682, name: 'Leeds United FC' },
    { id: 813, name: 'Wolverhampton Wanderers FC' },
    { id: 657, name: 'Southampton FC' },
    { id: 16149, name: 'West Bromwich Albion FC' },
    { id: 407, name: 'Leicester City FC' },
    { id: 25234, name: 'Watford FC' },
    { id: 22803, name: 'Sheffield United FC' },
    { id: 21382, name: 'Sheffield Wednesday FC' },
    { id: 29392, name: 'Coventry City' },
    { id: 29393, name: 'Preston North' },
    { id: 17572, name: 'Millwall FC' }
];

function verifyTeams() {
    if (!fs.existsSync(CSV_PATH)) {
        console.error(`Error: CSV file not found at ${CSV_PATH}`);
        process.exit(1);
    }

    const fileContent = fs.readFileSync(CSV_PATH, 'utf8');
    const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true
    });

    // Create a map for quick lookup by ID
    const performersMap = new Map();
    records.forEach(record => {
        performersMap.set(parseInt(record.id, 10), record.name);
    });

    console.log('--- Verification Results ---');
    let allMatch = true;

    TEAMS_TO_VERIFY.forEach(team => {
        const actualName = performersMap.get(team.id);

        if (!actualName) {
            console.error(`[MISSING] ID ${team.id} (${team.name}) not found in CSV.`);
            allMatch = false;
        } else if (actualName !== team.name) {
            console.warn(`[MISMATCH] ID ${team.id}: Expected "${team.name}", Found "${actualName}"`);
            // We don't set allMatch = false here because slight name variations might be acceptable, 
            // but we want to highlight them. If exact match is required, uncomment the next line.
            allMatch = false;
        } else {
            console.log(`[OK] ID ${team.id}: ${team.name}`);
        }
    });

    if (allMatch) {
        console.log('\nAll teams verified successfully!');
    } else {
        console.log('\nVerification completed with some issues (see above).');
    }
}

verifyTeams();
