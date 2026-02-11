const express = require('express');
const app = express();
const http = require('http'); // Import http module
const server = http.createServer(app); // Create HTTP server
const { Server } = require('socket.io'); // Import Server from socket.io
const io = new Server(server); // Initialize socket.io
const port = 3000;
const db = require('./database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Middleware to parse JSON bodies
app.use(express.json());

// Secret key for JWT
const JWT_SECRET = 'your_jwt_secret_key'; // In a real app, use environment variables

// Middleware to authenticate token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401); // No token

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); // Token no longer valid
        req.user = user;
        next();
    });
};

db.serialize(() => {
    console.log('Database initialization checked.');
});

// User Registration
app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).send('Username and password are required');
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], function(err) {
            if (err) {
                console.error(err.message);
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).send('Username already exists');
                }
                return res.status(500).send('Error registering user');
            }
            res.status(201).send(`User registered with ID: ${this.lastID}`);
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});

// User Login
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).send('Username and password are required');
    }

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Server error');
        }
        if (!user) {
            return res.status(400).send('Invalid username or password');
        }

        try {
            if (await bcrypt.compare(password, user.password)) {
                const accessToken = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
                res.json({ accessToken: accessToken });
            } else {
                res.status(400).send('Invalid username or password');
            }
        } catch (error) {
            console.error(error);
            res.status(500).send('Server error');
        }
    });
});

// --- Bulletin Board API ---

// Create a new post
app.post('/posts', authenticateToken, (req, res) => {
    const { title, content, category } = req.body;
    const user_id = req.user.id; // From authenticated token

    if (!title || !content) {
        return res.status(400).send('Title and content are required for a post.');
    }

    db.run('INSERT INTO posts (user_id, title, content, category) VALUES (?, ?, ?, ?)',
        [user_id, title, content, category], function(err) {
            if (err) {
                console.error(err.message);
                return res.status(500).send('Error creating post.');
            }
            res.status(201).json({ id: this.lastID, user_id, title, content, category, created_at: new Date().toISOString() });
        }
    );
});

// Get all posts
app.get('/posts', (req, res) => {
    db.all('SELECT posts.*, users.username FROM posts JOIN users ON posts.user_id = users.id ORDER BY created_at DESC', [], (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Error retrieving posts.');
        }
        res.json(rows);
    });
});

// Get a single post by ID
app.get('/posts/:id', (req, res) => {
    const { id } = req.params;
    db.get('SELECT posts.*, users.username FROM posts JOIN users ON posts.user_id = users.id WHERE posts.id = ?', [id], (err, row) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Error retrieving post.');
        }
        if (!row) {
            return res.status(404).send('Post not found.');
        }
        res.json(row);
    });
});

// Update a post
app.put('/posts/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { title, content, category } = req.body;
    const user_id = req.user.id;

    if (!title || !content) {
        return res.status(400).send('Title and content are required.');
    }

    db.run('UPDATE posts SET title = ?, content = ?, category = ? WHERE id = ? AND user_id = ?',
        [title, content, category, id, user_id], function(err) {
            if (err) {
                console.error(err.message);
                return res.status(500).send('Error updating post.');
            }
            if (this.changes === 0) {
                return res.status(404).send('Post not found or you do not have permission to update it.');
            }
            res.send('Post updated successfully.');
        }
    );
});

// Delete a post
app.delete('/posts/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const user_id = req.user.id;

    db.run('DELETE FROM posts WHERE id = ? AND user_id = ?', [id, user_id], function(err) {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Error deleting post.');
        }
        if (this.changes === 0) {
            return res.status(404).send('Post not found or you do not have permission to delete it.');
        }
        res.send('Post deleted successfully.');
    });
});

// --- Chat functionality with Socket.io ---

const connectedUsers = {}; // Map to store connected users: { userId: socket.id }

io.on('connection', (socket) => {
    console.log('A user connected');

    // Authenticate user for WebSocket connection
    socket.on('authenticate', (token) => {
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) {
                socket.emit('auth_error', 'Authentication failed');
                socket.disconnect();
                return;
            }
            socket.user = user; // Attach user info to socket
            connectedUsers[user.id] = socket.id; // Store user's socket ID
            socket.emit('authenticated');
            console.log(`User ${user.username} authenticated and connected.`);
            // Optionally, emit user presence to others
        });
    });

    socket.on('disconnect', () => {
        if (socket.user) {
            delete connectedUsers[socket.user.id]; // Remove user from connected list
            console.log(`User ${socket.user.username} disconnected.`);
            // Optionally, emit user absence to others
        }
        console.log('User disconnected');
    });

    // Handle private messages
    socket.on('private_message', ({ receiverUsername, message }) => {
        if (!socket.user) {
            socket.emit('chat_error', 'Unauthorized');
            return;
        }

        db.get('SELECT id FROM users WHERE username = ?', [receiverUsername], (err, receiver) => {
            if (err || !receiver) {
                socket.emit('chat_error', 'Receiver not found');
                return;
            }

            const receiverId = receiver.id;
            const senderId = socket.user.id;

            // Store message in DB
            db.run('INSERT INTO chat_messages (sender_id, receiver_id, message) VALUES (?, ?, ?)',
                [senderId, receiverId, message], function(err) {
                    if (err) {
                        console.error('Error saving chat message:', err.message);
                        socket.emit('chat_error', 'Error saving message');
                        return;
                    }

                    // Emit message to sender
                    socket.emit('message', {
                        senderId: senderId,
                        receiverId: receiverId,
                        message: message,
                        timestamp: new Date().toISOString()
                    });

                    // Emit message to receiver if connected
                    const receiverSocketId = connectedUsers[receiverId];
                    if (receiverSocketId) {
                        io.to(receiverSocketId).emit('message', {
                            senderId: senderId,
                            receiverId: receiverId,
                            message: message,
                            timestamp: new Date().toISOString()
                        });
                    } else {
                        console.log(`Receiver ${receiverUsername} is offline.`);
                        // Optionally, save message as unread or send push notification
                    }
                }
            );
        });
    });

    // Handle fetching previous messages between two users
    socket.on('fetch_messages', ({ otherUserId }) => {
        if (!socket.user) {
            socket.emit('chat_error', 'Unauthorized');
            return;
        }
        const userId = socket.user.id;
        db.all(
            `SELECT
                cm.message,
                cm.created_at,
                s.username AS sender_username,
                r.username AS receiver_username
            FROM chat_messages cm
            JOIN users s ON cm.sender_id = s.id
            JOIN users r ON cm.receiver_id = r.id
            WHERE (cm.sender_id = ? AND cm.receiver_id = ?)
            OR (cm.sender_id = ? AND cm.receiver_id = ?)
            ORDER BY cm.created_at ASC`,
            [userId, otherUserId, otherUserId, userId],
            (err, rows) => {
                if (err) {
                    console.error('Error fetching chat messages:', err.message);
                    socket.emit('chat_error', 'Error fetching messages');
                    return;
                }
                socket.emit('previous_messages', rows);
            }
        );
    });

});


// Get all users (for chat user list) - accessible without authentication for simplicity in this prototype
app.get('/users', (req, res) => {
    db.all('SELECT id, username FROM users', [], (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Error retrieving users.');
        }
        res.json(rows);
    });
});

app.get('/', (req, res) => {
  res.send('Hello from the backend!');
});

// Example of a protected route
app.get('/protected', authenticateToken, (req, res) => {
    res.send(`Welcome, ${req.user.username}! This is a protected route.`);
});


server.listen(port, () => { // Changed app.listen to server.listen
  console.log(`Backend server listening at http://localhost:${port}`);
});