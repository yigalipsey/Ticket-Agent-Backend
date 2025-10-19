import Agent from "../../../models/Agent.js";
import Review from "../../../models/Review.js";

const getAllAgents = async () => {
  try {
    console.log("Starting getAllAgents service...");
    
    // Find all agents
    const agents = await Agent.find({})
      .select("-passwordHash -tokenVersion")
      .populate({
        path: "reviews",
        select: "rating comment reviewerName createdAt isVerified isActive",
        match: { isActive: true },
        options: { sort: { createdAt: -1 }, limit: 5 },
      })
      .sort({ createdAt: -1 });

    console.log(`Found ${agents.length} agents`);

    if (agents.length === 0) {
      return {
        success: true,
        data: [],
        message: "No agents found",
      };
    }

    // Calculate review statistics for each agent
    const agentsWithStats = await Promise.all(
      agents.map(async (agent) => {
        try {
          const agentObj = agent.toObject();

          // Get review statistics
          const reviewStats = await Review.aggregate([
            { $match: { agentId: agent._id, isActive: true } },
            {
              $group: {
                _id: null,
                totalReviews: { $sum: 1 },
                averageRating: { $avg: "$rating" },
                verifiedReviews: {
                  $sum: { $cond: ["$isVerified", 1, 0] },
                },
              },
            },
          ]);

          const stats = reviewStats[0] || {
            totalReviews: 0,
            averageRating: 0,
            verifiedReviews: 0,
          };

          agentObj.reviewStats = {
            totalReviews: stats.totalReviews,
            averageRating: Math.round(stats.averageRating * 10) / 10 || 0,
            verifiedReviews: stats.verifiedReviews,
            recentReviews: agentObj.reviews || [],
          };

          return agentObj;
        } catch (agentError) {
          console.error(`Error processing agent ${agent._id}:`, agentError);
          // Return agent without review stats if there's an error
          return {
            ...agent.toObject(),
            reviewStats: {
              totalReviews: 0,
              averageRating: 0,
              verifiedReviews: 0,
              recentReviews: [],
            },
          };
        }
      })
    );

    console.log(`Successfully processed ${agentsWithStats.length} agents with review stats`);

    return {
      success: true,
      data: agentsWithStats,
      message: `Retrieved ${agentsWithStats.length} agents successfully`,
    };
  } catch (error) {
    console.error("Error in getAllAgents service:", error);
    
    // Provide more specific error messages
    if (error.name === 'MongoServerError') {
      return {
        success: false,
        error: `Database error: ${error.message}`,
        details: "Failed to connect to or query the database",
      };
    }
    
    if (error.name === 'CastError') {
      return {
        success: false,
        error: `Invalid data format: ${error.message}`,
        details: "One or more fields have invalid data types",
      };
    }
    
    if (error.name === 'ValidationError') {
      return {
        success: false,
        error: `Validation error: ${error.message}`,
        details: "Data validation failed",
      };
    }

    return {
      success: false,
      error: `Service error: ${error.message}`,
      details: "An unexpected error occurred while retrieving agents",
    };
  }
};

export default getAllAgents;
