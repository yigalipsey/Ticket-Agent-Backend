import mongoose from "mongoose";

/**
 * Validates if a given value is a valid MongoDB ObjectId
 * @param {string|ObjectId} id - The ID to validate
 * @returns {boolean} - True if valid ObjectId, false otherwise
 */
export const isValidObjectId = (id) => {
    if (!id) {
        return false;
    }
    return mongoose.Types.ObjectId.isValid(id);
};
