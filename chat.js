import { io } from "https://cdn.socket.io/4.3.2/socket.io.esm.min.js";

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');
    const loginForm = document.getElementById('login-form');
    const logoutButton = document.getElementById('logout-button');
    const authStatus = document.getElementById('auth-status');
    const chatSection = document.getElementById('chat-section');
    const userList = document.getElementById('user-list');
    const messagesContainer = document.getElementById('messages-container');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');

    let socket;
    let currentUser = null; // Store current logged-in user's info
    let selectedChatUser = null; // Store the user currently chatting with

    // --- Authentication Functions ---
    const updateAuthUI = () => {
        const token = localStorage.getItem('accessToken');
        if (token) {
            // In a real app, you'd decode the token to get username or make an API call
            // For now, we'll just assume user is logged in if token exists
            authStatus.textContent = 'Logged In';
            chatSection.style.display = 'block';
            registerForm.style.display = 'none';
            loginForm.style.display = 'none';
            logoutButton.style.display = 'block';
            connectWebSocket(token);
        } else {
            authStatus.textContent = 'Logged Out';
            chatSection.style.display = 'none';
            registerForm.style.display = 'block';
            loginForm.style.display = 'block';
            logoutButton.style.display = 'none';
            if (socket) socket.disconnect();
        }
    };

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('register-username').value;
        const password = document.getElementById('register-password').value;

        try {
            const response = await fetch('http://localhost:3000/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const text = await response.text();
            if (response.ok) {
                alert('Registration successful! Please log in.');
                registerForm.reset();
            } else {
                alert(`Registration failed: ${text}`);
            }
        } catch (error) {
            console.error('Error during registration:', error);
            alert('An error occurred during registration.');
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        try {
            const response = await fetch('http://localhost:3000/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (response.ok && data.accessToken) {
                localStorage.setItem('accessToken', data.accessToken);
                // Decode JWT to get user info (simplified for client-side)
                const base64Url = data.accessToken.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));
                currentUser = JSON.parse(jsonPayload); // Set current user
                alert('Login successful!');
                loginForm.reset();
                updateAuthUI();
                fetchUsers(); // Fetch users after login
            } else {
                alert(`Login failed: ${data.message || 'Invalid credentials'}`);
            }
        } catch (error) {
            console.error('Error during login:', error);
            alert('An error occurred during login.');
        }
    });

    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('accessToken');
        currentUser = null;
        selectedChatUser = null;
        messagesContainer.innerHTML = ''; // Clear chat messages
        userList.innerHTML = ''; // Clear user list
        updateAuthUI();
    });

    // --- WebSocket Functions ---
    const connectWebSocket = (token) => {
        socket = io('http://localhost:3000'); // Connect to the same port as Express

        socket.on('connect', () => {
            console.log('Connected to WebSocket server.');
            socket.emit('authenticate', token); // Authenticate the socket connection
        });

        socket.on('authenticated', () => {
            console.log('WebSocket authenticated.');
            // Fetch users only after authentication
            fetchUsers();
        });

        socket.on('auth_error', (message) => {
            console.error('WebSocket authentication error:', message);
            alert('WebSocket authentication failed. Please log in again.');
            localStorage.removeItem('accessToken');
            updateAuthUI();
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from WebSocket server.');
        });

        socket.on('message', (msg) => {
            console.log('Received message:', msg);
            // Display message if it's for the current chat
            if (selectedChatUser && (
                (msg.senderId === currentUser.id && msg.receiverId === selectedChatUser.id) ||
                (msg.senderId === selectedChatUser.id && msg.receiverId === currentUser.id)
            )) {
                displayMessage(msg.message, msg.senderUsername || (msg.senderId === currentUser.id ? currentUser.username : selectedChatUser.username), msg.timestamp);
            }
        });

        socket.on('chat_error', (error) => {
            console.error('Chat error:', error);
            alert(`Chat error: ${error}`);
        });

        socket.on('previous_messages', (messages) => {
            messagesContainer.innerHTML = ''; // Clear existing messages
            messages.forEach(msg => {
                displayMessage(msg.message, msg.sender_username, msg.created_at);
            });
            messagesContainer.scrollTop = messagesContainer.scrollHeight; // Scroll to bottom
        });
    };

    const displayMessage = (message, senderUsername, timestamp) => {
        const msgElement = document.createElement('div');
        msgElement.classList.add('chat-message');
        msgElement.innerHTML = `<strong>${senderUsername}</strong> <small>(${new Date(timestamp).toLocaleTimeString()})</small>: ${message}`;
        messagesContainer.appendChild(msgElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight; // Scroll to bottom
    };

    // --- User List and Chat Selection ---
    const fetchUsers = async () => {
        try {
            // This endpoint to get all users is not yet implemented in backend
            // For now, we will mock a list or fetch known users
            // You would typically have a /users API endpoint for this
            const response = await fetch('http://localhost:3000/users'); // This endpoint needs to be created
            const users = await response.json(); // Assuming an array of user objects {id, username}

            userList.innerHTML = '';
            users.forEach(user => {
                if (user.id !== currentUser.id) { // Don't show self in user list
                    const li = document.createElement('li');
                    li.textContent = user.username;
                    li.classList.add('user-item');
                    li.dataset.userId = user.id;
                    li.dataset.username = user.username;
                    li.addEventListener('click', () => {
                        selectChatUser(user);
                    });
                    userList.appendChild(li);
                }
            });
        } catch (error) {
            console.error('Error fetching users:', error);
            // Mock users for testing if /users endpoint is not ready
            const mockUsers = [
                { id: 1, username: 'user1' },
                { id: 2, username: 'user2' },
                { id: 3, username: 'user3' },
            ];
            userList.innerHTML = '';
            mockUsers.forEach(user => {
                if (user.id !== currentUser.id) { // Don't show self in user list
                    const li = document.createElement('li');
                    li.textContent = user.username;
                    li.classList.add('user-item');
                    li.dataset.userId = user.id;
                    li.dataset.username = user.username;
                    li.addEventListener('click', () => {
                        selectChatUser(user);
                    });
                    userList.appendChild(li);
                }
            });
        }
    };

    const selectChatUser = (user) => {
        selectedChatUser = user;
        messagesContainer.innerHTML = ''; // Clear previous chat
        const currentChatUserElements = document.querySelectorAll('.user-item.selected');
        currentChatUserElements.forEach(el => el.classList.remove('selected'));

        const selectedUserElement = userList.querySelector(`[data-user-id="${user.id}"]`);
        if (selectedUserElement) {
            selectedUserElement.classList.add('selected');
        }

        // Fetch previous messages for this chat
        if (socket && socket.connected && currentUser) {
            socket.emit('fetch_messages', { otherUserId: selectedChatUser.id });
        }
    };

    // --- Message Sending ---
    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const message = messageInput.value.trim();

        if (message && socket && socket.connected && selectedChatUser && currentUser) {
            socket.emit('private_message', { receiverUsername: selectedChatUser.username, message });
            messageInput.value = ''; // Clear input
        } else if (!selectedChatUser) {
            alert('Please select a user to chat with.');
        } else if (!currentUser) {
            alert('Please log in to send messages.');
        }
    });

    // Initial UI update
    updateAuthUI();
});