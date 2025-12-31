import pino from "pino";

const isDevelopment = process.env.NODE_ENV === "development";

// ANSI colors for semantic logging
const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
  gray: "\x1b[90m"
};

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
});

// Helper function for structured logging with checkpoint numbers
export const logWithCheckpoint = (level, message, checkpoint, data = {}) => {
  // Colorize checkpoint based on its type
  let checkpointColor = colors.yellow;
  if (checkpoint.includes('ERROR')) checkpointColor = colors.red;
  if (checkpoint.includes('STREAM')) checkpointColor = colors.magenta;
  if (checkpoint.includes('API')) checkpointColor = colors.cyan;
  if (checkpoint.includes('CACHE')) checkpointColor = colors.green;

  const coloredCheckpoint = `${checkpointColor}[${checkpoint}]${colors.reset}`;

  if (Object.keys(data).length > 0) {
    logger[level](
      { checkpoint, ...data },
      `${coloredCheckpoint} ${message}`
    );
  } else {
    logger[level](`${coloredCheckpoint} ${message}`);
  }
};

// Helper function for API request logging
export const logRequest = (req, res, responseTime, source = "") => {
  const sourceTag = source ? `${colors.cyan}[${source}]${colors.reset} ` : "";
  const statusColor = res.statusCode >= 400 ? colors.red : colors.green;

  logger.info(
    `${sourceTag}${colors.gray}${req.method}${colors.reset} ${req.url} - ${statusColor}${res.statusCode}${colors.reset} ${colors.gray}(${responseTime}ms)${colors.reset}`
  );
};

// Helper function for error logging
export const logError = (error, context = {}) => {
  logger.error(`${colors.red}❌ ERROR:${colors.reset} ${error.message}`);
};

export default logger;
