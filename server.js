/**
 * server.js
 *
 * An improved chat server using Express and Socket.IO.
 * Now serving static files (including index.html) from the root directory.
 */

require('dotenv').config(); // Load environment variables from a .env file if present
const express = require('express');
const path = require('path');
const http = require('http');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');

// Create Express app
const app = express();

// -----------------------------
// Middleware Configuration
// -----------------------------

// Set secure HTTP headers
app.use(helmet());

// Enable Cross-Origin Resource Sharing
app.use(cors());

// Log HTTP requests (using 'combined' for detailed logs)
app.use(morgan('combined'));

// Rate limiting: Limit each IP to 100 requests per 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

// Serve static files from the root directory
// (Ensure your index.html and other assets are located in the root)
app.use(express.static(__dirname));

// Explicitly serve index.html on the root route (optional but recommended)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// -----------------------------
// Create HTTP & Socket.IO Servers
// -----------------------------

const server = http.createServer(app);

// Initialize Socket.IO with CORS settings (adjust origin for production)
const io = new Server(server, {
  cors: {
    origin: "*", // Adjust this in production for better security
    methods: ["GET", "POST"],
  },
});

// -----------------------------
// Socket.IO Event Handling
// -----------------------------

// Use a Map to track connected users (username -> socket.id)
const users = new Map();

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Set username for the socket
  socket.on('set username', (username) => {
    try {
      if (!username || typeof username !== 'string') {
        socket.emit('system message', { message: 'Invalid username.' });
        return;
      }

      // Check if the username is already taken
      if (users.has(username)) {
        socket.emit('system message', { 
          message: `Username "${username}" is already in use. Please choose another one.` 
        });
        return;
      }

      socket.username = username;
      users.set(username, socket.id);
      console.log(`User set username: ${username} (Socket: ${socket.id})`);
      socket.emit('system message', { message: `Username set to "${username}".` });
    } catch (error) {
      console.error(`Error in 'set username' event: ${error}`);
      socket.emit('system message', { message: 'An error occurred while setting your username.' });
    }
  });

  // Handle global chat messages
  socket.on('chat message', (msgObj) => {
    try {
      if (!msgObj || typeof msgObj !== 'object' || !msgObj.message) {
        socket.emit('system message', { message: 'Invalid chat message format.' });
        return;
      }

      // Auto-assign sender if not provided
      if (!msgObj.from && socket.username) {
        msgObj.from = socket.username;
      }
      console.log(`Global message from ${socket.username || socket.id}: ${msgObj.message}`);
      // Broadcast the message to everyone
      io.emit('chat message', msgObj);
    } catch (error) {
      console.error(`Error in 'chat message' event: ${error}`);
      socket.emit('system message', { message: 'An error occurred while sending your message.' });
    }
  });

  // Handle private messages
  socket.on('private message', (msgObj) => {
    try {
      // Validate message structure
      if (!msgObj || typeof msgObj !== 'object' || !msgObj.to || !msgObj.message) {
        socket.emit('system message', { message: 'Invalid private message format.' });
        return;
      }

      if (!msgObj.from && socket.username) {
        msgObj.from = socket.username;
      }

      const targetSocketId = users.get(msgObj.to);
      if (targetSocketId) {
        // Send the private message to the target user
        io.to(targetSocketId).emit('private message', msgObj);
        // Also send it back to the sender
        socket.emit('private message', msgObj);
        console.log(`Private message from ${msgObj.from} to ${msgObj.to}: ${msgObj.message}`);
      } else {
        socket.emit('system message', { message: `User "${msgObj.to}" is not online.` });
      }
    } catch (error) {
      console.error(`Error in 'private message' event: ${error}`);
      socket.emit('system message', { message: 'An error occurred while sending your private message.' });
    }
  });

  // Handle disconnections
  socket.on('disconnect', (reason) => {
    console.log(`Socket disconnected: ${socket.id} (Reason: ${reason})`);
    if (socket.username) {
      users.delete(socket.username);
      console.log(`Removed user: ${socket.username}`);
    }
  });

  // Optionally catch socket-specific errors
  socket.on('error', (error) => {
    console.error(`Socket error from ${socket.id}: ${error}`);
  });
});

// -----------------------------
// Start Server & Graceful Shutdown
// -----------------------------

// Determine port from environment or default to 3000
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Handle graceful shutdown on termination signals
const shutdown = () => {
  console.log('Shutting down server...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
