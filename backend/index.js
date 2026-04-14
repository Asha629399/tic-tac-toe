var WINNING_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

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

function matchInit(ctx, logger, nk, params) {
  return {
    state: {
      board: [null,null,null,null,null,null,null,null,null],
      turn: 0,
      players: [],
      winner: null,
      aiPlayer: false
    },
    tickRate: 1,
    label: "tic-tac-toe"
  };
}

function matchJoinAttempt(ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
  return {
    state: state,
    accept: true
  };
}

function matchJoin(ctx, logger, nk, dispatcher, tick, state, presences) {
  presences.forEach(function(p) {
    var userId = p.userId || p.user_id;
    logger.info("matchJoin: presence=" + JSON.stringify(p));
    // Only add if not already in players list
    if (userId && state.players.indexOf(userId) === -1 && state.players.length < 1) {
      state.players.push(userId);
      logger.info("Added player: " + userId);
    }
  });
  
  // Add AI as second player if only 1 human joined
  if (state.players.length === 1 && state.players.indexOf("AI") === -1) {
    state.players.push("AI");
    state.aiPlayer = true;
    logger.info("Added AI player");
  }
  
  dispatcher.broadcastMessage(1, JSON.stringify(state));
  return { state: state };
}

function matchLoop(ctx, logger, nk, dispatcher, tick, state, messages) {
  if (state.winner) {
    return { state: state };
  }

  // Process human moves
  messages.forEach(function(msg) {
    try {
      var dataStr = nk.binaryToString(msg.data);
      var move = JSON.parse(dataStr);
      
      // msg.sender might have different property - try userId or user_id
      var senderId = msg.sender.userId || msg.sender.user_id || msg.sender.sessionId || msg.sender.session_id;
      var playerIndex = state.players.indexOf(senderId);

      logger.info("Move: pos=" + move.position + " sender=" + senderId + " playerIndex=" + playerIndex + " players=" + JSON.stringify(state.players) + " senderObj=" + JSON.stringify(msg.sender));

      if (playerIndex !== state.turn) {
        logger.info("Wrong turn: playerIndex=" + playerIndex + " turn=" + state.turn);
        return;
      }
      if (state.board[move.position] !== null) {
        logger.info("Cell occupied: " + move.position);
        return;
      }

      state.board[move.position] = playerIndex === 0 ? "X" : "O";
      state.turn = 1 - state.turn;
      state.winner = checkWinner(state.board);

      dispatcher.broadcastMessage(1, JSON.stringify(state));
      logger.info("Broadcasted: " + JSON.stringify(state));
    } catch (e) {
      logger.error("Error processing move: " + e);
    }
  });

  // AI move if it's AI's turn
  if (state.aiPlayer && state.turn === 1 && !state.winner) {
    var aiMove = getAiMove(state.board);
    if (aiMove >= 0) {
      state.board[aiMove] = "O";
      state.turn = 0;
      state.winner = checkWinner(state.board);
      dispatcher.broadcastMessage(1, JSON.stringify(state));
    }
  }

  return { state: state };
}

function matchLeave(ctx, logger, nk, dispatcher, tick, state, presences) {
  return { state: state };
}

function matchTerminate(ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
  return null;
}

function matchSignal(ctx, logger, nk, dispatcher, tick, state, data) {
  return { state: state };
}

function rpcCreateMatch(ctx, logger, nk, payload) {
  var matchId = nk.matchCreate("tic-tac-toe");
  return JSON.stringify({ match_id: matchId });
}

var InitModule = function(ctx, logger, nk, initializer) {
  initializer.registerRpc("create_match", rpcCreateMatch);

  initializer.registerMatch("tic-tac-toe", {
    matchInit: matchInit,
    matchJoinAttempt: matchJoinAttempt,
    matchJoin: matchJoin,
    matchLoop: matchLoop,
    matchLeave: matchLeave,
    matchTerminate: matchTerminate,
    matchSignal: matchSignal
  });
};
