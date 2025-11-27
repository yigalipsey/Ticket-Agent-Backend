import dotenv from 'dotenv';
import databaseConnection from '../src/config/database.js';
import Supplier from '../src/models/Supplier.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const HELLOTICKETS_DATA = {
    name: 'Hellotickets',
    slug: 'hellotickets',
    type: 'tickets',
    description: 'Global marketplace for tickets to events, museums, and activities.',
    logoUrl: 'https://assets.hellotickets.com/images/logo.svg', // Educated guess, can be updated
    websiteUrl: 'https://www.hellotickets.com',
    affiliateLinkBase: 'https://www.hellotickets.com', // Base for affiliate links
    countries: ['GB', 'ES', 'IT', 'FR', 'DE'], // Major European countries
    leagues: ['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1'],
    syncConfig: {
        enabled: true,
        method: 'api',
        schedule: '0 0 * * *', // Daily at midnight
    },
    isActive: true,
    priority: 80, // High priority
};

async function addSupplier() {
    try {
        // Connect to Database
        const connected = await databaseConnection.connect(process.env.MONGODB_URI);
        if (!connected) {
            console.error('Failed to connect to database');
            process.exit(1);
        }

        console.log('Connected to database. Adding/Updating Hellotickets supplier...');

        const supplier = await Supplier.findOneAndUpdate(
            { slug: HELLOTICKETS_DATA.slug },
            HELLOTICKETS_DATA,
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        console.log('Successfully saved supplier:', supplier.name);
        console.log('ID:', supplier._id);

        await databaseConnection.disconnect();
        console.log('Disconnected from database.');
        process.exit(0);
    } catch (error) {
        console.error('Error adding supplier:', error);
        process.exit(1);
    }
}

addSupplier();
