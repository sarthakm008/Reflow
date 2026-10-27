# Reflow API

Express REST API for Reflow. It stores account data in MongoDB and authenticates users with a signed JWT in an HttpOnly cookie.

## Requirements

- Node.js 20 or newer
- npm
- MongoDB Community Server running locally, or a MongoDB Atlas connection string

## Setup

```powershell
cd server
Copy-Item .env.example .env
npm install
```

Edit `server/.env` and set:

- `MONGODB_URI`: e.g. `mongodb://127.0.0.1:27017/reflow`
- `JWT_SECRET`: a unique random value of at least 32 characters
- `CLIENT_ORIGIN`: `http://localhost:3000` for local development
- `PORT`: `4000` unless you need a different port

Generate a suitable development secret in PowerShell with:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Start MongoDB first, then run:

```powershell
npm run dev
```

The API listens on `http://localhost:4000`. Check `http://localhost:4000/api/health`; it returns HTTP 200 when MongoDB is connected and HTTP 503 with `status: "degraded"` when it is not.

## API endpoints

### Public

- `GET /api/health`
- `POST /api/auth/register` — `{ "name", "email", "password" }`
- `POST /api/auth/login` — `{ "email", "password" }`
- `POST /api/auth/logout`

### Authenticated (HttpOnly cookie)

- `GET /api/auth/me`
- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `GET /api/sessions`
- `POST /api/sessions`
- `GET /api/user/preferences`
- `PUT /api/user/preferences` — `{ "preferences": { ... } }`
- `GET /api/user/plans/:date` — date format `YYYY-MM-DD`
- `PUT /api/user/plans` — `{ "planDate": "YYYY-MM-DD", "plan": { ... } }`

All user-owned resources are scoped by the authenticated user ID. Password hashes are never returned by the API.

## Tests and lint

```powershell
npm test
npm run lint
```

Tests use Node's built-in test runner and exercise the HTTP health endpoint, degraded database status, 404 handling, and invalid JSON handling. They don't require a running MongoDB instance.
