const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");

const io = new Server(server, {
  cors: { origin: "*" }
});

app.get("/", (req, res) => {
  res.send("Server Multiplayer Aktif 🚀");
});

io.on("connection", (socket) => {
  console.log("Player masuk:", socket.id);

  socket.on("move", (data) => {
    socket.broadcast.emit("playerMove", {
      id: socket.id,
      x: data.x,
      y: data.y
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server jalan di port", PORT);
});
  
