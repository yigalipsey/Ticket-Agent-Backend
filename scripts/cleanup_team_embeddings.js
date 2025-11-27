import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Team from '../src/models/Team.js';

// Setup dotenv
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function cleanupTeamEmbeddings() {
    try {
        // Connect to MongoDB
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected successfully.');

        // Update all teams to unset the embedding fields
        console.log('Removing embedding_he and embedding_he_createdAt from all teams...');

        const result = await Team.updateMany(
            {}, // Match all documents
            {
                $unset: {
                    embedding_he: "",
                    embedding_he_createdAt: ""
                }
            }
        );

        console.log(`Operation complete.`);
        console.log(`Matched documents: ${result.matchedCount}`);
        console.log(`Modified documents: ${result.modifiedCount}`);

    } catch (error) {
        console.error('Error during cleanup:', error);
    } finally {
        // Close connection
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB.');
        process.exit(0);
    }
}

cleanupTeamEmbeddings();
