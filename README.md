# Tic-Tac-Toe Multiplayer Game with Nakama

A real-time multiplayer Tic-Tac-Toe game built with React and Nakama game server, featuring AI opponent, Player vs Player mode, timed matches, and global leaderboard.

## 🎮 Live Demo

- **Game URL**: [Will be added after deployment]
- **Nakama Server**: [Will be added after deployment]
- **Source Code**: https://github.com/Asha629399/tic-tac-toe

## ✨ Features

- **Multiple Game Modes**:
  - Play against AI opponent
  - Player vs Player (PvP) multiplayer
  - Timed mode with 30-second turn limits
- **Real-time Multiplayer**: WebSocket-based synchronization
- **Global Leaderboard**: Track wins, losses, draws, and streaks
- **Player Statistics**: Personal stats tracking
- **Room Browser**: Find and join available matches
- **Server-Authoritative**: All game logic validated on server
- **Visual Feedback**: ❌ and ⭕ symbols with turn indicators

## 🏗️ Architecture & Design Decisions

### Technology Stack

- **Frontend**: React 18 with Hooks
- **Backend**: Nakama 3.17.1 (JavaScript runtime)
- **Database**: PostgreSQL 12
- **Real-time Communication**: WebSocket
- **Containerization**: Docker & Docker Compose

### Architecture Overview

```
┌─────────────────┐         WebSocket/HTTP        ┌──────────────────┐
│  React Frontend │ ◄──────────────────────────► │  Nakama Server   │
│  (Port 3000)    │                                │  (Port 7350)     │
└─────────────────┘                                └────────┬─────────┘
                                                            │
                                                            │ SQL
                                                            ▼
                                                   ┌─────────────────┐
                                                   │   PostgreSQL    │
                                                   │   (Port 5432)   │
                                                   └─────────────────┘
```

### Key Design Decisions

1. **Server-Authoritative Game Logic**
   - All moves validated on server (4-level validation)
   - Prevents cheating and ensures fair gameplay
   - Validation layers: player identity → turn order → position validity → cell occupancy

2. **Match Handler Architecture**
   - `matchInit`: Initialize game state with mode selection
   - `matchJoin`: Handle player connections and AI addition
   - `matchLoop`: Process moves, check win conditions, handle timeouts
   - `matchLeave`: Handle disconnections and forfeit logic

3. **Leaderboard System**
   - Persistent storage using Nakama's storage API
   - Score calculation: `(wins × 3) + draws`
   - Metadata includes: wins, losses, draws, current streak, best streak

4. **Concurrent Match Support**
   - Match labels for filtering (open/closed, mode type)
   - Isolated match states
   - Room discovery via RPC endpoints

5. **Timer Implementation**
   - Server-side tick-based system (1 tick/second)
   - Auto-forfeit on timeout
   - Real-time countdown broadcast to clients

## 📋 Prerequisites

- Docker and Docker Compose
- Node.js 16+ and npm
- Git

## 🚀 Setup and Installation

### Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Asha629399/tic-tac-toe.git
   cd tic-tac-toe
   ```

2. **Start the backend services (Nakama + PostgreSQL)**:
   ```bash
   docker-compose up -d
   ```

3. **Wait for services to be ready** (30 seconds):
   ```bash
   docker logs -f server-nakama-1
   # Wait for "Startup done" message
   ```

4. **Install frontend dependencies**:
   ```bash
   cd frontend
   npm install
   ```

5. **Start the frontend**:
   ```bash
   npm start
   ```

6. **Open your browser**:
   Navigate to `http://localhost:3000`

### Stopping Services

```bash
docker-compose down
```

## 🌐 Deployment Process

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions on Render.com.

### Quick Deployment Steps:

1. **Deploy PostgreSQL Database** on Render (Free tier)
2. **Deploy Nakama Backend** using `Dockerfile.nakama`
3. **Deploy React Frontend** as Static Site
4. **Configure Environment Variables**:
   - Backend: `DATABASE_URL`
   - Frontend: `REACT_APP_NAKAMA_HOST`, `REACT_APP_NAKAMA_PORT`, `REACT_APP_NAKAMA_USE_SSL`

