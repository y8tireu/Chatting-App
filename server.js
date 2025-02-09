// server.js
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const users = {}; // Mapping of username -> socket.id

// Serve static files from the "public" folder
app.use(express.static('public'));

// When a client connects...
io.on('connection', (socket) => {
  console.log('A user connected');

  // Save the username when the client sends it.
  socket.on('set username', (username) => {
    socket.username = username;
    users[username] = socket.id;
    console.log(`User set username: ${username}`);
  });

  // Global message: broadcast to everyone
  socket.on('chat message', (msgObj) => {
    // msgObj should have { username, message }
    io.emit('chat message', msgObj);
  });

  // Private message: send only to the specified friend
  socket.on('private message', (msgObj) => {
    // msgObj should have { to, from, message }
    const targetSocketId = users[msgObj.to];
    if (targetSocketId) {
      io.to(targetSocketId).emit('private message', msgObj);
      // Also send to the sender so they can see their outgoing message.
      socket.emit('private message', msgObj);
    } else {
      // Notify sender if the friend is not online
      socket.emit('system message', { message: `User "${msgObj.to}" is not online.` });
    }
  });

  // On disconnect, remove the username mapping.
  socket.on('disconnect', () => {
    console.log('User disconnected');
    if (socket.username) {
      delete users[socket.username];
    }
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
