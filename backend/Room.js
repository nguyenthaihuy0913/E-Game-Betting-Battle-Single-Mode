class Room {
    constructor(id, io, hostId) {
        this.id = id;
        this.io = io;
        this.hostId = hostId;
        this.players = new Map();
        this.teams = new Map(); 
        this.state = 'LOBBY'; 
        
        this.round = 1; 
        this.currentQuestionIdx = 0; // Bộ đếm tiến độ
        this.timer = null;
        this.stateStartTime = null;
        
        // --- ĐÃ CẬP NHẬT 30 CÂU MCQ VÀ 20 CÂU GAP FILL ---
        this.TOTAL_MCQ = 30;
        this.TOTAL_GAP = 20;
        this.TIME_BET = 15;
        this.TIME_QUESTION = 30;
        this.TIME_FORM = 60;

        try {
            const data = require('../frontend/src/data/questions.json');
            this.mcqSequence = this.shuffleArray([...Array(data.multiple_choice.length).keys()]);
            this.gapSequence = this.shuffleArray([...Array(data.gap_fill.length).keys()]);
        } catch(e) {
            console.error("Lỗi đọc file JSON khi xáo trộn:", e.message);
            this.mcqSequence = this.shuffleArray([...Array(this.TOTAL_MCQ).keys()]);
            this.gapSequence = this.shuffleArray([...Array(this.TOTAL_GAP).keys()]);
        }
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    addPlayer(socketId, playerId, name, avatar) {
        if (this.state !== 'LOBBY' && !this.players.has(playerId)) return { error: 'Game already started' };
        
        if (this.players.has(playerId)) {
            const p = this.players.get(playerId);
            p.socketId = socketId;
            p.avatar = avatar || p.avatar; 
            p.connected = true;
            this.broadcastState();
            return { success: true, player: p };
        }
        
        const player = { socketId: socketId, id: playerId, name: name, avatar: avatar || '👻', team: null, isLeader: false, connected: true };
        this.players.set(playerId, player);
        this.broadcastState();
        return { success: true, player };
    }

    removePlayer(socketId) {
        const p = Array.from(this.players.values()).find(p => p.socketId === socketId);
        if (p) {
            p.connected = false;
            if (this.state === 'LOBBY') {
                this.players.delete(p.id);
            }
            this.broadcastState();
        }
    }

    handleHostAction(action, payload) {
        switch(action) {
            case 'START_MATCHMAKING': 
                this.mode = (payload && payload.mode) ? payload.mode : 'TEAM';
                this.assignTeams(); 
                break;
            case 'FORCE_START_GAME': 
                if(this.timer) clearTimeout(this.timer);
                this.startRound();
                break;
            case 'NEXT_QUESTION': this.nextQuestion(); break;
        }
    }

    handlePlayerAction(socketId, action, payload) {
        const player = Array.from(this.players.values()).find(p => p.socketId === socketId);
        if (!player) return;

        switch (action) {
            case 'SUBMIT_BET':
                if (this.state === 'BETTING' && player.isLeader) {
                    const team = this.teams.get(player.team);
                    if (team && !team.hasBet) {
                        let rawBet = (payload && payload.bet !== undefined) ? payload.bet : payload;
                        const betAmount = parseInt(rawBet, 10);
                        
                        team.currentBet = Math.min(isNaN(betAmount) ? 0 : betAmount, team.score); 
                        team.hasBet = true;
                        this.broadcastState();
                        this.checkAllBetsIn();
                    }
                }
                break;
            
            case 'SUBMIT_ANSWER':
                if (this.state === 'QUESTION') {
                    const team = this.teams.get(player.team);
                    if (team && !team.hasAnswered) {
                        team.hasAnswered = true;
                        team.timeTaken = Date.now() - this.stateStartTime;
                        team.lastAnswer = payload.answer;
                        
                        team.members.forEach(m => {
                            if(m.id !== player.id) {
                                this.io.to(m.socketId).emit('team_answered', { submittor: player.name });
                            }
                        });
                        this.broadcastState();
                        this.checkAllAnswersIn();
                    }
                }
                break;

            case 'CHEAT_ALERT':
                this.io.to(this.id).emit('cheat_alert', {
                    playerName: player.name,
                    team: player.team,
                    reason: payload.reason,
                    time: Date.now()
                });
                break;
            
            case 'USE_ITEM': 
                // Có thể xóa nhưng cứ để ngầm, client đã xóa file items.js nên không ai gọi lên được nữa
                this.io.to(this.id).emit('item_used', { team: player.team, item: payload.item, target: payload.target });
                break;
        }
    }

    assignTeams() {
        const pArray = Array.from(this.players.values());
        pArray.sort(() => Math.random() - 0.5);
        
        if (this.mode === 'SOLO') {
            for (let i = 0; i < pArray.length; i++) {
                const teamNum = i + 1;
                this.teams.set(teamNum, { id: teamNum, score: 50, currentBet: 0, hasBet: false, hasAnswered: false, timeTaken: 0, lastAnswer: null, members: [] });
                const p = pArray[i];
                p.team = teamNum;
                p.isLeader = true; 
                this.teams.get(teamNum).members.push(p);
            }
        } else {
            const NUM_TEAMS = Math.min(7, Math.max(2, pArray.length || 2)); 
            for (let i = 1; i <= NUM_TEAMS; i++) {
                this.teams.set(i, { id: i, score: 50, currentBet: 0, hasBet: false, hasAnswered: false, timeTaken: 0, lastAnswer: null, members: [] });
            }
            pArray.forEach((p, idx) => {
                const teamNum = (idx % NUM_TEAMS) + 1;
                p.team = teamNum;
                this.teams.get(teamNum).members.push(p);
            });
            this.teams.forEach(t => {
                if (t.members.length > 0) {
                    const leaderIdx = Math.floor(Math.random() * t.members.length);
                    t.members[leaderIdx].isLeader = true;
                }
            });
        }

        this.state = 'TEAM_FORMATION';
        this.broadcastState();
        this.startTimer(this.mode === 'SOLO' ? 1 : this.TIME_FORM, () => this.startRound());
    }

    startRound() {
        this.teams.forEach(t => {
            t.hasAnswered = false; t.timeTaken = 0; t.lastAnswer = null; t.hasBet = false; t.currentBet = 0;
        });
        this.state = 'BETTING';
        this.broadcastState();
        this.startTimer(this.TIME_BET, () => {
            this.teams.forEach(t => {
                if(!t.hasBet) { t.currentBet = t.score; t.hasBet = true; }
            });
            this.startQuestion();
        });
    }

    checkAllBetsIn() {
        let allIn = true;
        this.teams.forEach(t => { if(t.members.length > 0 && !t.hasBet) allIn = false; });
        if(allIn) { clearTimeout(this.timer); this.startQuestion(); }
    }

    startQuestion() {
        this.state = 'QUESTION';
        this.stateStartTime = Date.now();
        this.broadcastState();
        this.startTimer(this.TIME_QUESTION, () => { this.evaluateRound(); });
    }

    checkAllAnswersIn() {
        let allIn = true;
        this.teams.forEach(t => { if(t.members.length > 0 && !t.hasAnswered) allIn = false; });
        if(allIn) { clearTimeout(this.timer); this.evaluateRound(); }
    }

    evaluateRound() {
        this.state = 'ROUND_RESULT';
        const multipliers = [2.0, 1.8, 1.6, 1.5, 1.4, 1.3, 1.2];
        
        let actualIdx = this.round === 1 ? this.mcqSequence[this.currentQuestionIdx] : this.gapSequence[this.currentQuestionIdx];
        
        let correctAnswerText = "mock_correct";
        try {
            const data = require('../frontend/src/data/questions.json');
            if (this.round === 1) {
                const q = data.multiple_choice[actualIdx]; 
                correctAnswerText = q.correct_answer_text.replace(/^[A-D][.\s]+/, '').trim().toLowerCase();
            } else {
                const q = data.gap_fill[actualIdx]; 
                correctAnswerText = q.correct_answer.trim().toLowerCase();
            }
        } catch(e) {
            console.error("Lỗi đọc JSON đáp án:", e.message);
        }

        const activeTeams = Array.from(this.teams.values()).filter(t => t.members.length > 0);
        
        const answeringTeams = activeTeams.filter(t => {
            if (!t.hasAnswered || !t.lastAnswer) return false;
            const submitted = t.lastAnswer.trim().toLowerCase();
            return submitted === correctAnswerText || submitted === "mock_correct";
        });
        
        answeringTeams.sort((a,b) => a.timeTaken - b.timeTaken);

        answeringTeams.forEach((t, idx) => {
            const multi = multipliers[Math.min(idx, multipliers.length - 1)];
            const bonus = Math.floor(t.currentBet * multi);
            t.score += bonus; 
        });

        this.broadcastState();
        this.startTimer(5, () => this.nextQuestion()); 
    }

    nextQuestion() {
        this.currentQuestionIdx++;
        const totalQ = this.round === 1 ? this.TOTAL_MCQ : this.TOTAL_GAP;
        
        if (this.currentQuestionIdx >= totalQ) {
           if (this.round === 1) {
               this.round = 2; 
               this.currentQuestionIdx = 0; 
               this.state = 'ROUND_TRANSITION'; 
               this.broadcastState();
               
               setTimeout(() => {
                   this.startRound();
               }, 3000); 
               
           } else {
               this.state = 'ENDGAME'; 
               this.broadcastState();
           }
        } else {
           this.startRound();
        }
    }

    startTimer(seconds, callback) {
        if(this.timer) clearTimeout(this.timer);
        this.io.to(this.id).emit('timer_sync', { seconds, phase: this.state });
        this.timer = setTimeout(callback, seconds * 1000);
    }

    broadcastState() {
        let actualIdx = 0;
        if (this.round === 1 && this.mcqSequence) actualIdx = this.mcqSequence[this.currentQuestionIdx];
        if (this.round === 2 && this.gapSequence) actualIdx = this.gapSequence[this.currentQuestionIdx];

        const statePayload = {
            state: this.state,
            players: Array.from(this.players.values()),
            teams: Array.from(this.teams.values()).map(t => {
                return {
                    id: t.id, score: t.score, currentBet: t.currentBet, hasBet: t.hasBet,
                    hasAnswered: t.hasAnswered, memberCount: t.members.length,
                    leaderId: t.members.find(m => m.isLeader)?.id,
                    lastAnswer: this.state === 'ROUND_RESULT' ? t.lastAnswer : null 
                };
            }),
            round: this.round, 
            mode: this.mode, 
            currentQuestionIdx: actualIdx,
            progressIdx: this.currentQuestionIdx,
            hostId: this.hostId
        };
        this.io.to(this.id).emit('game_state', statePayload);
    }
}
module.exports = Room;