### Deployment URLs (After Deployment):
- Frontend: `https://tic-tac-toe-frontend.onrender.com`
- Nakama: `https://tic-tac-toe-nakama.onrender.com`

## 🔧 API/Server Configuration

### Nakama Configuration

**Environment Variables**:
```bash
DATABASE_URL=postgres://user:password@host:5432/nakama
SESSION_TOKEN_EXPIRY_SEC=7200
SESSION_REFRESH_TOKEN_EXPIRY_SEC=3600
```

**Ports**:
- `7350`: HTTP/WebSocket API
- `7349`: gRPC API
- `7351`: Console UI

### RPC Endpoints

| Endpoint | Description | Payload | Response |
|----------|-------------|---------|----------|
| `create_match` | Create new match | `{"mode": "ai\|pvp\|timed"}` | `{"match_id": "...", "mode": "..."}` |
| `find_match` | Find or create match | `{"mode": "pvp\|timed"}` | `{"match_id": "...", "created": bool}` |
| `list_matches` | List available matches | `{"mode": "pvp\|timed"}` | `{"matches": [...]}` |
| `get_leaderboard` | Get global leaderboard | `{}` | `{"leaderboard": [...]}` |
| `get_player_stats` | Get player statistics | `{}` | `{"stats": {...}}` |

### Match State Structure

```javascript
{
  board: [null, null, null, null, null, null, null, null, null],
  turn: 0,  // 0 = Player 1 (X), 1 = Player 2 (O)
  players: ["userId1", "userId2"],
  playerNames: {"userId1": "Player1", "userId2": "Player2"},
  winner: null,  // null | "X" | "O" | "draw"
  mode: "pvp",  // "ai" | "pvp" | "timed"
  aiPlayer: false,
  timedMode: false,
  turnStartTime: null,
  timeRemaining: 30
}
```

### Game Messages

**Client → Server** (OpCode 1):
```javascript
{
  position: 0-8  // Board position (0=top-left, 8=bottom-right)
}
```

**Server → Client** (OpCode 1):
```javascript
{
  // Full game state (see Match State Structure above)
}
```

## 🧪 How to Test Multiplayer Functionality

### Testing AI Mode

1. Open `http://localhost:3000`
2. Click **"Play vs AI"**
3. Make moves by clicking cells
4. AI responds automatically after ~1 second
5. Game ends when someone wins or board is full

### Testing Player vs Player Mode

**Option 1: Two Browser Tabs (Same Computer)**

1. Open `http://localhost:3000` in **Tab 1**
2. Click **"Play vs Player"**
3. Open `http://localhost:3000` in **Tab 2** (new incognito window)
4. Click **"Play vs Player"** in Tab 2
5. Both players should join the same match
6. Take turns making moves in each tab

**Option 2: Two Different Devices**

1. Find your local IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
2. Device 1: Open `http://localhost:3000`
3. Device 2: Open `http://YOUR_IP:3000`
4. Both click **"Play vs Player"**
5. Play the match

**Option 3: Room Browser**

1. Player 1: Click **"Browse Rooms"** → **"Create Room"**
2. Player 2: Click **"Browse Rooms"** → Click on available room
3. Both players join and play

### Testing Timed Mode

1. Click **"Timed Mode"**
2. Join or create a match
3. Observe 30-second countdown timer
4. If time runs out, current player loses automatically

### Testing Leaderboard

1. Play several complete matches (finish with winner/draw)
2. Click **"Leaderboard"** button
3. Verify stats are updated:
   - Wins, losses, draws
   - Score calculation: (wins × 3) + draws
   - Current streak and best streak

### Verifying Server-Side Validation

**Test Invalid Moves** (should be rejected):

