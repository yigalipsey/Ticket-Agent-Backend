import pino from "pino";

const isDevelopment = process.env.NODE_ENV === "development";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
      singleLine: true,
      messageFormat: "{msg}",
    },
  },
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
});

// Helper function for structured logging with checkpoint numbers
export const logWithCheckpoint = (level, message, checkpoint, data = {}) => {
  if (Object.keys(data).length > 0) {
    logger[level](
      { checkpoint, message, ...data },
      `[${checkpoint}] ${message}`
    );
  } else {
    logger[level](`[${checkpoint}] ${message}`);
  }
};

// Helper function for API request logging
export const logRequest = (req, res, responseTime) => {
  logger.info(
    `${req.method} ${req.url} - ${res.statusCode} (${responseTime}ms)`
  );
};

// Helper function for error logging
export const logError = (error, context = {}) => {
  logger.error(`ERROR: ${error.message}`);
};

export default logger;
