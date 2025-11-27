import TeamEmbedding from "../../models/TeamEmbedding.js";
import Team from "../../models/Team.js";
import { logWithCheckpoint, logError } from "../../utils/logger.js";

/**
 * Service for semantic team search using embeddings
 * This is an example implementation showing how to use the TeamEmbedding model
 */

/**
 * Calculate cosine similarity between two vectors
 * @param {number[]} vecA - First vector
 * @param {number[]} vecB - Second vector
 * @returns {number} Cosine similarity score (-1 to 1)
 */
function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
        return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
        return 0;
    }

    return dotProduct / (normA * normB);
}

/**
 * Find similar teams using embedding vectors
 * @param {string} teamId - Team ID to find similar teams for
 * @param {Object} options - Search options
 * @returns {Object} Similar teams with similarity scores
 */
export const findSimilarTeams = async (teamId, options = {}) => {
    try {
        const { limit = 10, minSimilarity = 0.5, language = "he" } = options;

        logWithCheckpoint("info", "Finding similar teams", "EMBEDDING_001", {
            teamId,
            options,
        });

        // Get the embedding for the source team
        const sourceEmbedding = await TeamEmbedding.findOne({ teamId });

        if (!sourceEmbedding) {
            return {
                success: false,
                error: "No embedding found for this team",
            };
        }

        const sourceVector =
            language === "he"
                ? sourceEmbedding.embedding_he
                : sourceEmbedding.embedding_en;

        if (!sourceVector || sourceVector.length === 0) {
            return {
                success: false,
                error: `No ${language} embedding available for this team`,
            };
        }

        // Get all team embeddings
        const allEmbeddings = await TeamEmbedding.find({
            teamId: { $ne: teamId }, // Exclude source team
        }).lean();

        // Calculate similarity scores
        const similarities = allEmbeddings
            .map((embedding) => {
                const targetVector =
                    language === "he" ? embedding.embedding_he : embedding.embedding_en;

                if (!targetVector || targetVector.length === 0) {
                    return null;
                }

                const similarity = cosineSimilarity(sourceVector, targetVector);

                return {
                    teamId: embedding.teamId,
                    similarity,
                };
            })
            .filter((item) => item !== null && item.similarity >= minSimilarity)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);

        // Get team details
        const teamIds = similarities.map((s) => s.teamId);
        const teams = await Team.find({ _id: { $in: teamIds } })
            .select("name name_en code slug logoUrl country_he country_en")
            .lean();

        // Create a map for easy lookup
        const teamMap = new Map(teams.map((t) => [t._id.toString(), t]));

        // Combine similarity scores with team data
        const results = similarities
            .map((sim) => {
                const team = teamMap.get(sim.teamId.toString());
                if (!team) return null;

                return {
                    team: {
                        _id: team._id.toString(),
                        name: language === "he" ? team.name : team.name_en,
                        country:
                            language === "he" ? team.country_he || team.country_en : team.country_en,
                        code: team.code,
                        slug: team.slug,
                        logoUrl: team.logoUrl,
                    },
                    similarity: sim.similarity,
                };
            })
            .filter((item) => item !== null);

        logWithCheckpoint("info", "Similar teams found", "EMBEDDING_002", {
            teamId,
            resultsCount: results.length,
        });

        return {
            success: true,
            data: {
                sourceTeamId: teamId,
                similarTeams: results,
                totalResults: results.length,
            },
        };
    } catch (error) {
        logError(error, {
            operation: "findSimilarTeams",
            teamId,
            options,
        });
        return {
            success: false,
            error: "Failed to find similar teams",
            message: error.message,
        };
    }
};

/**
 * Search teams using semantic search with query embedding
 * NOTE: This requires an embedding generation service (e.g., OpenAI, Cohere)
 * @param {string} query - Search query
 * @param {number[]} queryEmbedding - Pre-generated embedding for the query
 * @param {Object} options - Search options
 * @returns {Object} Search results with similarity scores
 */
