import { isValidObjectId } from "../utils/validation.js";
import { createErrorResponse } from "../utils/errorCodes.js";

/**
 * Middleware factory to validate ObjectId in route params
 * @param {string} paramName - The name of the param to validate (default: "id")
 * @returns {Function} Express middleware function
 */
export const validateObjectIdParam = (paramName = "id") => {
    return (req, res, next) => {
        const value = req.params[paramName];

        if (!value) {
            return res.status(400).json(
                createErrorResponse("VALIDATION_MISSING_FIELDS", {
                    required: [paramName],
                })
            );
        }

        if (!isValidObjectId(value)) {
            return res.status(400).json(
                createErrorResponse("VALIDATION_INVALID_FORMAT", {
                    field: paramName,
                    expected: "MongoDB ObjectId (24 hex characters)",
                })
            );
        }

        next();
    };
};

/**
 * Middleware factory to validate ObjectId in query params
 * @param {string} queryName - The name of the query param to validate
 * @param {boolean} required - Whether the query param is required (default: true)
 * @returns {Function} Express middleware function
 */
export const validateObjectIdQuery = (queryName, required = true) => {
    return (req, res, next) => {
        const value = req.query[queryName];

        if (!value) {
            if (required) {
                return res.status(400).json(
                    createErrorResponse("VALIDATION_MISSING_FIELDS", {
                        required: [queryName],
                    })
                );
            }
            // If not required and not provided, skip validation
            return next();
        }

        if (!isValidObjectId(value)) {
            return res.status(400).json(
                createErrorResponse("VALIDATION_INVALID_FORMAT", {
                    field: queryName,
                    expected: "MongoDB ObjectId (24 hex characters)",
                })
            );
        }

        next();
    };
};
