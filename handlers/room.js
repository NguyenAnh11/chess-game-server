const uuidV4 = require("uuid").v4

const rooms = {}
const chats = {}

const ROOM_SOCKET_EVENTS = {
  ROOM_CREATED: "ROOM_CREATED",
  CREATE_GAME: "CREATE_GAME",
  REQ_JOIN_GAME: "REQ_JOIN_GAME",
  RES_GAME_INFO: "RES_GAME_INFO",
  REQ_GAME_INFO: "REQ_GAME_INFO",
  RES_JOIN_GAME: "RES_JOIN_GAME",
}

const roomHandler = (socket) => {
  const createRoom = ({ model }) => {
    const code = uuidV4()
    console.log("Game: ", code)
    rooms[code] = {
      status: "Wait",
      duration: Date.now() + model.duration,
      members: [],
      create_at: Date.now(),
    }
    socket.emit(ROOM_SOCKET_EVENTS.ROOM_CREATED, { code })
  }

  const joinGame = ({ code, user }) => {
    if (!chats[code]) chats[code] = []
    const { members } = rooms[code]

    if (members.length === 2) {
      socket.emit(ROOM_SOCKET_EVENTS.RES_JOIN_GAME, {
        success: false,
        error: "Room already fulled",
        code: ""
      })

      return
    }

    if (!members.some((p) => p.id === user.id)) {
      rooms[code].members = [...members, user]
      socket.join(code)

      socket.emit(ROOM_SOCKET_EVENTS.RES_JOIN_GAME, { 
        success: true,
        code
       })
    }
  }

  const getGameInfo = ({ code }) => {
    if (!Object.keys(rooms).includes(code)) {
      socket.emit(ROOM_SOCKET_EVENTS.RES_GAME_INFO, {
        success: false,
        error: `Room ${code} doesn't exist`
      })

      return
    }

    socket.emit(ROOM_SOCKET_EVENTS.RES_GAME_INFO, {
      success: true,
      info: rooms[code]
    })
  }

  socket.on(ROOM_SOCKET_EVENTS.CREATE_GAME, createRoom)
  socket.on(ROOM_SOCKET_EVENTS.REQ_JOIN_GAME, joinGame)
  socket.on(ROOM_SOCKET_EVENTS.REQ_GAME_INFO, getGameInfo)
}

exports.room = roomHandler
