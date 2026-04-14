# Tic-Tac-Toe Game with Nakama

A real-time multiplayer Tic-Tac-Toe game built with React and Nakama game server, featuring an AI opponent.

## Features

- Play against AI opponent
- Real-time game updates
- Visual feedback with ❌ and ⭕ symbols
- Win/lose/draw detection
- Turn-based gameplay

## Tech Stack

- **Frontend**: React
- **Backend**: Nakama (JavaScript runtime)
- **Database**: PostgreSQL
- **Containerization**: Docker

## Prerequisites

- Docker and Docker Compose
- Node.js (for frontend development)

## Setup

1. **Start the backend services (Nakama + PostgreSQL)**:
   ```bash
   docker-compose up -d
   ```

2. **Install frontend dependencies**:
   ```bash
   cd frontend
   npm install
   ```

3. **Start the frontend**:
   ```bash
   npm start
   ```

4. **Open your browser**:
   Navigate to `http://localhost:3000`

## Project Structure

```
server/
├── backend/
│   └── index.js          # Nakama match handler with AI logic
├── frontend/
│   ├── src/
│   │   ├── App.js        # Main React component
│   │   ├── nakama.js     # Nakama client configuration
│   │   └── ...
│   └── package.json
├── docker-compose.yml    # Docker services configuration
└── README.md
```

## How It Works

1. Frontend creates a match via RPC call to Nakama
2. Nakama automatically adds an AI opponent
3. Player makes moves by clicking cells
4. AI responds automatically after ~1 second
5. Game state is synchronized in real-time via WebSocket

## Configuration

- Nakama runs on port `7350`
- PostgreSQL runs on port `5432`
- React dev server runs on port `3000`

## Development

To modify the game logic, edit:
- **Backend logic**: `backend/index.js`
- **Frontend UI**: `frontend/src/App.js`

After changing backend code, restart Nakama:
```bash
docker-compose restart nakama
```

## License

MIT
