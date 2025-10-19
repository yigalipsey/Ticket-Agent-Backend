import mongoose from "mongoose";
import dotenv from "dotenv";
import Agent from "../src/models/Agent.js";

// Load environment variables
dotenv.config();

// Sample agent images - you can add more URLs here
const agentImages = [
  "https://res.cloudinary.com/djgwgeeqr/image/upload/v1760869831/%D7%9B%D7%9C_%D7%AA%D7%95%D7%A8_wufoss.webp",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=face",
];

async function updateAgentsWithImages() {
  try {
    console.log("🚀 Starting to update agents with images...");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Get all agents
    const agents = await Agent.find({});
    console.log(`📋 Found ${agents.length} agents`);

    if (agents.length === 0) {
      console.log("❌ No agents found. Please create agents first.");
      return;
    }

    let updatedCount = 0;

    // Update each agent with an image
    for (const agent of agents) {
      try {
        console.log(`\n👤 Processing agent: ${agent.name} (${agent.email})`);

        // Skip if agent already has an image
        if (agent.imageUrl) {
          console.log(`  ⏭️  Agent ${agent.name} already has an image, skipping...`);
          continue;
        }

        // Choose image based on agent type or use a random one
        let selectedImage;
        
        if (agent.name === "כל תור" || agent.companyName === "כל תור") {
          // Use the specific image for "כל תור"
          selectedImage = agentImages[0];
          console.log(`  🎯 Using specific image for "כל תור"`);
        } else {
          // Use a random image for other agents
          const randomIndex = Math.floor(Math.random() * (agentImages.length - 1)) + 1;
          selectedImage = agentImages[randomIndex];
          console.log(`  🎲 Using random image (index: ${randomIndex})`);
        }

        // Update agent with image URL
        const updatedAgent = await Agent.findByIdAndUpdate(
          agent._id,
          { imageUrl: selectedImage },
          { new: true }
        );

        if (updatedAgent) {
          console.log(`  ✅ Updated ${agent.name} with image: ${selectedImage}`);
          updatedCount++;
        } else {
          console.log(`  ❌ Failed to update ${agent.name}`);
        }

      } catch (agentError) {
        console.error(`  ❌ Error updating agent ${agent._id}:`, agentError);
      }
    }

    console.log(`\n🎉 Successfully updated ${updatedCount} agents with images!`);

    // Verify the results
    console.log("\n📊 Verification:");
    const allAgents = await Agent.find({});
    for (const agent of allAgents) {
      console.log(`  ${agent.name}: ${agent.imageUrl ? '✅ Has image' : '❌ No image'}`);
      if (agent.imageUrl) {
        console.log(`    Image URL: ${agent.imageUrl}`);
      }
    }

  } catch (error) {
    console.error("❌ Error updating agents with images:", error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log("🔌 Database connection closed");
  }
}

// Run the script
updateAgentsWithImages()
  .then(() => {
    console.log("✅ Script completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
