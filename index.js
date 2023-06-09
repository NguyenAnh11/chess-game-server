require('dotenv').config({ path: '.env' })
const http = require('http')
const express = require('express')
const { Server } = require('socket.io')
const { room } = require('./handlers/room')

const app = express()
app.use(express.json())
const server = http.createServer(app)
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
})

io.on('connection', (socket) => {
    console.log('Connected')
    room(socket)
    socket.on('diconected', () => {
        console.log('Disconnected')
    })
})

server.listen(process.env.PORT, () => {
    console.log('Running....')
})

