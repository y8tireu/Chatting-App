// server.js
const express = require('express');
const path = require('path'); // Needed to work with file paths
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// Serve the index.html file from the root directory
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Object to store connected users (username -> socket.id)
const users = {};

// Socket.io event handling
io.on('connection', (socket) => {
  console.log('A user connected');

  // Set the username for this socket
  socket.on('set username', (username) => {
    socket.username = username;
    users[username] = socket.id;
    console.log(`User set username: ${username}`);
  });

  // Global chat message
  socket.on('chat message', (msgObj) => {
    // Broadcast to everyone
    io.emit('chat message', msgObj);
  });

  // Private chat message
  socket.on('private message', (msgObj) => {
    // msgObj should have { to, from, message }
    const targetSocketId = users[msgObj.to];
    if (targetSocketId) {
      io.to(targetSocketId).emit('private message', msgObj);
      // Also emit back to the sender so they see their own message
      socket.emit('private message', msgObj);
    } else {
      socket.emit('system message', { message: `User "${msgObj.to}" is not online.` });
    }
  });

  // When a user disconnects, remove them from the users list
  socket.on('disconnect', () => {
    console.log('User disconnected');
    if (socket.username) {
      delete users[socket.username];
    }
  });
});

// Listen on the port provided by Railway or default to 3000
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
