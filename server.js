// server.js
const express = require('express');
const path = require('path'); // Needed to construct file paths
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// Serve the index.html file from the root directory
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Socket.io event handling
const users = {}; // Mapping of username -> socket.id

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
    io.emit('chat message', msgObj);
  });

  // Private message: send only to the specified friend
  socket.on('private message', (msgObj) => {
    const targetSocketId = users[msgObj.to];
    if (targetSocketId) {
      io.to(targetSocketId).emit('private message', msgObj);
      // Also send to the sender so they can see their outgoing message.
      socket.emit('private message', msgObj);
    } else {
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
