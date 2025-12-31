/**
 * SSE (Server-Sent Events) Helper Functions
 * 
 * Utilities for working with Server-Sent Events in Express routes
 */

/**
 * Setup SSE headers for a response
 * @param {Response} res - Express response object
 */
export const setupSSEHeaders = (res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for nginx
    res.flushHeaders();
};

/**
 * Send an SSE event to the client
 * @param {Response} res - Express response object
 * @param {string} eventName - Name of the event
 * @param {Object} data - Data to send (will be JSON stringified)
 */
export const sendSSEEvent = (res, eventName, data) => {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
};

/**
 * Send a comment (heartbeat) to keep connection alive
 * @param {Response} res - Express response object
 * @param {string} message - Optional comment message
 */
export const sendSSEComment = (res, message = 'heartbeat') => {
    res.write(`: ${message}\n\n`);
};

/**
 * Close SSE connection gracefully
 * @param {Response} res - Express response object
 */
export const closeSSEConnection = (res) => {
    res.end();
};
