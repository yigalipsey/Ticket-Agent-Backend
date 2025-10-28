const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });

const Team = require('./src/models/Team').default;

async function findBurnley() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const burnley = await Team.findOne({ 
      $or: [
        { name: /burnley/i },
        { name_en: /burnley/i },
        { slug: /burnley/i }
      ]
    });
    
    if (burnley) {
      console.log('\n=== BURNLEY TEAM FOUND ===');
      console.log('Name:', burnley.name);
      console.log('Name EN:', burnley.name_en);
      console.log('Slug:', burnley.slug);
      console.log('Logo URL:', burnley.logoUrl);
      console.log('Code:', burnley.code);
      console.log('Team ID:', burnley.teamId);
    } else {
      console.log('Burnley not found in database');
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

findBurnley();
