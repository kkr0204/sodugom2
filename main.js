
class MemberCard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <style>
                .member-card {
                    background-color: #fff;
                    border-radius: 10px;
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                    overflow: hidden;
                    width: 300px;
                    transition: transform 0.3s ease;
                }
                .member-card:hover {
                    transform: translateY(-10px);
                }
                .member-card img {
                    width: 100%;
                    height: 300px;
                    object-fit: cover;
                }
                .member-info {
                    padding: 1.5rem;
                }
                .member-info h3 {
                    font-size: 1.5rem;
                    margin-top: 0;
                    margin-bottom: 0.5rem;
                }
                .member-info p {
                    color: #666;
                    margin-bottom: 1rem;
                }
                .view-profile-btn {
                    background-color: var(--primary-color, #ff4081);
                    color: #fff;
                    padding: 0.8rem 1.5rem;
                    border: none;
                    border-radius: 20px;
                    text-decoration: none;
                    font-weight: bold;
                    transition: background-color 0.3s ease;
                }
                .view-profile-btn:hover {
                    background-color: var(--secondary-color, #ff80ab);
                }
            </style>
            <div class="member-card">
                <img src="${this.getAttribute('image')}" alt="${this.getAttribute('name')}">
                <div class="member-info">
                    <h3>${this.getAttribute('name')}, ${this.getAttribute('age')}</h3>
                    <p>${this.getAttribute('bio')}</p>
                    <a href="#" class="view-profile-btn">View Profile</a>
                </div>
            </div>
        `;
    }
}

customElements.define('member-card', MemberCard);

const members = [
    {
        name: 'Alice',
        age: 28,
        bio: 'Looking for someone to share my adventures with.',
        image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=1887&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
    },
    {
        name: 'Bob',
        age: 32,
        bio: 'Passionate about hiking, cooking, and good conversation.',
        image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1887&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
    },
    {
        name: 'Charlie',
        age: 25,
        bio: 'Artist and musician seeking a creative soul.',
        image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=1887&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
    }
];

const membersContainer = document.querySelector('.members-container');
if (membersContainer) {
    members.forEach(member => {
        const memberCard = document.createElement('member-card');
        memberCard.setAttribute('name', member.name);
        memberCard.setAttribute('age', member.age);
        memberCard.setAttribute('bio', member.bio);
        memberCard.setAttribute('image', member.image);
        membersContainer.appendChild(memberCard);
    });
}


// Theme switching logic (existing)
const themeToggleButton = document.getElementById('theme-toggle');
const currentTheme = localStorage.getItem('theme');

if (currentTheme) {
    document.documentElement.setAttribute('data-theme', currentTheme);
} else {
    // Check for user's system preference if no theme is saved
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
    }
}

themeToggleButton.addEventListener('click', () => {
    let theme = document.documentElement.getAttribute('data-theme');
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    }
});


// --- Site-wide Authentication Logic ---
const loginButton = document.querySelector('.login-btn');
const signupButton = document.querySelector('.signup-btn');
const authButtonsDiv = document.querySelector('.auth-buttons');
const navLinks = document.querySelector('.nav-links');

const updateAuthUI = () => {
    const token = localStorage.getItem('accessToken');
    if (token) {
        // User is logged in
        loginButton.textContent = 'Logout';
        signupButton.style.display = 'none'; // Hide Sign Up
        // Optionally, show user-specific links or a profile link
    } else {
        // User is logged out
        loginButton.textContent = 'Login';
        signupButton.style.display = 'block'; // Show Sign Up
    }
};

// Handle Login/Logout button click
if (loginButton) {
    loginButton.addEventListener('click', async () => {
        const token = localStorage.getItem('accessToken');
        if (token) {
            // If logged in, perform logout
            localStorage.removeItem('accessToken');
            alert('Logged out successfully!');
            updateAuthUI();
            // Redirect to home or refresh page if needed
            window.location.href = 'index.html';
        } else {
            // If logged out, prompt for login or redirect to login page
            // For simplicity, we'll alert and expect the user to go to chat.html to login
            alert('Please go to the Chat Room page to log in or register.');
            // Or redirect: window.location.href = 'chat.html';
        }
    });
}

if (signupButton) {
    signupButton.addEventListener('click', () => {
        alert('Please go to the Chat Room page to register.');
        // Or redirect: window.location.href = 'chat.html';
    });
}

// Initial update of auth UI on page load
updateAuthUI();
