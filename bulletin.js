document.addEventListener('DOMContentLoaded', () => {
    const postsContainer = document.getElementById('posts-container');
    const postForm = document.getElementById('post-form');

    // Function to fetch and display posts
    const fetchPosts = async () => {
        try {
            const response = await fetch('http://localhost:3000/posts'); // Assuming backend is on port 3000
            const posts = await response.json();
            postsContainer.innerHTML = ''; // Clear existing posts
            posts.forEach(post => {
                const postElement = document.createElement('div');
                postElement.classList.add('post-item');
                postElement.innerHTML = `
                    <h3>${post.title}</h3>
                    <p>${post.content}</p>
                    <small>Category: ${post.category || 'N/A'} | Posted by: ${post.username} on ${new Date(post.created_at).toLocaleDateString()}</small>
                `;
                postsContainer.appendChild(postElement);
            });
        } catch (error) {
            console.error('Error fetching posts:', error);
            postsContainer.innerHTML = '<p>Error loading posts.</p>';
        }
    };

    // Handle new post submission
    if (postForm) {
        postForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const title = document.getElementById('post-title').value;
            const content = document.getElementById('post-content').value;
            const category = document.getElementById('post-category').value;
            const token = localStorage.getItem('accessToken'); // Get token from local storage

            if (!token) {
                alert('Please log in to create a post.');
                return;
            }

            try {
                const response = await fetch('http://localhost:3000/posts', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ title, content, category })
                });

                if (response.ok) {
                    alert('Post created successfully!');
                    postForm.reset();
                    fetchPosts(); // Refresh posts list
                } else {
                    const errorText = await response.text();
                    alert(`Failed to create post: ${errorText}`);
                }
            } catch (error) {
                console.error('Error creating post:', error);
                alert('An error occurred while creating the post.');
            }
        });
    }

    // Initial fetch of posts when the page loads
    fetchPosts();
});