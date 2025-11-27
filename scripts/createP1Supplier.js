import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Supplier from '../src/models/Supplier.js';

dotenv.config();

/**
 * Create P1 Travel supplier in the database
 */
async function createP1Supplier() {
    try {
        console.log('🔄 Creating P1 Travel supplier...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Check if P1 already exists
        const existingSupplier = await Supplier.findOne({ slug: 'p1-travel' });

        if (existingSupplier) {
            console.log('⚠️  P1 Travel supplier already exists!');
            console.log('📋 Existing supplier details:');
            console.log(JSON.stringify(existingSupplier.toPublicObject(), null, 2));

            await mongoose.disconnect();
            return;
        }

        // Create P1 supplier
        const p1Supplier = new Supplier({
            name: 'P1 Travel',
            slug: 'p1-travel',
            type: 'tickets',
            description: 'Official partner for football clubs worldwide. Premium tickets and hospitality packages for major football events.',
            logoUrl: 'https://media.p1travel.com/logo.png',
            websiteUrl: 'https://www.p1travel.com',
            affiliateLinkBase: 'https://www.p1travel.com/en/football',
            countries: ['UK', 'ES', 'IT', 'DE', 'FR', 'NL'],
            leagues: [
                'Premier League',
                'La Liga',
                'Serie A',
                'Bundesliga',
                'Ligue 1',
                'Champions League',
                'Europa League'
            ],
            externalIds: {
                internalCode: 'P1',
            },
            contactInfo: {
                email: 'info@p1travel.com',
                supportUrl: 'https://www.p1travel.com/en/contact',
            },
            syncConfig: {
                enabled: true,
                method: 'csv',
                schedule: '0 */6 * * *', // Every 6 hours
            },
            isActive: true,
            priority: 90, // High priority supplier
            metadata: new Map([
                ['partnership_level', 'official'],
                ['commission_rate', '10'],
                ['payment_terms', 'net30'],
            ]),
        });

        await p1Supplier.save();

        console.log('✅ P1 Travel supplier created successfully!\n');
        console.log('📋 Supplier details:');
        console.log(JSON.stringify(p1Supplier.toPublicObject(), null, 2));
        console.log('\n🆔 Supplier ID:', p1Supplier._id.toString());

        // Disconnect from MongoDB
        await mongoose.disconnect();
        console.log('\n👋 Disconnected from MongoDB');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    }
}

// Run the script
createP1Supplier();
