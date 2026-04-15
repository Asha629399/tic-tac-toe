var WINNING_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

var TURN_TIMEOUT_SECONDS = 30;

function checkWinner(board) {
  for (var i = 0; i < WINNING_LINES.length; i++) {
    var line = WINNING_LINES[i];
    var a = line[0], b = line[1], c = line[2];
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return board.indexOf(null) >= 0 ? null : "draw";
}

function getAiMove(board) {
  var available = [];
  for (var i = 0; i < board.length; i++) {
    if (board[i] === null) available.push(i);
  }
  if (available.length === 0) return -1;
  return available[Math.floor(Math.random() * available.length)];
}

// ============ LEADERBOARD FUNCTIONS ============

function updatePlayerStats(nk, logger, userId, won, isDraw) {
  var objectIds = [{ collection: "stats", key: "player_" + userId, userId: userId }];
  var objects = nk.storageRead(objectIds);
  
  var stats = {
    wins: 0,
    losses: 0,
    draws: 0,
    currentStreak: 0,
    bestStreak: 0,
    totalGames: 0
  };
  
  if (objects.length > 0) {
    stats = objects[0].value;
  }
  
  stats.totalGames++;
  
  if (isDraw) {
    stats.draws++;
    stats.currentStreak = 0;
  } else if (won) {
    stats.wins++;
    stats.currentStreak++;
    if (stats.currentStreak > stats.bestStreak) {
      stats.bestStreak = stats.currentStreak;
    }
  } else {
    stats.losses++;
    stats.currentStreak = 0;
  }
  
  var write = [{
    collection: "stats",
    key: "player_" + userId,
    userId: userId,
    value: stats,
    permissionRead: 1,
    permissionWrite: 0
  }];
  
  nk.storageWrite(write);
  logger.info("Stats updated for player " + userId + ": W=" + stats.wins + " L=" + stats.losses + " D=" + stats.draws);
  
  // Update leaderboard
  var score = stats.wins * 3 + stats.draws;
  var metadata = {
    wins: stats.wins,
    losses: stats.losses,
    draws: stats.draws,
    streak: stats.currentStreak,
    bestStreak: stats.bestStreak
  };
  
  try {
    nk.leaderboardRecordWrite("global_leaderboard", userId, userId, score, 0, metadata);
    logger.info("Leaderboard updated for player " + userId + " with score " + score);
  } catch (e) {
    logger.error("Failed to write leaderboard: " + e);
  }
}

// ============ MATCH HANDLERS ============

function matchInit(ctx, logger, nk, params) {
  var mode = params.mode || "pvp"; // "pvp", "ai", "timed"
  var label = {
    open: 1,
    mode: mode
  };
  
  return {
    state: {
      board: [null,null,null,null,null,null,null,null,null],
      turn: 0,
      players: [],
      playerNames: {},
      winner: null,
      mode: mode,
      aiPlayer: mode === "ai",
      timedMode: mode === "timed",
      turnStartTime: null,
      timeRemaining: TURN_TIMEOUT_SECONDS
    },
    tickRate: 1,
    label: JSON.stringify(label)
  };
}

function matchJoinAttempt(ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
  var maxPlayers = state.mode === "ai" ? 1 : 2;
  
  if (state.players.length >= maxPlayers) {
    return {
      state: state,
      accept: false,
      rejectMessage: "Match is full"
    };
  }
  
  return {
    state: state,
    accept: true
  };
}

function matchJoin(ctx, logger, nk, dispatcher, tick, state, presences) {
  presences.forEach(function(p) {
    var userId = p.userId || p.user_id;
    var username = p.username || "Player";
    
    if (userId && state.players.indexOf(userId) === -1) {
      state.players.push(userId);
      state.playerNames[userId] = username;
      logger.info("Player joined: " + username + " (" + userId + ")");
    }
  });
  
  // Add AI as second player if in AI mode
  if (state.mode === "ai" && state.players.length === 1 && state.players.indexOf("AI") === -1) {
    state.players.push("AI");
    state.playerNames["AI"] = "AI";
    state.aiPlayer = true;
    logger.info("AI player added");
  }
  
  // Start timer when both players are present
  var maxPlayers = state.mode === "ai" ? 1 : 2;
  if (state.players.length >= maxPlayers && state.turnStartTime === null) {
    state.turnStartTime = Date.now();
    state.timeRemaining = TURN_TIMEOUT_SECONDS;
  }
  
  // Update label to mark match as closed when full
  if (state.players.length >= maxPlayers) {
    var label = {
      open: 0,
      mode: state.mode
    };
    dispatcher.matchLabelUpdate(JSON.stringify(label));
  }
  
  dispatcher.broadcastMessage(1, JSON.stringify(state));
  return { state: state };
}

function matchLoop(ctx, logger, nk, dispatcher, tick, state, messages) {
  if (state.winner) {
    return { state: state };
  }

  var maxPlayers = state.mode === "ai" ? 1 : 2;
  if (state.players.length < maxPlayers) {
    return { state: state };
  }

  // Check for timeout in timed mode
  if (state.timedMode && state.turnStartTime !== null) {
    var elapsed = (Date.now() - state.turnStartTime) / 1000;
    state.timeRemaining = Math.max(0, TURN_TIMEOUT_SECONDS - Math.floor(elapsed));
    
    if (elapsed >= TURN_TIMEOUT_SECONDS) {
      // Timeout - current player loses
      var losingPlayer = state.players[state.turn];
      var winningPlayerIndex = 1 - state.turn;
      state.winner = winningPlayerIndex === 0 ? "X" : "O";
      state.winnerReason = "timeout";
      
      logger.info("Player " + losingPlayer + " timed out");
      
      // Update stats for both players
      if (losingPlayer !== "AI") {
        updatePlayerStats(nk, logger, losingPlayer, false, false);
      }
      var winningPlayer = state.players[winningPlayerIndex];
      if (winningPlayer !== "AI") {
        updatePlayerStats(nk, logger, winningPlayer, true, false);
      }
      
      dispatcher.broadcastMessage(1, JSON.stringify(state));
      return { state: state };
    }
  }

  // Process human moves with full server-side validation
  var moveProcessed = false;
  messages.forEach(function(msg) {
    if (moveProcessed) return;
    
    try {
      var dataStr = nk.binaryToString(msg.data);
      var move = JSON.parse(dataStr);
      
      var senderId = msg.sender.userId || msg.sender.user_id || msg.sender.sessionId || msg.sender.session_id;
      var playerIndex = state.players.indexOf(senderId);

      // Validation 1: Player must be in the game
      if (playerIndex === -1) {
        logger.warn("Move rejected: Unknown player " + senderId);
        return;
      }

      // Validation 2: Must be player's turn
      if (playerIndex !== state.turn) {
        logger.warn("Move rejected: Not player's turn");
        return;
      }

      // Validation 3: Position must be valid
      if (move.position < 0 || move.position > 8) {
        logger.warn("Move rejected: Invalid position " + move.position);
        return;
      }

      // Validation 4: Cell must be empty
      if (state.board[move.position] !== null) {
        logger.warn("Move rejected: Cell occupied");
        return;
      }

      // Apply validated move
      state.board[move.position] = playerIndex === 0 ? "X" : "O";
      state.turn = 1 - state.turn;
      state.winner = checkWinner(state.board);
      
      // Reset timer for next turn
      if (state.timedMode && !state.winner) {
        state.turnStartTime = Date.now();
        state.timeRemaining = TURN_TIMEOUT_SECONDS;
      }
      
      // Update stats if game ended
      if (state.winner) {
        var isDraw = state.winner === "draw";
        state.players.forEach(function(playerId, idx) {
          if (playerId !== "AI") {
            var won = !isDraw && ((state.winner === "X" && idx === 0) || (state.winner === "O" && idx === 1));
            updatePlayerStats(nk, logger, playerId, won, isDraw);
          }
        });
      }

      dispatcher.broadcastMessage(1, JSON.stringify(state));
      moveProcessed = true;
      logger.info("Move applied: player=" + playerIndex + " pos=" + move.position);
    } catch (e) {
      logger.error("Error processing move: " + e);
    }
  });

  // AI move if it's AI's turn
  if (state.aiPlayer && state.turn === 1 && !state.winner && !moveProcessed) {
    var aiMove = getAiMove(state.board);
    if (aiMove >= 0) {
      state.board[aiMove] = "O";
      state.turn = 0;
      state.winner = checkWinner(state.board);
      
      // Reset timer after AI move
      if (state.timedMode && !state.winner) {
        state.turnStartTime = Date.now();
        state.timeRemaining = TURN_TIMEOUT_SECONDS;
      }
      
      // Update stats if game ended
      if (state.winner) {
        var isDraw = state.winner === "draw";
        var humanPlayer = state.players[0];
        if (humanPlayer !== "AI") {
          var won = !isDraw && state.winner === "X";
          updatePlayerStats(nk, logger, humanPlayer, won, isDraw);
        }
      }
      
      dispatcher.broadcastMessage(1, JSON.stringify(state));
      logger.info("AI move: pos=" + aiMove);
    }
  }
  
  // Broadcast timer updates in timed mode
  if (state.timedMode && !state.winner && tick % 1 === 0) {
    dispatcher.broadcastMessage(1, JSON.stringify(state));
  }

  return { state: state };
}

function matchLeave(ctx, logger, nk, dispatcher, tick, state, presences) {
  presences.forEach(function(p) {
    var userId = p.userId || p.user_id;
    var index = state.players.indexOf(userId);
    
    if (index !== -1) {
      logger.info("Player left: " + userId);
      
      // If a player leaves, the other player wins
      if (state.mode !== "ai" && !state.winner) {
        var remainingPlayerIndex = 1 - index;
        state.winner = remainingPlayerIndex === 0 ? "X" : "O";
        state.winnerReason = "forfeit";
        
        // Update stats
        if (userId !== "AI") {
          updatePlayerStats(nk, logger, userId, false, false);
        }
        var winningPlayer = state.players[remainingPlayerIndex];
        if (winningPlayer !== "AI") {
          updatePlayerStats(nk, logger, winningPlayer, true, false);
        }
        
        dispatcher.broadcastMessage(1, JSON.stringify(state));
        logger.info("Player disconnected, opponent wins by forfeit");
      }
    }
  });
  
  return { state: state };
}

function matchTerminate(ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
  logger.info("Match terminated");
  return null;
}

function matchSignal(ctx, logger, nk, dispatcher, tick, state, data) {
  return { state: state };
}

// ============ RPC HANDLERS ============

function rpcCreateMatch(ctx, logger, nk, payload) {
  var params = payload ? JSON.parse(payload) : {};
  var mode = params.mode || "pvp";
  
  var matchId = nk.matchCreate("tic-tac-toe", { mode: mode });
  logger.info("Match created: " + matchId + " mode=" + mode);
  
  return JSON.stringify({ 
    match_id: matchId,
    mode: mode
  });
}

function rpcListMatches(ctx, logger, nk, payload) {
  var params = payload ? JSON.parse(payload) : {};
  var mode = params.mode || "pvp";
  
  var limit = 20;
  var authoritative = true;
  var label = JSON.stringify({ open: 1, mode: mode });
  var minSize = 1;
  var maxSize = 1;
  
  var matches = nk.matchList(limit, authoritative, label, minSize, maxSize);
  
  var result = [];
  for (var i = 0; i < matches.length; i++) {
    var match = matches[i];
    result.push({
      match_id: match.matchId,
      size: match.size,
      label: match.label
    });
  }
  
  logger.info("Listed " + result.length + " available matches for mode: " + mode);
  return JSON.stringify({ matches: result });
}

function rpcFindMatch(ctx, logger, nk, payload) {
  var params = payload ? JSON.parse(payload) : {};
  var mode = params.mode || "pvp";
  
  var limit = 1;
  var authoritative = true;
  var label = JSON.stringify({ open: 1, mode: mode });
  var minSize = 1;
  var maxSize = 1;
  
  var matches = nk.matchList(limit, authoritative, label, minSize, maxSize);
  
  if (matches.length > 0) {
    var matchId = matches[0].matchId;
    logger.info("Found existing match: " + matchId);
    return JSON.stringify({ 
      match_id: matchId,
      created: false,
      mode: mode
    });
  } else {
    var matchId = nk.matchCreate("tic-tac-toe", { mode: mode });
    logger.info("Created new match for matchmaking: " + matchId);
    return JSON.stringify({ 
      match_id: matchId,
      created: true,
      mode: mode
    });
  }
}

function rpcGetLeaderboard(ctx, logger, nk, payload) {
  var limit = 100;
  var records = nk.leaderboardRecordsList("global_leaderboard", null, limit);
  
  var leaderboard = [];
  if (records && records.records) {
    for (var i = 0; i < records.records.length; i++) {
      var record = records.records[i];
      leaderboard.push({
        rank: record.rank,
        username: record.username || "Player",
        score: record.score,
        wins: record.metadata.wins || 0,
        losses: record.metadata.losses || 0,
        draws: record.metadata.draws || 0,
        streak: record.metadata.streak || 0,
        bestStreak: record.metadata.bestStreak || 0
      });
    }
  }
  
  logger.info("Retrieved leaderboard with " + leaderboard.length + " entries");
  return JSON.stringify({ leaderboard: leaderboard });
}

function rpcGetPlayerStats(ctx, logger, nk, payload) {
  var userId = ctx.userId;
  var objectIds = [{ collection: "stats", key: "player_" + userId, userId: userId }];
  var objects = nk.storageRead(objectIds);
  
  var stats = {
    wins: 0,
    losses: 0,
    draws: 0,
    currentStreak: 0,
    bestStreak: 0,
    totalGames: 0
  };
  
  if (objects.length > 0) {
    stats = objects[0].value;
  }
  
  return JSON.stringify({ stats: stats });
}

// ============ MODULE INITIALIZATION ============

var InitModule = function(ctx, logger, nk, initializer) {
  // Create leaderboard
  var id = "global_leaderboard";
  var authoritative = true;
  var sortOrder = nk.SortOrderDescending;
  var operator = nk.OperatorBest;
  var resetSchedule = null;
  var metadata = {
    name: "Global Leaderboard"
  };
  
  try {
    nk.leaderboardCreate(id, authoritative, sortOrder, operator, resetSchedule, metadata);
    logger.info("Leaderboard created: " + id);
  } catch (e) {
    logger.info("Leaderboard already exists: " + id);
  }
  
  // Register RPC endpoints
  initializer.registerRpc("create_match", rpcCreateMatch);
  initializer.registerRpc("list_matches", rpcListMatches);
  initializer.registerRpc("find_match", rpcFindMatch);
  initializer.registerRpc("get_leaderboard", rpcGetLeaderboard);
  initializer.registerRpc("get_player_stats", rpcGetPlayerStats);

  // Register match handler
  initializer.registerMatch("tic-tac-toe", {
    matchInit: matchInit,
    matchJoinAttempt: matchJoinAttempt,
    matchJoin: matchJoin,
    matchLoop: matchLoop,
    matchLeave: matchLeave,
    matchTerminate: matchTerminate,
    matchSignal: matchSignal
  });
  
  logger.info("Tic-Tac-Toe module initialized with leaderboard and timer support");
};
