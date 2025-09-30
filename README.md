# Ticket Agent Backend

A Node.js/Express backend for a ticket price aggregation platform with MongoDB and Mongoose.

## Features

- **Football Events Management**: CRUD operations for football matches
- **Team Management**: Team information and fixtures
- **League Management**: League data and fixtures
- **Venue Management**: Stadium information
- **User Authentication**: JWT-based authentication with role-based access control
- **Agent System**: Agent management for ticket sales
- **Offer System**: Ticket offers management
- **API Integration**: External API integration for football data

## Tech Stack

- **Node.js** (v18+)
- **Express.js** (REST API)
- **MongoDB** + **Mongoose** (ORM)
- **JWT** (Authentication)
- **bcryptjs** (Password hashing)
- **Pino** (Logging)
- **Joi** (Validation)
- **node-cron** (Scheduled tasks)
- **axios** (HTTP client)

## Project Structure

```
src/
├── models/           # Mongoose schemas
├── services/         # Business logic
│   ├── football/     # Football events service (modular)
│   ├── team/         # Team service
│   ├── league/       # League service
│   ├── venue/        # Venue service
│   ├── user/         # User service
│   ├── agent/        # Agent service
│   └── offer/        # Offer service
├── routes/           # Express routes
├── middleware/       # Custom middleware
├── utils/            # Utilities
└── index.js          # Server entry point
```

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yigalipsey/Ticket-Agent-Backend.git
cd Ticket-Agent-Backend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Configure environment variables in `.env`:
```env
PORT=8080
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ticket-agent
JWT_SECRET=your-jwt-secret
API_FOOTBALL_KEY=your-api-football-key
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
```

5. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

### Football Events
- `GET /api/football-events` - Get all football events
- `GET /api/football-events/:id` - Get football event by ID
- `GET /api/football-events/slug/:slug` - Get football event by slug
- `POST /api/football-events` - Create football event
- `PUT /api/football-events/:id` - Update football event

### Teams
- `GET /api/teams` - Get all teams
- `GET /api/teams/:id` - Get team by ID
- `GET /api/teams/:slug/fixtures` - Get team fixtures by slug
- `POST /api/teams` - Create team
- `PUT /api/teams/:id` - Update team

### Leagues
- `GET /api/leagues` - Get all leagues
- `GET /api/leagues/:id` - Get league by ID
- `GET /api/leagues/:slug/fixtures` - Get league fixtures by slug
- `POST /api/leagues` - Create league
- `PUT /api/leagues/:id` - Update league

### Offers
- `GET /api/offers` - Get all offers
- `GET /api/offers/fixture/:fixtureId` - Get offers by fixture ID
- `GET /api/offers/fixture-slug/:fixtureSlug` - Get offers by fixture slug
- `POST /api/offers` - Create offer (agent only)

## User Roles

- **user**: Basic user access
- **agent**: Can create offers
- **admin**: Administrative access
- **super-admin**: Full system access

## Development

### Code Style
- ES Modules (`import/export`)
- Async/await for asynchronous operations
- Structured logging with Pino
- Error handling with custom error codes
- Input validation with Joi

### Database
- MongoDB with Mongoose ODM
- Indexed fields for performance
- Slug fields for SEO-friendly URLs
- Timestamps for audit trail

### Security
- JWT authentication
- Password hashing with bcryptjs
- Rate limiting
- Input validation
- CORS configuration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.