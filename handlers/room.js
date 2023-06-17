const uuidV4 = require("uuid").v4;
const _ = require("lodash");

const rooms = {};
const chats = {};
const sockets = {};
let users = [];

const ROOM_SOCKET_EVENTS = {
  ROOM_CREATED: "ROOM_CREATED",
  CREATE_GAME: "CREATE_GAME",
  REQ_JOIN_GAME: "REQ_JOIN_GAME",
  GET_GAME_INFO: "GET_GAME_INFO",
  GAME_INFO: "GAME_INFO",
  RES_JOIN_GAME: "RES_JOIN_GAME",
  USER_JOINED: "USER_JOINED",
  MAKE_MOVE: "MAKE_MOVE",
  RECEIVE_MOVE: "RECEIVE_MOVE",
  SEND_MESSAGE: "SEND_MESSAGE",
  RECEIVE_MESSAGE: "RECEIVE_MESSAGE",
  REQ_GAME_DRAW: "REQ_GAME_DRAW",
  SHOW_ACCEPT_REJECT_GAME_DRAW: "SHOW_ACCEPT_REJECT_GAME_DRAW",
  ACCEPT_OR_REJECT_GAME_DRAW: "ACCEPT_OR_REJECT_GAME_DRAW",
  REJECT_GAME_DRAW: "REJECT_GAME_DRAW",
  GAME_DRAW: "GAME_DRAW",
  RESIGN: "RESIGN",
  OPPONENT_RESIGN: "OPPONENT_RESIGN",
  OPPONENT_LEAVE: "OPPONENT_LEAVE"
};

const roomHandler = (socket) => {
  const createRoom = ({ model }) => {
    const code = uuidV4();
    chats[code] = [];
    rooms[code] = {
      code,
      status: "Wait",
      duration: model.duration,
      members: [],
      created_at: Date.now(),
    };
    socket.emit(ROOM_SOCKET_EVENTS.ROOM_CREATED, { code });
  };

  const joinGame = ({ code, user }) => {
    if (!rooms[code] || ["Game Over", "Draw"].includes(rooms[code].status)) {
      socket.emit(ROOM_SOCKET_EVENTS.RES_JOIN_GAME, {
        success: false,
        error: "Room doesn't exist",
      });

      return;
    }

    if (
      rooms[code].members.length === 2 &&
      !rooms[code].members.some((p) => p.id === user.id)
    ) {
      socket.emit(ROOM_SOCKET_EVENTS.RES_JOIN_GAME, {
        success: false,
        error: "Room has already fulled",
      });

      return;
    }

    if (!rooms[code].members.some(p => p.id === user.id)) {
      const cloneUser = _.cloneDeep(user);

      if (rooms[code].members.length === 1) {
        cloneUser.color = rooms[code].members[0].color === "w" ? "b" : "w";
      }

      rooms[code].members.push({ ...cloneUser, isLoser: false });

      if (rooms[code].members.length === 2) rooms[code].status = "Ready";

      socket.join(code);

      socket.to(code).emit(ROOM_SOCKET_EVENTS.USER_JOINED, {
        status: rooms[code].status,
        members: rooms[code].members,
      });

      socket.emit(ROOM_SOCKET_EVENTS.RES_JOIN_GAME, {
        success: true,
        code,
      });

      sockets[socket.id] = {
        user_id: user.id,
        room_id: code,
      };

      users.push(user);
    }
  };

  const getGameInfo = ({ code }) => {
    socket.emit(ROOM_SOCKET_EVENTS.GAME_INFO, { data: rooms[code] });
  };

  const receiveMove = ({ code, move }) => {
    socket.to(code).emit(ROOM_SOCKET_EVENTS.RECEIVE_MOVE, move);
  };

  const receiveMessage = ({ code, data }) => {
    chats[code] = [...chats[code], data];
    socket.to(code).emit(ROOM_SOCKET_EVENTS.RECEIVE_MESSAGE, data);
  };

  const receiveRequestGameDraw = (code) => {
    socket.to(code).emit(ROOM_SOCKET_EVENTS.SHOW_ACCEPT_REJECT_GAME_DRAW);
  };

  const receiveAcceptOrRejectGameDraw = ({ code, accept }) => {
    if (!accept) {
      socket.to(code).emit(ROOM_SOCKET_EVENTS.REJECT_GAME_DRAW);
      return;
    }

    rooms[code].status = "Draw";
    socket.in(code).emit(ROOM_SOCKET_EVENTS.GAME_DRAW);
  };

  const resign = ({ code, userId }) => {
    rooms[code] = {
      ...rooms[code],
      status: "Game Over",
      members: rooms[code].members.reduce((prev, curr) => {
        if (curr.id === userId) curr.isLoser = true;
        return [...prev, curr];
      }, []),
    };

    socket.to(code).emit(ROOM_SOCKET_EVENTS.OPPONENT_RESIGN, rooms[code]);
  };

  socket.on(ROOM_SOCKET_EVENTS.CREATE_GAME, createRoom);
  socket.on(ROOM_SOCKET_EVENTS.REQ_JOIN_GAME, joinGame);
  socket.on(ROOM_SOCKET_EVENTS.GET_GAME_INFO, getGameInfo);
  socket.on(ROOM_SOCKET_EVENTS.MAKE_MOVE, receiveMove);
  socket.on(ROOM_SOCKET_EVENTS.SEND_MESSAGE, receiveMessage);
  socket.on(ROOM_SOCKET_EVENTS.REQ_GAME_DRAW, receiveRequestGameDraw);
  socket.on(
    ROOM_SOCKET_EVENTS.ACCEPT_OR_REJECT_GAME_DRAW,
    receiveAcceptOrRejectGameDraw
  );
  socket.on(ROOM_SOCKET_EVENTS.RESIGN, resign);

  socket.on("disconnect", () => {
    console.log("Disconnect");

    if (
      sockets[socket.id] &&
      sockets[socket.id].user_id &&
      sockets[socket.id].room_id
    ) {
      const { user_id, room_id } = sockets[socket.id];
      const user = users.find((p) => p.id === user_id);

      if (rooms[room_id].members.length === 1) {
        delete rooms[room_id];
        return;
      }

      rooms[room_id] = {
        ...rooms[room_id],
       status: "Game Over",
       members: rooms[room_id].members.reduce((prev, curr) => {
        if (curr.id === user_id) curr.isLoser = true
        return [...prev, curr]
       }, [])
      };

      delete sockets[socket.id];

      users = users.filter(p => p.id !== user_id)

      const message = {
        content: `Game win by ${user.name} leave room`,
        isFromSystem: true,
        type: "Game Over",
      };

      chats[room_id] = [...chats[room_id], message];
      socket.to(room_id).emit(ROOM_SOCKET_EVENTS.RECEIVE_MESSAGE, message);

      socket.to(room_id).emit(ROOM_SOCKET_EVENTS.OPPONENT_LEAVE, rooms[room_id]);
    }
  });
};

exports.room = roomHandler;
