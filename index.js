const WebSocket = require("ws")
const service = require("./data")
const path = require("path")

const http = require("http")
const fs = require("fs")
const Turn = require("node-turn")

// 生成随机字符串的函数
function generateRandomString(length = 8) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let result = ""
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// 生成随机TURN认证信息
const turnUsername = generateRandomString(10)
const turnPassword = generateRandomString(12)

const originalLog = console.log
console.log = function () {
  const date = new Date()
  const pad = (num) => String(num).padStart(2, "0")
  const ms = String(date.getMilliseconds()).padStart(3, "0")

  const timestamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds()
  )}.${ms}`

  originalLog.apply(console, [`[${timestamp}]`, ...arguments])
}

// 加载统一配置文件
let appConfig = {
  server: {
    httpPort: 8081,
    host: "0.0.0.0",
  },
  rooms: [],
  turnConfig: {
    enabled: true,
    turnPort: 3478,
    minPort: 49152,
    maxPort: 65535,
    credentials: {},
    debugLevel: "ERROR",
    listeningIps: ["0.0.0.0"],
    relayIps: ["0.0.0.0"],
    authMech: "long-term",
  },
}

try {
  const exePath = process.pkg ? path.dirname(process.execPath) : __dirname
  const configPath = path.join(exePath, "config.json")
  if (fs.existsSync(configPath)) {
    const configFromFile = require(configPath)
    // 合并配置
    appConfig = {
      server: { ...appConfig.server, ...configFromFile.server },
      rooms: configFromFile.rooms || appConfig.rooms,
      turnConfig: { ...appConfig.turnConfig, ...configFromFile.turnConfig },
    }
    console.log("Loaded application configuration from config.json")
  } else {
    console.log("Using default configuration (create config.json to customize)")
  }
} catch (e) {
  console.log("Using default configuration due to error:", e.message)
}

// 设置随机生成的认证信息
appConfig.turnConfig.credentials[turnUsername] = turnPassword

const HTTP_PORT = appConfig.server.httpPort
const TURN_PORT = appConfig.turnConfig.turnPort
const HTTP_DIRECTORY = path.join(__dirname, "www") // 静态文件目录

// 根据配置决定是否启动 TURN 服务器
let turnServer = null
if (appConfig.turnConfig.enabled) {
  turnServer = new Turn({
    listeningPort: TURN_PORT,
    listeningIps: appConfig.turnConfig.listeningIps,
    relayIps: appConfig.turnConfig.relayIps,
    minPort: appConfig.turnConfig.minPort,
    maxPort: appConfig.turnConfig.maxPort,
    authMech: appConfig.turnConfig.authMech,
    credentials: appConfig.turnConfig.credentials,
    debugLevel: appConfig.turnConfig.debugLevel,
  })

  turnServer.start()
}

// 创建 HTTP 服务器
const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split("?")[0]) // 去掉查询参数

  // 提供TURN配置API
  if (urlPath === "/api/turn-config") {
    res.setHeader("Content-Type", "application/json")
    res.setHeader("Access-Control-Allow-Origin", "*")

    const iceServers = [
      {
        urls: ["stun:74.125.250.129:19302"],
      },
    ]

    // 只有TURN服务启用时才添加TURN服务器配置
    if (appConfig.turnConfig.enabled) {
      iceServers.push({
        urls: [
          `turn:${req.headers.host?.split(":")[0] || "localhost"}:${TURN_PORT}`,
        ],
        username: turnUsername,
        credential: turnPassword,
      })
    }

    res.end(JSON.stringify({ iceServers }))
    return
  }

  if (urlPath === "/") {
    urlPath = "/index.html" // 默认访问 index.html
  }
  let filePath = path.join(HTTP_DIRECTORY, urlPath)
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // 如果文件不存在，返回 index.html
      filePath = path.join(HTTP_DIRECTORY, "index.html")
    }

    // 设置缓存头
    const ext = path.extname(filePath)
    if (ext === ".js" || ext === ".css") {
      res.setHeader("Cache-Control", "public, max-age=2592000") // 30天缓存
    }

    fs.createReadStream(filePath).pipe(res)
  })
})

server.listen(HTTP_PORT, () => {
  console.log(`HTTP server start on port ${HTTP_PORT}`)

  if (appConfig.turnConfig.enabled) {
    console.log(`TURN server start on port ${TURN_PORT}`)
    console.log(`TURN credentials: ${turnUsername}/${turnPassword}`)
    console.log(
      `TURN relay port range: ${appConfig.turnConfig.minPort}-${appConfig.turnConfig.maxPort}`
    )
  } else {
    console.log(`TURN server is disabled (enable in config.json)`)
    console.log(`Using STUN-only configuration for WebRTC`)
  }
})

const wsServer = new WebSocket.Server({ server })

const SEND_TYPE_REG = "1001" // 注册后发送用户id
const SEND_TYPE_ROOM_INFO = "1002" // 发送房间信息
const SEND_TYPE_JOINED_ROOM = "1003" // 加入房间后的通知，比如对于新进用户，Ta需要开始连接其他人
const SEND_TYPE_NEW_CANDIDATE = "1004" // offer
const SEND_TYPE_NEW_CONNECTION = "1005" // new connection
const SEND_TYPE_CONNECTED = "1006" // new connection
const SEND_TYPE_NICKNAME_UPDATED = "1007" // 昵称更新通知

const RECEIVE_TYPE_NEW_CANDIDATE = "9001" // offer
const RECEIVE_TYPE_NEW_CONNECTION = "9002" // new connection
const RECEIVE_TYPE_CONNECTED = "9003" // joined
const RECEIVE_TYPE_KEEPALIVE = "9999" // keep-alive
const RECEIVE_TYPE_UPDATE_NICKNAME = "9004" // 更新昵称请求

// 处理房间配置
let roomPwd = {}
if (appConfig.rooms && appConfig.rooms.length > 0) {
  let roomIds = []
  appConfig.rooms.forEach((item) => {
    roomIds.push(item.roomId)
    // 统一使用内置TURN服务器
    roomPwd[item.roomId] = { pwd: item.pwd, turns: null }
  })
  console.log(`加载房间数据: ${roomIds.join(",")}`)
}

wsServer.on("connection", (socket, request) => {
  const ip =
    request.headers["x-forwarded-for"] ??
    request.headers["x-real-ip"] ??
    socket._socket.remoteAddress.split("::ffff:").join("")
  const urlWithPath = request.url.replace(/^\//g, "").split("/")
  let roomId = null
  let pwd = null
  if (
    urlWithPath.length > 1 &&
    urlWithPath[1].length > 0 &&
    urlWithPath[1].length <= 32
  ) {
    roomId = urlWithPath[1].trim()
  }
  if (
    urlWithPath.length > 2 &&
    urlWithPath[2].length > 0 &&
    urlWithPath[2].length <= 32
  ) {
    pwd = urlWithPath[2].trim()
  }
  if (roomId === "ws") {
    // 兼容旧版本
    roomId = null
  }
  if (roomId === "") {
    roomId = null
  }

  // 根据TURN服务状态为用户提供配置
  let builtinTurns = []
  if (appConfig.turnConfig.enabled) {
    builtinTurns = [
      {
        urls: [
          `turn:${
            request.headers.host?.split(":")[0] || "localhost"
          }:${TURN_PORT}`,
        ],
        username: turnUsername,
        credential: turnPassword,
      },
    ]
  }

  if (roomId) {
    if (
      !pwd ||
      !roomPwd[roomId] ||
      roomPwd[roomId].pwd.toLowerCase() !== pwd.toLowerCase()
    ) {
      roomId = null
    }
  }

  const currentId = service.registerUser(ip, roomId, socket)
  // 向客户端发送自己的id和内置TURN配置
  socketSend_UserId(socket, currentId, roomId, builtinTurns)

  console.log(`${currentId}@${ip}${roomId ? "/" + roomId : ""} connected`)

  service.getUserList(ip, roomId).forEach((user) => {
    socketSend_RoomInfo(user.socket, ip, roomId)
  })

  socketSend_JoinedRoom(socket, currentId)

  socket.on("message", (msg, isBinary) => {
    const msgStr = msg.toString()
    if (!msgStr || msgStr.length > 1024 * 10) {
      return
    }
    let message = null
    try {
      message = JSON.parse(msgStr)
    } catch (e) {
      console.error("Invalid JSON", msgStr)
      message = null
    }

    const { uid, targetId, type, data } = message
    if (!type || !uid || !targetId) {
      return null
    }
    const me = service.getUser(ip, roomId, uid)
    const target = service.getUser(ip, roomId, targetId)
    if (!me || !target) {
      return
    }

    if (type === RECEIVE_TYPE_NEW_CANDIDATE) {
      socketSend_Candidate(target.socket, {
        targetId: uid,
        candidate: data.candidate,
      })
      return
    }
    if (type === RECEIVE_TYPE_NEW_CONNECTION) {
      socketSend_ConnectInvite(target.socket, {
        targetId: uid,
        offer: data.targetAddr,
      })
      return
    }
    if (type === RECEIVE_TYPE_CONNECTED) {
      socketSend_Connected(target.socket, {
        targetId: uid,
        answer: data.targetAddr,
      })
      return
    }
    if (type === RECEIVE_TYPE_KEEPALIVE) {
      return
    }
    if (type === RECEIVE_TYPE_UPDATE_NICKNAME) {
      const success = service.updateNickname(ip, roomId, uid, data.nickname)
      if (success) {
        // 通知所有用户昵称更新
        service.getUserList(ip, roomId).forEach((user) => {
          socketSend_NicknameUpdated(user.socket, {
            id: uid,
            nickname: data.nickname,
          })
        })
      }
      return
    }
  })

  socket.on("close", () => {
    service.unregisterUser(ip, roomId, currentId)
    service.getUserList(ip, roomId).forEach((user) => {
      socketSend_RoomInfo(user.socket, ip, roomId)
    })
    console.log(`${currentId}@${ip}${roomId ? "/" + roomId : ""} disconnected`)
  })

  socket.on("error", () => {
    service.unregisterUser(ip, roomId, currentId)
    service.getUserList(ip, roomId).forEach((user) => {
      socketSend_RoomInfo(user.socket, ip, roomId)
    })
    console.log(`${currentId}@${ip}${roomId ? "/" + roomId : ""} disconnected`)
  })
})

function send(socket, type, data) {
  socket.send(JSON.stringify({ type, data }))
}

function socketSend_UserId(socket, id, roomId, turns) {
  send(socket, SEND_TYPE_REG, { id, roomId, turns })
}
function socketSend_RoomInfo(socket, ip, roomId) {
  const result = service.getUserList(ip, roomId).map((user) => ({
    id: user.id,
    nickname: user.nickname,
  }))
  send(socket, SEND_TYPE_ROOM_INFO, result)
}
function socketSend_JoinedRoom(socket, id) {
  send(socket, SEND_TYPE_JOINED_ROOM, { id })
}

function socketSend_Candidate(socket, data) {
  send(socket, SEND_TYPE_NEW_CANDIDATE, data)
}

function socketSend_ConnectInvite(socket, data) {
  send(socket, SEND_TYPE_NEW_CONNECTION, data)
}

function socketSend_Connected(socket, data) {
  send(socket, SEND_TYPE_CONNECTED, data)
}

function socketSend_NicknameUpdated(socket, data) {
  send(socket, SEND_TYPE_NICKNAME_UPDATED, data)
}
