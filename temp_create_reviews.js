import dotenv from "dotenv";
import databaseConnection from "./src/config/database.js";
import Review from "./src/models/Review.js";
import { logWithCheckpoint, logError } from "./src/utils/logger.js";

dotenv.config();

const AGENT_ID = "69022c05e0683d43a2380d6a";

// 3 reviews with 5 stars
const reviews = [
  {
    agentId: AGENT_ID,
    rating: 5,
    comment:
      "Excellent service! The agent was very professional and helped me get tickets for the Champions League match. Highly recommended!",
    reviewerName: "John Smith",
    reviewerEmail: "john.smith@example.com",
    isVerified: true,
    isActive: true,
  },
  {
    agentId: AGENT_ID,
    rating: 5,
    comment:
      "Amazing experience! Fast response time and great customer service. I got my tickets quickly and everything went smoothly.",
    reviewerName: "Emma Johnson",
    reviewerEmail: "emma.johnson@example.com",
    isVerified: true,
    isActive: true,
  },
  {
    agentId: AGENT_ID,
    rating: 5,
    comment:
      "Best ticket agent I've ever used! Great prices, reliable service, and they really care about their customers. Will definitely use again!",
    reviewerName: "Michael Brown",
    reviewerEmail: "michael.brown@example.com",
    isVerified: true,
    isActive: true,
  },
];

async function createReviews() {
  try {
    logWithCheckpoint(
      "info",
      "Starting to create reviews for agent",
      "CREATE_REVIEWS_001",
      {
        agentId: AGENT_ID,
        numberOfReviews: reviews.length,
      }
    );

    // Connect to database
    await databaseConnection.connect(process.env.MONGODB_URI);

    logWithCheckpoint(
      "info",
      "Database connected successfully",
      "CREATE_REVIEWS_002"
    );

    // Create reviews
    const createdReviews = [];
    for (let i = 0; i < reviews.length; i++) {
      const reviewData = reviews[i];

      logWithCheckpoint(
        "info",
        `Creating review ${i + 1} of ${reviews.length}`,
        `CREATE_REVIEWS_003.${i + 1}`,
        {
          reviewerName: reviewData.reviewerName,
          rating: reviewData.rating,
        }
      );

      const review = new Review(reviewData);
      const savedReview = await review.save();

      createdReviews.push(savedReview);

      logWithCheckpoint(
        "info",
        `Review ${i + 1} created successfully`,
        `CREATE_REVIEWS_004.${i + 1}`,
        {
          reviewId: savedReview._id.toString(),
        }
      );
    }

    console.log("\n✅ All reviews created successfully!");
    console.log(`   Agent ID: ${AGENT_ID}`);
    console.log(`   Number of reviews created: ${createdReviews.length}`);
    console.log("\n📋 Review details:");
    createdReviews.forEach((review, index) => {
      console.log(`\n   Review ${index + 1}:`);
      console.log(`   - ID: ${review._id}`);
      console.log(`   - Rating: ${review.rating} stars`);
      console.log(`   - Reviewer: ${review.reviewerName}`);
      console.log(`   - Email: ${review.reviewerEmail}`);
      console.log(`   - Comment: ${review.comment}`);
      console.log(`   - Verified: ${review.isVerified ? "Yes" : "No"}`);
    });

    // Close database connection
    await databaseConnection.disconnect();

    logWithCheckpoint(
      "info",
      "Script completed successfully",
      "CREATE_REVIEWS_005"
    );

    process.exit(0);
  } catch (error) {
    logError(error, { operation: "createReviews" });
    console.error("\n❌ Error creating reviews:", error.message);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    await databaseConnection.disconnect();
    process.exit(1);
  }
}

// Run the script
createReviews();
