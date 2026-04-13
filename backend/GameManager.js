const Room = require('./Room');
const fs = require('fs');
const path = require('path');

// Tạo đường dẫn tới file lưu bảng xếp hạng
const leaderboardFile = path.join(__dirname, 'leaderboard.json');
let globalLeaderboard = [];

// Khởi động Server: Đọc dữ liệu điểm cũ (nếu có)
if (fs.existsSync(leaderboardFile)) {
    try {
        globalLeaderboard = JSON.parse(fs.readFileSync(leaderboardFile));
    } catch(e) {
        console.error("Lỗi đọc file Leaderboard:", e);
    }
}

class GameManager {
    constructor(io) {
        this.io = io;
        this.rooms = new Map();
    }

    initialize() {
        this.io.on('connection', (socket) => {
            console.log(`[Socket] Connected: ${socket.id}`);

            // --- TÍNH NĂNG MỚI: BẢNG XẾP HẠNG GLOBAL ---
            // 1. Trả dữ liệu bảng điểm khi có người mới vào trang chủ
            socket.on('get_leaderboard', (callback) => {
                callback(globalLeaderboard);
            });

            // 2. Nhận điểm từ người chơi vừa làm bài xong
            socket.on('save_score', (data) => {
                globalLeaderboard.push({
                    name: data.name,
                    score: data.score,
                    date: new Date().toLocaleDateString('vi-VN') // Lấy ngày giờ VN
                });
                
                // Sắp xếp từ cao xuống thấp và chỉ lấy Top 5
                globalLeaderboard.sort((a, b) => b.score - a.score);
                globalLeaderboard = globalLeaderboard.slice(0, 5);
                
                // Lưu cứng vào file JSON để không bị mất khi rs Server
                fs.writeFileSync(leaderboardFile, JSON.stringify(globalLeaderboard, null, 2));
                
                // Phát loa thông báo cho TẤT CẢ mọi người đang mở trang chủ cập nhật lại bảng
                this.io.emit('leaderboard_updated', globalLeaderboard);
            });
            // -------------------------------------------

            socket.on('quick_practice', (data, callback) => {
                const roomId = 'PRAC_' + Math.floor(Math.random() * 10000);
                const newRoom = new Room(roomId, this.io, 'SERVER_BOT');
                newRoom.mode = 'SOLO';
                this.rooms.set(roomId, newRoom);
                socket.join(roomId);
                newRoom.addPlayer(socket.id, data.playerId, data.playerName, '🐺');
                newRoom.assignTeams();
                console.log(`[Room] Auto-Created Solo Match: ${roomId} for ${data.playerName}`);
                callback({ success: true, roomId });
            });

            socket.on('create_room', (data, callback) => {
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                let roomId = '';
                for(let i=0; i<6; i++) roomId += chars[Math.floor(Math.random() * chars.length)];
                const newRoom = new Room(roomId, this.io, socket.id);
                this.rooms.set(roomId, newRoom);
                socket.join(roomId);
                callback({ success: true, roomId });
            });
            
            socket.on('rebind_host', (data, callback) => {
                const room = this.rooms.get(data.roomId);
                if (room) {
                    room.hostId = socket.id;
                    room.hostConnected = true;
                    socket.join(data.roomId);
                    callback({success: true});
                    room.broadcastState();
                } else {
                    callback({success: false, error: 'Room destroyed'});
                }
            });

            socket.on('join_room', (data, callback) => {
                const { roomId, playerId, playerName, avatar } = data;
                const room = this.rooms.get(roomId);
                if (!room) {
                    return callback({ success: false, error: 'Room not found' });
                }
                socket.join(roomId);
                const res = room.addPlayer(socket.id, playerId, playerName, avatar);
                callback(res);
            });

            socket.on('host_action', (data) => {
                const room = this.rooms.get(data.roomId);
                if (room && room.hostId === socket.id) {
                    room.handleHostAction(data.action, data.payload);
                }
            });
            
            socket.on('player_action', (data) => {
                const room = Array.from(this.rooms.values()).find(r => 
                    Array.from(r.players.values()).some(p => p.socketId === socket.id)
                );
                if (room) {
                    room.handlePlayerAction(socket.id, data.action, data.payload);
                }
            });

            socket.on('disconnect', () => {
                const roomArray = Array.from(this.rooms.values());
                const playerRoom = roomArray.find(r => Array.from(r.players.values()).some(p => p.socketId === socket.id));
                
                if (playerRoom) {
                    playerRoom.removePlayer(socket.id);
                    if (playerRoom.mode === 'SOLO') {
                        setTimeout(() => {
                            const stillHere = Array.from(playerRoom.players.values()).some(p => p.connected);
                            if (!stillHere) {
                                this.rooms.delete(playerRoom.id);
                            }
                        }, 5000); 
                    }
                }

                this.rooms.forEach(room => {
                    if (room.hostId === socket.id) {
                        room.hostConnected = false;
                        setTimeout(() => {
                            if (!room.hostConnected) {
                                this.io.to(room.id).emit('room_closed');
                                this.rooms.delete(room.id);
                            }
                        }, 5000); 
                    }
                });
            });
        });
    }
}
module.exports = GameManager;