1. Open browser console (F12)
2. Try clicking occupied cells → Should be ignored
3. Try clicking when it's not your turn → Should be ignored
4. Check Nakama logs for rejection messages:
   ```bash
   docker logs server-nakama-1 --tail 50 | grep "rejected"
   ```

### Testing Disconnection Handling

1. Start a PvP match with two tabs
2. Close one tab mid-game
3. Other player should win by forfeit
4. Check leaderboard updates

### Monitoring Backend Logs

```bash
# Real-time logs
docker logs -f server-nakama-1

# Filter for game events
docker logs server-nakama-1 | grep -E "Move applied|Player joined|Stats updated"

# Check for errors
docker logs server-nakama-1 | grep -i error
```

## 📁 Project Structure

```
server/
├── backend/
│   └── index.js              # Nakama match handler with game logic
├── frontend/
│   ├── src/
│   │   ├── App.js            # Main React component
│   │   ├── nakama.js         # Nakama client configuration
│   │   └── App.css           # Styling
│   ├── public/
│   └── package.json
├── docker-compose.yml        # Local development setup
├── Dockerfile.nakama         # Nakama deployment container
├── start.sh                  # Nakama startup script
├── DEPLOYMENT.md             # Deployment guide
└── README.md                 # This file
```

## 🔍 Backend Code Overview

### Key Functions

- **`checkWinner(board)`**: Checks for winning combinations or draw
- **`getAiMove(board)`**: AI logic (random available move)
- **`updatePlayerStats(nk, logger, userId, won, isDraw)`**: Updates player stats and leaderboard
- **`matchInit`**: Initializes match with mode selection
- **`matchJoin`**: Handles player joining and AI addition
- **`matchLoop`**: Main game loop - processes moves, checks win conditions, handles timeouts
- **`matchLeave`**: Handles player disconnection and forfeit

### RPC Handlers

- **`rpcCreateMatch`**: Creates new match with specified mode
- **`rpcFindMatch`**: Matchmaking - finds existing or creates new
- **`rpcListMatches`**: Lists available open matches
- **`rpcGetLeaderboard`**: Retrieves global leaderboard
- **`rpcGetPlayerStats`**: Gets individual player statistics

## 🛠️ Development

### Modifying Game Logic

**Backend** (`backend/index.js`):
```bash
# Edit the file
vim backend/index.js

# Restart Nakama to load changes
docker-compose restart nakama

# Check logs
docker logs -f server-nakama-1
```

**Frontend** (`frontend/src/App.js`):
```bash
# Edit the file
vim frontend/src/App.js

# Hot reload automatically updates browser
```

### Adding New Features

1. **New Game Mode**: Modify `matchInit` and add mode logic in `matchLoop`
2. **New RPC Endpoint**: Create function and register in `InitModule`
3. **UI Changes**: Update `frontend/src/App.js` and `App.css`

## 🐛 Troubleshooting

### Nakama won't start
```bash
docker-compose down
docker-compose up -d
docker logs server-nakama-1
```

### Frontend can't connect
- Check Nakama is running: `docker ps`
- Verify port 7350 is accessible
- Check browser console for errors

### Leaderboard not updating
- Finish complete games (don't refresh mid-game)
- Check logs: `docker logs server-nakama-1 | grep "Stats updated"`

### Moves not registering
- Check it's your turn
- Check cell is empty
- Check browser console and Nakama logs

## 📊 Performance Considerations

- **Concurrent Matches**: Supports multiple simultaneous games
- **WebSocket Efficiency**: Only broadcasts on state changes
- **Database**: Indexed leaderboard for fast queries
- **Tick Rate**: 1 tick/second (adjustable in `matchInit`)

## 🔒 Security Features

- Server-authoritative game logic
- Move validation (4 levels)
- Session token authentication
- No client-side game state manipulation

## 📝 License

MIT

## 👤 Author

Asha629399

## 🙏 Acknowledgments

- Nakama by Heroic Labs
- React by Meta
- PostgreSQL
