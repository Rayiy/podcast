const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));
app.use(express.json());

// 🟢 核心功能 1：解析小宇宙链接
app.post('/api/parse', async (req, res) => {
    const { url } = req.body;
    try {
        // 伪装 User-Agent 防止被拦截
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36' }
        });
        
        const $ = cheerio.load(data);
        
        // 小宇宙通常把音频链接放在 meta 标签里 (og:audio)
        const audioUrl = $('meta[property="og:audio"]').attr('content');
        const title = $('meta[property="og:title"]').attr('content');
        const cover = $('meta[property="og:image"]').attr('content');

        if (audioUrl) {
            res.json({ success: true, audioUrl, title, cover });
        } else {
            res.status(400).json({ success: false, message: '未找到音频，请确认链接正确' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: '解析失败' });
    }
});

// 🟢 核心功能 2：WebSocket 同步
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // 加入房间（简单起见，所有人都在同一个默认房间 'room1'）
    socket.join('room1');

    // 当有人加载了新播客，通知所有人
    socket.on('new_track', (trackData) => {
        io.to('room1').emit('sync_track', trackData);
    });

    // 当有人播放/暂停/拖动，广播给其他人 (除了自己)
    socket.on('player_action', (data) => {
        // data 包含: type (play/pause/seek), time (当前时间)
        socket.to('room1').emit('sync_action', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

server.listen(3000, () => {
    console.log('listening on *:3000');
});