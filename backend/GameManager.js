const Room = require('./Room');

class GameManager {
    constructor(io) {
        this.io = io;
        this.rooms = new Map();
    }

    initialize() {
        this.io.on('connection', (socket) => {
            console.log(`[Socket] Connected: ${socket.id}`);

            // --- TÍNH NĂNG MỚI: TẠO PHÒNG CÀY CUỐC SOLO ---
            socket.on('quick_practice', (data, callback) => {
                const roomId = 'PRAC_' + Math.floor(Math.random() * 10000);
                
                // Server tự đóng vai trò Host (SERVER_BOT)
                const newRoom = new Room(roomId, this.io, 'SERVER_BOT');
                newRoom.mode = 'SOLO';
                this.rooms.set(roomId, newRoom);
                socket.join(roomId);
                
                // Đăng ký cho người chơi vào thẳng phòng ảo
                newRoom.addPlayer(socket.id, data.playerId, data.playerName, '🐺');
                
                // Ép chia đội (1 người tự làm leader) và bắt đầu game ngay
                newRoom.assignTeams();
                
                console.log(`[Room] Auto-Created Solo Match: ${roomId} for ${data.playerName}`);
                callback({ success: true, roomId });
            });
            // ---------------------------------------------

            socket.on('create_room', (data, callback) => {
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                let roomId = '';
                for(let i=0; i<6; i++) roomId += chars[Math.floor(Math.random() * chars.length)];
                const newRoom = new Room(roomId, this.io, socket.id);
                this.rooms.set(roomId, newRoom);
                socket.join(roomId);
                
                console.log(`[Room] Created: ${roomId} by Host ${socket.id}`);
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
                console.log(`[Socket] Disconnected: ${socket.id}`);
                const roomArray = Array.from(this.rooms.values());
                const playerRoom = roomArray.find(r => Array.from(r.players.values()).some(p => p.socketId === socket.id));
                
                if (playerRoom) {
                    playerRoom.removePlayer(socket.id);

                    // --- TÍNH NĂNG MỚI: DỌN RÁC PHÒNG SOLO KHI KHÁCH THOÁT WEB ---
                    if (playerRoom.mode === 'SOLO') {
                        setTimeout(() => {
                            // Kiểm tra lại xem có ai còn đang kết nối trong phòng này không
                            const stillHere = Array.from(playerRoom.players.values()).some(p => p.connected);
                            if (!stillHere) {
                                console.log(`[Room] Xóa phòng Solo (khách đã thoát): ${playerRoom.id}`);
                                this.rooms.delete(playerRoom.id);
                            }
                        }, 5000); // Trì hoãn 5s đề phòng người chơi F5 tải lại trang
                    }
                    // -----------------------------------------------------------
                }

                this.rooms.forEach(room => {
                    if (room.hostId === socket.id) {
                        room.hostConnected = false;
                        setTimeout(() => {
                            if (!room.hostConnected) {
                                console.log(`[Room] Destroyed (Host left): ${room.id}`);
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