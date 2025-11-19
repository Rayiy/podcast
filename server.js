const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));
app.use(express.json());

// 💾 【关键修改】改为存储所有房间的状态
// 格式: { "room-123": { title: "...", audioUrl: "..." }, "room-456": { ... } }
const roomStates = {}; 

app.post('/api/parse', async (req, res) => {
    // ... 这里保持不变 ...
    const { url } = req.body;
    try {
        const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(data);
        const audioUrl = $('meta[property="og:audio"]').attr('content');
        const title = $('meta[property="og:title"]').attr('content');
        const cover = $('meta[property="og:image"]').attr('content');
        if (audioUrl) res.json({ success: true, audioUrl, title, cover });
        else res.status(400).json({ success: false, message: '未找到音频' });
    } catch (error) {
        res.status(500).json({ success: false, message: '解析失败' });
    }
});

io.on('connection', (socket) => {
    // 监听客户端请求加入房间
    socket.on('join_room', (roomId) => {
        socket.join(roomId);
        // 把房间号存在这个 socket 连接对象上，方便后续使用
        socket.data.roomId = roomId; 
        console.log(`User ${socket.id} joined room: ${roomId}`);

        // 如果这个房间之前有播放记录，发送给新加入的人
        if (roomStates[roomId]) {
            socket.emit('sync_track', roomStates[roomId]);
        }
    });

    socket.on('new_track', (trackData) => {
        const roomId = socket.data.roomId; // 获取当前用户的房间号
        if (!roomId) return;

        // 1. 记录该房间的状态
        roomStates[roomId] = trackData;
        // 2. 只广播给该房间的人 (io.to)
        io.to(roomId).emit('sync_track', trackData);
    });

    socket.on('player_action', (data) => {
        const roomId = socket.data.roomId;
        if (!roomId) return;
        // 只广播给同一房间的其他人
        socket.to(roomId).emit('sync_action', data);
    });
});

server.listen(3000, () => {
    console.log('listening on *:3000');
});