const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));

// Game state
let players = {};
let bullets = [];
let bulletIdCounter = 0;

// Generate random color
function getRandomColor() {
    const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Handle player joining
    socket.on('joinGame', (data) => {
        const playerName = data.name || 'Player';
        
        players[socket.id] = {
            id: socket.id,
            name: playerName,
            x: Math.random() * 800 + 100,
            y: Math.random() * 400 + 100,
            angle: 0,
            color: getRandomColor(),
            score: 0
        };

        // Send current players to new player
        socket.emit('currentPlayers', players);
        
        // Send new player's ID
        socket.emit('currentPlayer', socket.id);

        // Notify all other players about new player
        socket.broadcast.emit('newPlayer', players[socket.id]);

        console.log(`Player ${playerName} (${socket.id}) joined the game`);
        console.log(`Total players: ${Object.keys(players).length}`);
    });

    // Handle player movement
    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            players[socket.id].angle = movementData.angle;

            // Broadcast to all other players
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // Handle shooting
    socket.on('shoot', (shootData) => {
        if (players[socket.id]) {
            const bullet = {
                id: bulletIdCounter++,
                playerId: socket.id,
                x: shootData.x,
                y: shootData.y,
                angle: shootData.angle,
                createdAt: Date.now()
            };

            bullets.push(bullet);

            // Broadcast bullet to all players
            io.emit('bulletFired', bullet);

            console.log(`Player ${socket.id} fired a bullet`);
        }
    });

    // Handle player disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        if (players[socket.id]) {
            delete players[socket.id];
            
            // Notify all players
            io.emit('playerDisconnected', socket.id);
            
            console.log(`Total players: ${Object.keys(players).length}`);
        }
    });
});

// Game loop for server-side logic
setInterval(() => {
    // Update bullets
    const now = Date.now();
    bullets = bullets.filter(bullet => {
        // Remove bullets older than 5 seconds
        if (now - bullet.createdAt > 5000) {
            io.emit('bulletRemoved', bullet.id);
            return false;
        }

        // Check collision with players
        for (let playerId in players) {
            if (playerId !== bullet.playerId) {
                const player = players[playerId];
                const dx = player.x - bullet.x;
                const dy = player.y - bullet.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // Collision detected
                if (distance < 25) {
                    // Increase shooter's score
                    if (players[bullet.playerId]) {
                        players[bullet.playerId].score += 10;
                        
                        // Notify the shooter
                        io.to(bullet.playerId).emit('playerHit', {
                            playerId: bullet.playerId,
                            score: players[bullet.playerId].score,
                            hitPlayer: playerId,
                            x: bullet.x,
                            y: bullet.y
                        });
                    }

                    // Respawn hit player
                    player.x = Math.random() * 800 + 100;
                    player.y = Math.random() * 400 + 100;
                    
                    // Notify all players about position change
                    io.emit('playerMoved', player);

                    // Remove bullet
                    io.emit('bulletRemoved', bullet.id);
                    return false;
                }
            }
        }

        return true;
    });
}, 50); // Run every 50ms

// Start server
server.listen(PORT, () => {
    console.log('=================================');
    console.log(`🎮 Multiplayer Game Server`);
    console.log(`🚀 Server running on port ${PORT}`);
    console.log('=================================');
});

// Handle server errors
server.on('error', (error) => {
    console.error('Server error:', error);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
    });
});
