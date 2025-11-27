# Team Embedding Migration Guide

This guide explains how to migrate team embeddings from the Team collection to the new TeamEmbedding collection.

## Overview

The embedding data (Hebrew and English vector embeddings) has been separated from the Team model into a dedicated TeamEmbedding model. This provides:

- **Better separation of concerns**: Team data and ML embeddings are stored separately
- **Improved performance**: Team queries don't need to load large embedding arrays
- **Easier maintenance**: Embeddings can be updated independently
- **Cleaner schema**: Team model focuses on core team data

## Models

### TeamEmbedding Model

Located at: `backend/src/models/TeamEmbedding.js`

**Schema:**
```javascript
{
  teamId: ObjectId (ref: Team, unique, indexed),
  embedding_he: [Number],  // Hebrew embedding vector
  embedding_en: [Number],  // English embedding vector
  embedding_he_createdAt: Date,
  embedding_en_createdAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

**Helper Methods:**
- `TeamEmbedding.findOrCreateByTeamId(teamId)` - Get or create embedding for a team
- `TeamEmbedding.updateHebrewEmbedding(teamId, vector)` - Update Hebrew embedding
- `TeamEmbedding.updateEnglishEmbedding(teamId, vector)` - Update English embedding

## Migration Steps

### 1. Run the Migration Script

This script copies embedding data from Team documents to TeamEmbedding documents:

```bash
cd backend
node scripts/migrateTeamEmbeddings.js
```

The script will:
- Find all teams with embedding data
- Create TeamEmbedding documents for each team
- Preserve the original creation timestamps
- Skip teams that already have embeddings migrated
- Provide a summary of the migration

### 2. Verify the Migration

Check that embeddings were migrated correctly:

```javascript
// In MongoDB shell or using a script
db.teamembeddings.countDocuments()
db.teamembeddings.findOne()
```

### 3. Update Your Code

Update any code that accesses team embeddings:

**Before:**
```javascript
const team = await Team.findById(teamId);
const embedding = team.embedding_he;
```

**After:**
```javascript
const team = await Team.findById(teamId);
const teamEmbedding = await TeamEmbedding.findOne({ teamId: team._id });
const embedding = teamEmbedding?.embedding_he;
```

Or use the helper method:
```javascript
const teamEmbedding = await TeamEmbedding.findOrCreateByTeamId(teamId);
```

### 4. Remove Old Embedding Fields (Optional)

After verifying the migration and updating your code, you can remove the embedding fields from the Team collection:

```bash
node scripts/removeTeamEmbeddingFields.js
```

**⚠️ WARNING:** This permanently removes embedding fields from Team documents. Make sure you have:
1. Successfully migrated all embeddings
2. Verified the TeamEmbedding collection
3. Updated all code that accesses embeddings
4. Created a database backup

## Usage Examples

### Creating/Updating Embeddings

```javascript
import TeamEmbedding from './models/TeamEmbedding.js';

// Update Hebrew embedding
await TeamEmbedding.updateHebrewEmbedding(teamId, hebrewVector);

// Update English embedding
await TeamEmbedding.updateEnglishEmbedding(teamId, englishVector);

// Get or create embedding
const embedding = await TeamEmbedding.findOrCreateByTeamId(teamId);
```

### Querying with Embeddings

```javascript
// Get team with its embedding
const team = await Team.findById(teamId);
const embedding = await TeamEmbedding.findOne({ teamId: team._id });

// Or use populate (if you add a virtual to Team model)
const team = await Team.findById(teamId).populate('embedding');
```

### Batch Operations

```javascript
// Get all embeddings for multiple teams
const teamIds = [id1, id2, id3];
const embeddings = await TeamEmbedding.find({ 
  teamId: { $in: teamIds } 
});

// Create a map for easy lookup
const embeddingMap = new Map(
  embeddings.map(e => [e.teamId.toString(), e])
);
```

## Rollback

If you need to rollback the migration:

1. The original embedding data remains in the Team collection until you run the removal script
2. Simply delete the TeamEmbedding collection:
   ```javascript
   db.teamembeddings.drop()
   ```
3. Revert any code changes

## Notes

- The migration script is idempotent - you can run it multiple times safely
- Existing TeamEmbedding documents will be skipped
- The original Team documents are not modified by the migration script
- Only run the removal script after thoroughly testing the migration
