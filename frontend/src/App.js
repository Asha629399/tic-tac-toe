import React, { useEffect, useState, useRef } from "react";
import client from "./nakama";

function App() {
  const [screen, setScreen] = useState("menu"); // "menu", "game", "leaderboard"
  const [mode, setMode] = useState(null); // "ai", "pvp", "timed"
  const [board, setBoard] = useState(Array(9).fill(null));
  const [myIndex, setMyIndex] = useState(null);
  const [turn, setTurn] = useState(0);
  const [winner, setWinner] = useState(null);
  const [winnerReason, setWinnerReason] = useState(null);
  const [waiting, setWaiting] = useState(false);
  const [availableMatches, setAvailableMatches] = useState([]);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [leaderboard, setLeaderboard] = useState([]);
  const [playerStats, setPlayerStats] = useState(null);

  const socketRef = useRef(null);
  const matchIdRef = useRef(null);
  const myIndexRef = useRef(null);
  const turnRef = useRef(0);
  const winnerRef = useRef(null);
  const sessionRef = useRef(null);

  const setupMatch = async (matchId, socket) => {
    const match = await socket.joinMatch(matchId);
    matchIdRef.current = match.match_id;

    const othersCount = (match.presences || []).length;
    const idx = othersCount > 0 ? 1 : 0;
    myIndexRef.current = idx;
    setMyIndex(idx);
    setWaiting(mode !== "ai" && othersCount === 0);
  };

  const startGame = async (selectedMode) => {
    setMode(selectedMode);
    setScreen("game");
    setWaiting(selectedMode !== "ai");

    const deviceId = "device-" + Math.random().toString(36).substring(2);
    const session = await client.authenticateDevice(deviceId);
    sessionRef.current = session;

    const s = client.createSocket(false, false);

    s.onmatchdata = (data) => {
      if (data.op_code === 1) {
        const state = JSON.parse(new TextDecoder().decode(data.data));
        setBoard(state.board);
        turnRef.current = state.turn;
        setTurn(state.turn);
        winnerRef.current = state.winner || null;
        setWinner(state.winner || null);
        setWinnerReason(state.winnerReason || null);
        setTimeRemaining(state.timeRemaining || 30);
        
        if (state.players && state.players.length >= 2) {
          setWaiting(false);
        }
      }
    };

    s.onmatchpresence = (event) => {
      if (event.joins && event.joins.length > 0) {
        setWaiting(false);
      }
    };

    await s.connect(session, true);
    socketRef.current = s;

    if (selectedMode === "ai") {
      const result = await s.rpc("create_match", JSON.stringify({ mode: "ai" }));
      const data = JSON.parse(result.payload);
      await setupMatch(data.match_id, s);
    } else {
      const modeParam = selectedMode === "timed" ? "timed" : "pvp";
      const result = await s.rpc("find_match", JSON.stringify({ mode: modeParam }));
      const data = JSON.parse(result.payload);
      await setupMatch(data.match_id, s);
    }
  };

  const listMatches = async (selectedMode) => {
    const deviceId = "device-" + Math.random().toString(36).substring(2);
    const session = await client.authenticateDevice(deviceId);
    sessionRef.current = session;
    const s = client.createSocket(false, false);
    await s.connect(session, true);
    
    const modeParam = selectedMode === "timed" ? "timed" : "pvp";
    const result = await s.rpc("list_matches", JSON.stringify({ mode: modeParam }));
    const data = JSON.parse(result.payload);
    setAvailableMatches(data.matches || []);
    setMode(selectedMode);
    
    socketRef.current = s;
  };

  const joinMatch = async (matchId) => {
    setScreen("game");
    setWaiting(false);

    const s = socketRef.current;
    
    s.onmatchdata = (data) => {
      if (data.op_code === 1) {
        const state = JSON.parse(new TextDecoder().decode(data.data));
        setBoard(state.board);
        turnRef.current = state.turn;
        setTurn(state.turn);
        winnerRef.current = state.winner || null;
        setWinner(state.winner || null);
        setWinnerReason(state.winnerReason || null);
        setTimeRemaining(state.timeRemaining || 30);
      }
    };

    s.onmatchpresence = (event) => {
      if (event.joins && event.joins.length > 0) {
        setWaiting(false);
      }
    };

    await setupMatch(matchId, s);
  };

  const loadLeaderboard = async () => {
    const deviceId = "device-" + Math.random().toString(36).substring(2);
    const session = await client.authenticateDevice(deviceId);
    sessionRef.current = session;
    const s = client.createSocket(false, false);
    await s.connect(session, true);
    
    const result = await s.rpc("get_leaderboard", "");
    const data = JSON.parse(result.payload);
    setLeaderboard(data.leaderboard || []);
    
    // Get player stats
    const statsResult = await s.rpc("get_player_stats", "");
    const statsData = JSON.parse(statsResult.payload);
    setPlayerStats(statsData.stats);
    
    setScreen("leaderboard");
    socketRef.current = s;
  };

  const sendMove = (position) => {
    const s = socketRef.current;
    const matchId = matchIdRef.current;
    if (!s || !matchId) return;
    if (winnerRef.current) return;
    if (myIndexRef.current !== turnRef.current) return;
    if (board[position] !== null) return;
    s.sendMatchState(matchId, 1, JSON.stringify({ position }));
  };

  const resetGame = () => {
    if (socketRef.current) socketRef.current.disconnect(true);
    setScreen("menu");
    setMode(null);
    setBoard(Array(9).fill(null));
    setMyIndex(null);
    setTurn(0);
    setWinner(null);
    setWinnerReason(null);
    setWaiting(false);
    setAvailableMatches([]);
    setTimeRemaining(30);
    socketRef.current = null;
    matchIdRef.current = null;
    myIndexRef.current = null;
    turnRef.current = 0;
    winnerRef.current = null;
  };

  const mySymbol = myIndex === 0 ? "X" : "O";

  let status;
  if (waiting) status = "Waiting for opponent...";
  else if (winner === "draw") status = "It's a draw!";
  else if (winner) {
    if (winnerReason === "timeout") {
      status = winner === mySymbol ? "You win! Opponent timed out ⏱️" : "You lose! Time's up ⏱️";
    } else if (winnerReason === "forfeit") {
      status = winner === mySymbol ? "You win! Opponent left 🎉" : "You lose! You left";
    } else {
      status = winner === mySymbol ? "You win! 🎉" : "You lose!";
    }
  } else {
    status = myIndex === turn ? `Your turn (${mySymbol})` : "Opponent's turn";
  }

  // ============ MENU SCREEN ============
  if (screen === "menu") {
    return (
      <div style={{ textAlign: "center", marginTop: "40px", fontFamily: "Arial, sans-serif" }}>
        <h1 style={{ fontSize: "48px", marginBottom: "10px" }}>🎮 Tic Tac Toe</h1>
        <h2 style={{ color: "#666", marginBottom: "40px" }}>Select Game Mode</h2>
        
        <div style={{ marginTop: "30px" }}>
          <button
            onClick={() => startGame("ai")}
            style={{
              padding: "20px 40px",
              fontSize: "18px",
              margin: "10px",
              cursor: "pointer",
              background: "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "8px",
              boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
              transition: "transform 0.2s"
            }}
            onMouseOver={(e) => e.target.style.transform = "scale(1.05)"}
            onMouseOut={(e) => e.target.style.transform = "scale(1)"}
          >
            🤖 Play vs AI
          </button>
          
          <button
            onClick={() => startGame("pvp")}
            style={{
              padding: "20px 40px",
              fontSize: "18px",
              margin: "10px",
              cursor: "pointer",
              background: "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "8px",
              boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
            }}
            onMouseOver={(e) => e.target.style.transform = "scale(1.05)"}
            onMouseOut={(e) => e.target.style.transform = "scale(1)"}
          >
            👥 Play vs Player
          </button>
          
          <button
            onClick={() => startGame("timed")}
            style={{
              padding: "20px 40px",
              fontSize: "18px",
              margin: "10px",
              cursor: "pointer",
              background: "#FF5722",
              color: "white",
              border: "none",
              borderRadius: "8px",
              boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
            }}
            onMouseOver={(e) => e.target.style.transform = "scale(1.05)"}
            onMouseOut={(e) => e.target.style.transform = "scale(1)"}
          >
            ⏱️ Timed Mode (30s/turn)
          </button>
        </div>

        <div style={{ marginTop: "30px" }}>
          <button
            onClick={() => listMatches("pvp")}
            style={{
              padding: "15px 30px",
              fontSize: "16px",
              margin: "10px",
              cursor: "pointer",
              background: "#FF9800",
              color: "white",
              border: "none",
              borderRadius: "8px"
            }}
          >
            🚪 Browse Classic Rooms
          </button>
          
          <button
            onClick={() => listMatches("timed")}
            style={{
              padding: "15px 30px",
              fontSize: "16px",
              margin: "10px",
              cursor: "pointer",
              background: "#9C27B0",
              color: "white",
              border: "none",
              borderRadius: "8px"
            }}
          >
            ⏱️ Browse Timed Rooms
          </button>
          
          <button
            onClick={loadLeaderboard}
            style={{
              padding: "15px 30px",
              fontSize: "16px",
              margin: "10px",
              cursor: "pointer",
              background: "#FFC107",
              color: "#333",
              border: "none",
              borderRadius: "8px",
              fontWeight: "bold"
            }}
          >
            🏆 Leaderboard
          </button>
        </div>

        {availableMatches.length > 0 && (
          <div style={{ marginTop: "40px", maxWidth: "600px", margin: "40px auto" }}>
            <h3>Available Rooms ({mode === "timed" ? "Timed" : "Classic"})</h3>
            {availableMatches.map((match, idx) => (
              <div key={idx} style={{ 
                margin: "10px",
                padding: "15px",
                background: "#f5f5f5",
                borderRadius: "8px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <span>Room {idx + 1} - {match.size}/2 players</span>
                <button
                  onClick={() => joinMatch(match.match_id)}
                  style={{
                    padding: "10px 20px",
                    fontSize: "16px",
                    cursor: "pointer",
                    background: "#4CAF50",
                    color: "white",
                    border: "none",
                    borderRadius: "5px"
                  }}
                >
                  Join
                </button>
              </div>
            ))}
            <button
              onClick={resetGame}
              style={{
                marginTop: "20px",
                padding: "10px 20px",
                fontSize: "14px",
                cursor: "pointer",
                background: "#666",
                color: "white",
                border: "none",
                borderRadius: "5px"
              }}
            >
              Back to Menu
            </button>
          </div>
        )}
      </div>
    );
  }

  // ============ LEADERBOARD SCREEN ============
  if (screen === "leaderboard") {
    return (
      <div style={{ textAlign: "center", marginTop: "40px", fontFamily: "Arial, sans-serif" }}>
        <h1 style={{ fontSize: "48px", marginBottom: "10px" }}>🏆 Leaderboard</h1>
        
        {playerStats && (
          <div style={{
            maxWidth: "600px",
            margin: "20px auto",
            padding: "20px",
            background: "#e3f2fd",
            borderRadius: "10px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
          }}>
            <h3>Your Stats</h3>
            <div style={{ display: "flex", justifyContent: "space-around", marginTop: "15px" }}>
              <div>
                <div style={{ fontSize: "24px", fontWeight: "bold", color: "#4CAF50" }}>{playerStats.wins}</div>
                <div style={{ fontSize: "14px", color: "#666" }}>Wins</div>
              </div>
              <div>
                <div style={{ fontSize: "24px", fontWeight: "bold", color: "#f44336" }}>{playerStats.losses}</div>
                <div style={{ fontSize: "14px", color: "#666" }}>Losses</div>
              </div>
              <div>
                <div style={{ fontSize: "24px", fontWeight: "bold", color: "#FF9800" }}>{playerStats.draws}</div>
                <div style={{ fontSize: "14px", color: "#666" }}>Draws</div>
              </div>
              <div>
                <div style={{ fontSize: "24px", fontWeight: "bold", color: "#2196F3" }}>{playerStats.currentStreak}</div>
                <div style={{ fontSize: "14px", color: "#666" }}>Streak</div>
              </div>
              <div>
                <div style={{ fontSize: "24px", fontWeight: "bold", color: "#9C27B0" }}>{playerStats.bestStreak}</div>
                <div style={{ fontSize: "14px", color: "#666" }}>Best</div>
              </div>
            </div>
          </div>
        )}

        <div style={{ maxWidth: "800px", margin: "30px auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "white", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
            <thead>
              <tr style={{ background: "#2196F3", color: "white" }}>
                <th style={{ padding: "15px", textAlign: "left" }}>Rank</th>
                <th style={{ padding: "15px", textAlign: "left" }}>Player</th>
                <th style={{ padding: "15px", textAlign: "center" }}>Score</th>
                <th style={{ padding: "15px", textAlign: "center" }}>W/L/D</th>
                <th style={{ padding: "15px", textAlign: "center" }}>Streak</th>
                <th style={{ padding: "15px", textAlign: "center" }}>Best</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, idx) => (
                <tr key={idx} style={{ 
                  borderBottom: "1px solid #eee",
                  background: idx < 3 ? "#fff9c4" : "white"
                }}>
                  <td style={{ padding: "15px" }}>
                    {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : entry.rank}
                  </td>
                  <td style={{ padding: "15px", fontWeight: "bold" }}>{entry.username}</td>
                  <td style={{ padding: "15px", textAlign: "center", fontWeight: "bold", color: "#2196F3" }}>{entry.score}</td>
                  <td style={{ padding: "15px", textAlign: "center" }}>
                    <span style={{ color: "#4CAF50" }}>{entry.wins}</span>/
                    <span style={{ color: "#f44336" }}>{entry.losses}</span>/
                    <span style={{ color: "#FF9800" }}>{entry.draws}</span>
                  </td>
                  <td style={{ padding: "15px", textAlign: "center" }}>{entry.streak}</td>
                  <td style={{ padding: "15px", textAlign: "center", fontWeight: "bold" }}>{entry.bestStreak}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          onClick={resetGame}
          style={{
            marginTop: "30px",
            padding: "15px 40px",
            fontSize: "16px",
            cursor: "pointer",
            background: "#f44336",
            color: "white",
            border: "none",
            borderRadius: "8px"
          }}
        >
          Back to Menu
        </button>
      </div>
    );
  }

  // ============ GAME SCREEN ============
  return (
    <div style={{ textAlign: "center", marginTop: "40px", fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ fontSize: "36px", marginBottom: "10px" }}>🎮 Tic Tac Toe</h1>
      <p style={{ fontSize: "16px", fontWeight: "bold", color: "#666" }}>
        {mode === "ai" ? "🤖 Playing vs AI" : mode === "timed" ? "⏱️ Timed Mode" : "👥 Playing vs Player"}
      </p>
      
      {mode === "timed" && !winner && !waiting && (
        <div style={{
          fontSize: "32px",
          fontWeight: "bold",
          color: timeRemaining <= 10 ? "#f44336" : "#4CAF50",
          margin: "15px 0",
          animation: timeRemaining <= 10 ? "pulse 1s infinite" : "none"
        }}>
          ⏱️ {timeRemaining}s
        </div>
      )}
      
      <p style={{ fontSize: "18px", fontWeight: "bold", margin: "15px 0" }}>{status}</p>
      
      <div style={{ display: "inline-grid", gridTemplateColumns: "repeat(3, 100px)", marginTop: "20px", gap: "5px" }}>
        {board.map((cell, i) => (
          <button
            key={i}
            onClick={() => sendMove(i)}
            disabled={waiting || winner}
            style={{
              height: "100px",
              fontSize: "48px",
              cursor: cell || winner || waiting ? "default" : "pointer",
              background: cell === "X" ? "#ffebee" : cell === "O" ? "#e3f2fd" : "#f5f5f5",
              border: "3px solid #ccc",
              borderRadius: "8px",
              transition: "all 0.2s",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
            }}
          >
            {cell === "X" ? "❌" : cell === "O" ? "⭕" : ""}
          </button>
        ))}
      </div>
      
      <div style={{ marginTop: "30px" }}>
        <button
          onClick={resetGame}
          style={{
            padding: "12px 30px",
            fontSize: "16px",
            cursor: "pointer",
            background: "#f44336",
            color: "white",
            border: "none",
            borderRadius: "8px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
          }}
        >
          Back to Menu
        </button>
      </div>
    </div>
  );
}

export default App;
