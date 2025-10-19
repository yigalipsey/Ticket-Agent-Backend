import mongoose from "mongoose";
import dotenv from "dotenv";
import Agent from "../src/models/Agent.js";
import Review from "../src/models/Review.js";

// Load environment variables
dotenv.config();

// Sample review data
const sampleReviews = [
  {
    rating: 5,
    comment:
      "שירות מעולה ומקצועי! הסוכן היה זמין ועזר לי למצוא כרטיסים למשחק שחיפשתי.",
    reviewerName: "דוד כהן",
    reviewerEmail: "david.cohen@example.com",
    isVerified: true,
  },
  {
    rating: 4,
    comment: "שירות טוב, הסוכן היה מקצועי וענה על השאלות שלי. המחיר היה הוגן.",
    reviewerName: "שרה לוי",
    reviewerEmail: "sarah.levi@example.com",
    isVerified: true,
  },
  {
    rating: 5,
    comment: "הסוכן עזר לי למצוא כרטיסים למשחק הליברפול. תהליך פשוט ומהיר!",
    reviewerName: "מיכל אברהם",
    reviewerEmail: "michal.avraham@example.com",
    isVerified: true,
  },
  {
    rating: 4,
    comment: "שירות מקצועי, הסוכן היה סבלני ועזר לי להבין את האפשרויות השונות.",
    reviewerName: "יוסי גולדברג",
    reviewerEmail: "yossi.goldberg@example.com",
    isVerified: false,
  },
  {
    rating: 5,
    comment: "מעולה! הסוכן מצא לי כרטיסים למשחק שאני רציתי במחיר מצוין.",
    reviewerName: "רחל כהן",
    reviewerEmail: "rachel.cohen@example.com",
    isVerified: true,
  },
  {
    rating: 4,
    comment: "שירות טוב, הסוכן היה זמין וענה על כל השאלות שלי בזמן.",
    reviewerName: "אליעזר רוזן",
    reviewerEmail: "eliezer.rosen@example.com",
    isVerified: true,
  },
  {
    rating: 5,
    comment: "הסוכן עזר לי למצוא כרטיסים למשחק ריאל מדריד. תהליך חלק ומהיר!",
    reviewerName: "נטע ברק",
    reviewerEmail: "neta.barak@example.com",
    isVerified: true,
  },
  {
    rating: 4,
    comment: "שירות מקצועי ומעולה. הסוכן היה זמין ועזר לי להבין את האפשרויות.",
    reviewerName: "דני שמיר",
    reviewerEmail: "danny.shamir@example.com",
    isVerified: false,
  },
  {
    rating: 5,
    comment: "מעולה! הסוכן מצא לי כרטיסים למשחק שאני רציתי במחיר הוגן.",
    reviewerName: "מורן כהן",
    reviewerEmail: "moran.cohen@example.com",
    isVerified: true,
  },
  {
    rating: 4,
    comment: "שירות טוב, הסוכן היה מקצועי וענה על השאלות שלי בצורה ברורה.",
    reviewerName: "אורי לוי",
    reviewerEmail: "uri.levi@example.com",
    isVerified: true,
  },
];

// Function to get random reviews for an agent
function getRandomReviews(agentId, count = 3) {
  const shuffled = [...sampleReviews].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count).map((review) => ({
    ...review,
    agentId: agentId,
    isActive: true,
  }));
}

async function insertReviewsForAgents() {
  try {
    console.log("🚀 Starting to insert reviews for agents...");

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

    let totalReviewsInserted = 0;

    // Insert reviews for each agent
    for (const agent of agents) {
      console.log(`\n👤 Processing agent: ${agent.name} (${agent.email})`);

      // Get random number of reviews (2-5 reviews per agent)
      const numberOfReviews = Math.floor(Math.random() * 4) + 2; // 2-5 reviews
      const reviews = getRandomReviews(agent._id, numberOfReviews);

      // Insert reviews
      const insertedReviews = await Review.insertMany(reviews);
      totalReviewsInserted += insertedReviews.length;

      console.log(
        `  ✅ Inserted ${insertedReviews.length} reviews for ${agent.name}`
      );

      // Log review details
      insertedReviews.forEach((review, index) => {
        console.log(
          `    ${index + 1}. Rating: ${
            review.rating
          }/5 - "${review.comment.substring(0, 50)}..."`
        );
      });
    }

    console.log(
      `\n🎉 Successfully inserted ${totalReviewsInserted} reviews for ${agents.length} agents!`
    );

    // Verify the results
    console.log("\n📊 Verification:");
    for (const agent of agents) {
      const reviewCount = await Review.countDocuments({
        agentId: agent._id,
        isActive: true,
      });
      const avgRating = await Review.aggregate([
        { $match: { agentId: agent._id, isActive: true } },
        { $group: { _id: null, averageRating: { $avg: "$rating" } } },
      ]);

      const rating = avgRating[0]
        ? Math.round(avgRating[0].averageRating * 10) / 10
        : 0;
      console.log(
        `  ${agent.name}: ${reviewCount} reviews, Average rating: ${rating}/5`
      );
    }
  } catch (error) {
    console.error("❌ Error inserting reviews:", error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log("🔌 Database connection closed");
  }
}

// Run the script
insertReviewsForAgents()
  .then(() => {
    console.log("✅ Script completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