export const semanticTeamSearch = async (query, queryEmbedding, options = {}) => {
    try {
        const { limit = 10, minSimilarity = 0.3, language = "he" } = options;

        logWithCheckpoint("info", "Performing semantic team search", "EMBEDDING_003", {
            query,
            options,
        });

        if (!queryEmbedding || queryEmbedding.length === 0) {
            return {
                success: false,
                error: "Query embedding is required",
            };
        }

        // Get all team embeddings
        const allEmbeddings = await TeamEmbedding.find({}).lean();

        // Calculate similarity scores
        const similarities = allEmbeddings
            .map((embedding) => {
                const targetVector =
                    language === "he" ? embedding.embedding_he : embedding.embedding_en;

                if (!targetVector || targetVector.length === 0) {
                    return null;
                }

                const similarity = cosineSimilarity(queryEmbedding, targetVector);

                return {
                    teamId: embedding.teamId,
                    similarity,
                };
            })
            .filter((item) => item !== null && item.similarity >= minSimilarity)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);

        // Get team details
        const teamIds = similarities.map((s) => s.teamId);
        const teams = await Team.find({ _id: { $in: teamIds } })
            .select("name name_en code slug logoUrl country_he country_en")
            .lean();

        // Create a map for easy lookup
        const teamMap = new Map(teams.map((t) => [t._id.toString(), t]));

        // Combine similarity scores with team data
        const results = similarities
            .map((sim) => {
                const team = teamMap.get(sim.teamId.toString());
                if (!team) return null;

                return {
                    team: {
                        _id: team._id.toString(),
                        name: language === "he" ? team.name : team.name_en,
                        country:
                            language === "he" ? team.country_he || team.country_en : team.country_en,
                        code: team.code,
                        slug: team.slug,
                        logoUrl: team.logoUrl,
                    },
                    similarity: sim.similarity,
                };
            })
            .filter((item) => item !== null);

        logWithCheckpoint("info", "Semantic search completed", "EMBEDDING_004", {
            query,
            resultsCount: results.length,
        });

        return {
            success: true,
            data: {
                query,
                teams: results,
                totalResults: results.length,
            },
        };
    } catch (error) {
        logError(error, {
            operation: "semanticTeamSearch",
            query,
            options,
        });
        return {
            success: false,
            error: "Failed to perform semantic search",
            message: error.message,
        };
    }
};

/**
 * Update or create embedding for a team
 * @param {string} teamId - Team ID
 * @param {number[]} embeddingVector - Embedding vector
 * @param {string} language - Language ('he' or 'en')
 * @returns {Object} Updated embedding document
 */
export const updateTeamEmbedding = async (teamId, embeddingVector, language = "he") => {
    try {
        logWithCheckpoint("info", "Updating team embedding", "EMBEDDING_005", {
            teamId,
            language,
            vectorLength: embeddingVector?.length,
        });

        if (!embeddingVector || !Array.isArray(embeddingVector) || embeddingVector.length === 0) {
            return {
                success: false,
                error: "Invalid embedding vector",
            };
        }

        let embedding;
        if (language === "he") {
            embedding = await TeamEmbedding.updateHebrewEmbedding(teamId, embeddingVector);
        } else if (language === "en") {
            embedding = await TeamEmbedding.updateEnglishEmbedding(teamId, embeddingVector);
        } else {
            return {
                success: false,
                error: "Invalid language. Use 'he' or 'en'",
            };
        }

        logWithCheckpoint("info", "Team embedding updated", "EMBEDDING_006", {
            teamId,
            language,
        });

        return {
            success: true,
            data: embedding,
        };
    } catch (error) {
        logError(error, {
            operation: "updateTeamEmbedding",
            teamId,
            language,
        });
        return {
            success: false,
            error: "Failed to update team embedding",
            message: error.message,
        };
    }
};
