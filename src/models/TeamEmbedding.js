import mongoose from "mongoose";

const teamEmbeddingSchema = new mongoose.Schema(
    {
        teamId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Team",
            required: true,
            unique: true,
            index: true,
        },
        embedding_he: {
            type: [Number],
            default: [],
        },
        embedding_en: {
            type: [Number],
            default: [],
        },
        embedding_he_createdAt: {
            type: Date,
        },
        embedding_en_createdAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

// Index for efficient lookups
teamEmbeddingSchema.index({ teamId: 1 }, { unique: true });

// Static method to get or create embedding document for a team
teamEmbeddingSchema.statics.findOrCreateByTeamId = async function (teamId) {
    let embedding = await this.findOne({ teamId });
    if (!embedding) {
        embedding = await this.create({ teamId, embedding_he: [] });
    }
    return embedding;
};

// Static method to update Hebrew embedding
teamEmbeddingSchema.statics.updateHebrewEmbedding = async function (
    teamId,
    embeddingVector
) {
    return await this.findOneAndUpdate(
        { teamId },
        {
            embedding_he: embeddingVector,
            embedding_he_createdAt: new Date(),
        },
        { upsert: true, new: true }
    );
};

// Static method to update English embedding
teamEmbeddingSchema.statics.updateEnglishEmbedding = async function (
    teamId,
    embeddingVector
) {
    return await this.findOneAndUpdate(
        { teamId },
        {
            embedding_en: embeddingVector,
            embedding_en_createdAt: new Date(),
        },
        { upsert: true, new: true }
    );
};

const TeamEmbedding = mongoose.model("TeamEmbedding", teamEmbeddingSchema);

export default TeamEmbedding;
