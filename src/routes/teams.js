import express from "express";
import { logRequest, logError } from "../utils/logger.js";
import {
  authenticateToken,
  requireRole,
  rateLimit,
} from "../middleware/userAuth.js";

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

// POST /api/teams - Create new team
router.post(
  "/",
  authenticateToken,
  requireRole("agent"),
  rateLimit(10),
  async (req, res) => {
    try {
      const teamData = req.body;

      // Basic validation
      if (!teamData.name || !teamData.code || !teamData.country) {
        return res.status(400).json({
          success: false,
          error: "Name, code, and country are required",
        });
      }

      // TODO: Implement createTeam
      const team = { ...teamData, _id: "new-team-id" };

      res.status(201).json({
        success: true,
        data: team,
      });
    } catch (error) {
      logError(error, { route: "POST /api/teams", body: req.body });
      res.status(500).json({
        success: false,
        error: "Failed to create team",
        message: error.message,
      });
    }
  }
);

export default router;
