import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import databaseConnection from "./config/database.js";

// Import routes
import eventsRoutes from "./routes/events.js";
import footballEventsRoutes from "./routes/footballEvents.js";
import teamsRoutes from "./routes/teams.js";
import venuesRoutes from "./routes/venues.js";
import leaguesRoutes from "./routes/leagues.js";
import agentsRoutes from "./routes/agents.js";
import usersRoutes from "./routes/users.js";
import authRoutes from "./routes/auth.js";
import offersRoutes from "./routes/offers.js";

// Import utilities
import logger, {
  logWithCheckpoint,
  logError,
  logRequest,
} from "./utils/logger.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const responseTime = Date.now() - start;
    logRequest(req, res, responseTime);
  });

  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  const dbStatus = databaseConnection.getConnectionStatus();

  res.json({
    success: true,
    message: "Ticket Agent API is running",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
    database: {
      status: dbStatus.isConnected ? "connected" : "disconnected",
      readyState: dbStatus.readyState,
      host: dbStatus.host,
      name: dbStatus.name,
    },
  });
});

// Database connection middleware (skip for health endpoint)
app.use((req, res, next) => {
  if (req.path === "/health") {
    return next();
  }

  if (!databaseConnection.isDatabaseConnected()) {
    return res.status(503).json({
      success: false,
      error: "Database unavailable",
      message: "Database connection is not available. Please try again later.",
    });
  }
  next();
});

// API routes
app.use("/api/events", eventsRoutes);
app.use("/api/football-events", footballEventsRoutes);
app.use("/api/fixtures", footballEventsRoutes); // Alias for football-events
app.use("/api/teams", teamsRoutes);
app.use("/api/venues", venuesRoutes);
app.use("/api/leagues", leaguesRoutes);
app.use("/api/agents", agentsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/offers", offersRoutes);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Global error handler
app.use((error, req, res, next) => {
  logError(error, {
    method: req.method,
    url: req.url,
    body: req.body,
  });

  res.status(error.status || 500).json({
    success: false,
    error: "Internal server error",
    message:
      process.env.NODE_ENV === "development"
        ? error.message
        : "Something went wrong",
  });
});

// Connect to MongoDB
async function connectToDatabase() {
  try {
    const result = await databaseConnection.connect(process.env.MONGODB_URI);
    console.log("Database connection result:", result);
    return result;
  } catch (error) {
    console.error("Database connection failed:", error);
    return false;
  }
}

// Start server
async function startServer() {
  try {
    // Connect to database first
    await connectToDatabase();

    // Redis removed - working directly with database

    // Start HTTP server
    app.listen(PORT, () => {
      logWithCheckpoint("info", "Server started successfully", "SERVER_003", {
        port: PORT,
        environment: process.env.NODE_ENV || "development",
      });

      console.log(`🚀 Ticket Agent API is running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logError(error, { operation: "startServer" });
    process.exit(1);
  }
}

// Handle process termination
process.on("SIGINT", async () => {
  logWithCheckpoint(
    "info",
    "Received SIGINT, shutting down gracefully",
    "SERVER_004"
  );

  try {
    await databaseConnection.disconnect();
    process.exit(0);
  } catch (error) {
    logError(error, { operation: "gracefulShutdown" });
    process.exit(1);
  }
});

process.on("SIGTERM", async () => {
  logWithCheckpoint(
    "info",
    "Received SIGTERM, shutting down gracefully",
    "SERVER_006"
  );

  try {
    await databaseConnection.disconnect();
    process.exit(0);
  } catch (error) {
    logError(error, { operation: "gracefulShutdown" });
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logError(error, { operation: "uncaughtException" });
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logError(new Error(`Unhandled Rejection at: ${promise}, reason: ${reason}`), {
    operation: "unhandledRejection",
  });
  process.exit(1);
});

// Start the server
startServer();
