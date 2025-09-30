# Project Rules

## File & Folder Management

- Do not create new files or folders without explicit approval.
- Do not rename or move existing files unless requested.
- Follow the predefined folder structure under `src/`.

## Code Style

- Use ES Modules (`import/export`) only, no CommonJS (`require`).
- Use camelCase for functions and variables.
- Use PascalCase for Models and Classes.
- No inline `console.log` in production code. Use the logger utility instead.

## Database

- All MongoDB models must be placed under `src/models/`.
- Each model must have a dedicated service file under `src/services/`.

## Services Architecture

- All services must be split by responsibility, not by action.
- Use the following structure for complex services:
  - `QueryService.js` - Read operations (getAll, getById, search, filter)
  - `MutationService.js` - Write operations (create, update, delete, activate/deactivate)
  - `AuthService.js` - Authentication operations (login, logout, token management)
- Create an `index.js` file to export all service parts as a unified interface.
- Example: `UserService.query.getAllUsers()`, `UserService.mutate.createUser()`, `UserService.auth.updateLastLogin()`

## API

- All routes must be defined under `src/routes/`.
- Each route file should only handle HTTP layer logic and delegate to services.

## Response Format Guidelines (Success & Error)

### Success Responses

All successful API responses must follow this structure:

```ts
{
  success: true,
  code: "SUCCESS_CODE", // e.g., "LOGIN_SUCCESS", "OFFER_CREATED"
  message: "Success message", // Optional: can be overridden per request
  data: { ... } // Payload relevant to the operation
}
```

- `code`: Must be defined in `src/utils/errorCodes.js` (SUCCESS_CODES)
- `message`: Optional override; default comes from the success code definition
- `data`: The actual response payload (can be `null` if not applicable)

> Example:

```json
{
  "success": true,
  "code": "LOGIN_SUCCESS",
  "message": "Login successful",
  "data": {
    "token": "...",
    "user": { "_id": "...", "role": "agent" }
  }
}
```

### Error Responses

All error responses must follow this structure:

```ts
{
  success: false,
  error: {
    code: "ERROR_CODE", // e.g., "AUTH_INVALID_CREDENTIALS", "AGENT_NOT_FOUND"
    message: "Error message", // Optional: can be overridden per request
    details?: { ... } // Optional: additional context for debugging or frontend logic
  }
}
```

- `code`: Must be defined in `src/utils/errorCodes.js` (ERROR_CODES)
- `message`: Optional override; default comes from the error code definition
- `details`: Optional object for field-level or contextual metadata (never shown to end users)

> Example:

```json
{
  "success": false,
  "error": {
    "code": "AGENT_NOT_FOUND",
    "message": "Agent not found",
    "details": {
      "agentId": "68d68bd894f63f784de8907c"
    }
  }
}
```

### Additional Notes

- Never expose raw error messages from MongoDB, Mongoose, or external libraries.
- Always use `createSuccessResponse()` and `createErrorResponse()` helpers from `src/utils/errorCodes.js`.
- All response codes must be mapped in the frontend for multilingual support.
- Avoid using generic messages like `"Internal server error"` or `"Something went wrong"`.
- Handle all specific error types (validation, not found, duplicate, etc.) with appropriate error codes.

## Logging

- Use the `logger.js` utility for all logs.
- Log levels: `info`, `warn`, `error`, `debug`.
- All logs must be in colors for better readability.
- Each log should be as short as possible.
- No verbose logging in production code.

## Workers

- Place all scheduled jobs under `src/workers/`.
- Workers must not run automatically without explicit scheduling.

## Terminal Usage

- Always work with a single terminal window.
- Do not open new terminal windows or tabs.
- Use the existing terminal session for all commands.
