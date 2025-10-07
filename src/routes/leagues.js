import express from "express";
import { getAllLeagues } from "../services/league/queries/getAllLeagues.js";
import { logRequest, logError } from "../utils/logger.js";
import { rateLimit } from "../middleware/auth.js";

const router = express.Router();

// Middleware for request logging
router.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const responseTime = Date.now() - start;
    logRequest(req, res, responseTime);
  });

  next();
});

// GET /api/leagues - Get all leagues with optional teams
router.get("/", rateLimit(100), async (req, res) => {
  try {
    const { withTeams = false } = req.query;

    const shouldIncludeTeams = withTeams === "true" || withTeams === true;

    // שימוש בסרוויס לשליפת ליגות
    const result = await getAllLeagues(shouldIncludeTeams);

    res.json({
      success: true,
      data: result.leagues,
      count: result.count,
      withTeams: result.withTeams,
      fromCache: result.fromCache,
    });
  } catch (error) {
    logError(error, {
      route: "GET /api/leagues",
      query: req.query,
    });
    res.status(500).json({
      success: false,
      error: "Failed to fetch leagues",
      message: error.message,
    });
  }
});

export default router;
