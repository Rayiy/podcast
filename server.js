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

// 💾 【关键修改】服务器端的“记忆变量”
// 用来存当前正在播哪首歌，以及最后一次的状态
let currentTrackInfo = null; 

// 解析小宇宙链接的接口
app.post('/api/parse', async (req, res) => {
    const { url } = req.body;
    try {
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36' }
        });
        
        const $ = cheerio.load(data);
        const audioUrl = $('meta[property="og:audio"]').attr('content');
        const title = $('meta[property="og:title"]').attr('content');
        const cover = $('meta[property="og:image"]').attr('content');

        if (audioUrl) {
            res.json({ success: true, audioUrl, title, cover });
        } else {
            res.status(400).json({ success: false, message: '未找到音频' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: '解析失败' });
    }
});

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    socket.join('room1');

    // ✨ 【关键修改】新用户进来时，如果有正在播的歌，立刻告诉她
    if (currentTrackInfo) {
        // 只发给这个新来的用户 (socket.emit)
        socket.emit('sync_track', currentTrackInfo);
    }

    // 当有人切歌时
    socket.on('new_track', (trackData) => {
        // 1. 服务器记住这首歌
        currentTrackInfo = trackData;
        // 2. 广播给所有人
        io.to('room1').emit('sync_track', trackData);
    });

    // 当有人播放/暂停/拖动
    socket.on('player_action', (data) => {
        // 广播给其他人
        socket.to('room1').emit('sync_action', data);
    });

    // ✨ 【进阶逻辑】新用户进来时，可以向房间里的其他人询问：“现在播到几分几秒了？”
    // 这一步为了简化逻辑暂时先不做，目前新用户进来会从 00:00 开始，
    // 你只需要点击一下暂停再播放，她就会自动跳转到你的进度了。

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

server.listen(3000, () => {
    console.log('listening on *:3000');
});