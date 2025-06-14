// ---------------------- USER MANAGEMENT FUNCTIONS ----------------------

// Function to load user statistics
function loadUserStats() {
    fetch('/admin/user_stats')
        .then(response => response.json())
        .then(data => {
            document.getElementById('total-user').textContent = data.total_users;
            document.getElementById('active-user').textContent = data.active_users;
            document.getElementById('banned-user').textContent = data.banned_users;
        })
        .catch(error => {
            console.error('Error loading user stats:', error);
        });
}

// Function to load users by type (total, active, banned)
function loadUsersByType(userType) {
    fetch(`/admin/users/${userType}`)
        .then(response => response.json())
        .then(data => {
            const container = document.querySelector('.box-2');
            container.innerHTML = ''; // Clear existing content

            // Create title based on user type
            const titleElement = document.createElement('div');
            titleElement.className = 'user-list-title';
            titleElement.textContent = userType.charAt(0).toUpperCase() + userType.slice(1) + ' Users';
            container.appendChild(titleElement);

            if (data.users.length === 0) {
                const noUsersElement = document.createElement('div');
                noUsersElement.className = 'no-users';
                noUsersElement.textContent = 'No users found';
                container.appendChild(noUsersElement);
                return;
            }

            // Create user list
            const userList = document.createElement('div');
            userList.className = 'user-list';

            data.users.forEach(user => {
                const userElement = document.createElement('div');
                userElement.className = 'user-item';
                userElement.setAttribute('data-id', user._id);

                userElement.innerHTML = `
                    <div class="user-info" onclick="loadUserChats('${user._id}')">
                        <span class="username">${user.username}</span>
                        <span class="user-ip">${user.last_ip || 'Unknown IP'}</span>
                    </div>
                    <div class="user-actions">
                        ${userType === 'banned' ?
                        `<button class="unban-btn" onclick="unbanUser('${user._id}')"><i class="ri-flag-2-line"></i></button>` :
                        `<button class="ban-btn" onclick="banUser('${user._id}')"><i class="ri-flag-2-fill"></i></button>`
                    }
                    </div>
                `;

                userList.appendChild(userElement);
            });

            container.appendChild(userList);

            // Mark the first user as active
            const firstUser = container.querySelector('.user-item');
            if (firstUser) {
                firstUser.classList.add('active');
                loadUserChats(firstUser.getAttribute('data-id'));
            }

            // Update dashboard counters
            const userCount = data.users.length;

            // Update in main dashboard
            const dashboardCounters = document.querySelectorAll('#dashboard .box .child');
            dashboardCounters.forEach(counter => {
                const categoryText = counter.querySelector('.sec-2').textContent.trim();
                if (categoryText.toLowerCase().includes(userType)) {
                    counter.querySelector('.sec-1').textContent = userCount;
                }
            });

            // Update in user section box-1
            if (userType === 'total') {
                document.getElementById('total-user').textContent = userCount;
            } else if (userType === 'active') {
                document.getElementById('active-user').textContent = userCount;
            } else if (userType === 'banned') {
                document.getElementById('banned-user').textContent = userCount;
            }
        })
        .catch(error => {
            console.error(`Error loading ${userType} users:`, error);
            const container = document.querySelector('.box-2');
            container.innerHTML = `<div class="error-message">Error loading users</div>`;
        });
}

// Function to load all user counts on page load
function loadAllUserCounts() {
    // Load counts for total, active, and banned users
    const userTypes = ['total', 'active', 'banned'];

    userTypes.forEach(type => {
        fetch(`/admin/users/${type}`)
            .then(response => response.json())
            .then(data => {
                const count = data.users.length;

                // Update in main dashboard
                const dashboardCounters = document.querySelectorAll('#dashboard .box .child');
                dashboardCounters.forEach(counter => {
                    const categoryText = counter.querySelector('.sec-2').textContent.trim();
                    if (categoryText.toLowerCase().includes(type)) {
                        counter.querySelector('.sec-1').textContent = count;
                    }
                });

                // Update in user section box-1
                if (type === 'total') {
                    document.getElementById('total-user').textContent = count;
                } else if (type === 'active') {
                    document.getElementById('active-user').textContent = count;
                } else if (type === 'banned') {
                    document.getElementById('banned-user').textContent = count;
                }
            })
            .catch(error => {
                console.error(`Error loading ${type} users count:`, error);
            });
    });

    // Load total chats count
    fetch('/admin/chats/total')
        .then(response => response.json())
        .then(data => {
            const count = data.count || 0;

            // Update total chats count in dashboard
            const dashboardCounters = document.querySelectorAll('#dashboard .box .child');
            dashboardCounters.forEach(counter => {
                const categoryText = counter.querySelector('.sec-2').textContent.trim();
                if (categoryText.toLowerCase().includes('total chats')) {
                    counter.querySelector('.sec-1').textContent = count;
                }
            });
        })
        .catch(error => {
            console.error('Error loading total chats count:', error);
        });
}

// Function to load user chats
function loadUserChats(userId) {
    // Highlight the selected user
    const userItems = document.querySelectorAll('.user-item');
    userItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-id') === userId) {
            item.classList.add('active');
        }
    });

    fetch(`/admin/user/${userId}/chats`)
        .then(response => response.json())
        .then(data => {
            const container = document.querySelector('.child-2');
            container.innerHTML = ''; // Clear existing content

            // Create title with username
            const titleElement = document.createElement('div');
            titleElement.className = 'chat-list-title';
            titleElement.textContent = `${data.username}'s Conversations`;
            container.appendChild(titleElement);

            if (data.conversations.length === 0) {
                const noChatsElement = document.createElement('div');
                noChatsElement.className = 'no-chats';
                noChatsElement.textContent = 'No conversations found';
                container.appendChild(noChatsElement);
                return;
            }

            // Create conversation list
            const chatList = document.createElement('div');
            chatList.className = 'chat-list';

            data.conversations.forEach(conv => {
                const convElement = document.createElement('div');
                convElement.className = 'chat-item';
                convElement.setAttribute('data-id', conv.conversation_id);

                convElement.innerHTML = `
                    <div class="chat-info" onclick="viewFullConversation('${conv.conversation_id}')">
                        <span class="chat-date">${conv.created_at}</span>
                        <span class="chat-count">${conv.message_count} messages</span>
                    </div>
                    <div class="chat-preview" onclick="viewFullConversation('${conv.conversation_id}')">${conv.preview}</div>
                    <div class="chat-actions">
                        <button class="view-chat-btn" onclick="viewFullConversation('${conv.conversation_id}')">
                            <i class="ri-eye-line"></i>
                        </button>
                        <button class="delete-chat-btn" onclick="deleteConversation('${conv.conversation_id}')">
                            <i class="ri-delete-bin-5-line"></i> 
                        </button>
                    </div>
                `;

                chatList.appendChild(convElement);
            });

            container.appendChild(chatList);
        })
        .catch(error => {
            console.error('Error loading user chats:', error);
            const container = document.querySelector('.child-2');
            container.innerHTML = `<div class="error-message">Error loading conversations</div>`;
        });
}

// Function to view full conversation
function viewFullConversation(convId) {
    fetch(`/admin/conversation/${convId}/messages`)
        .then(response => response.json())
        .then(data => {
            const container = document.querySelector('.child-2');
            container.innerHTML = ''; // Clear existing content

            // Create back button and title
            const headerDiv = document.createElement('div');
            headerDiv.className = 'conversation-header';
            headerDiv.innerHTML = `
                <button class="back-btn" onclick="loadUserChats('${document.querySelector('.user-item.active')?.getAttribute('data-id')}')">
                    <i class="ri-arrow-left-line"></i> Back
                </button>
                <div class="conversation-title">Conversation from ${data.messages[0]?.timestamp || 'Unknown date'}</div>
            `;
            container.appendChild(headerDiv);

            // Create conversation messages container
            const messagesContainer = document.createElement('div');
            messagesContainer.className = 'conversation-messages';

            // Add all messages
            data.messages.forEach(msg => {
                const messageElement = document.createElement('div');
                messageElement.className = `message ${msg.is_bot ? 'bot-message' : 'user-message'}`;

                messageElement.innerHTML = `
                    <div class="message-header">
                        <span class="message-username">${msg.username}</span>
                        <span class="message-time">${msg.timestamp}</span>
                    </div>
                    <div class="message-content">${msg.message}</div>
                `;

                messagesContainer.appendChild(messageElement);
            });

            container.appendChild(messagesContainer);
        })
        .catch(error => {
            console.error('Error loading conversation:', error);
            const container = document.querySelector('.child-2');
            container.innerHTML = `
                <div class="error-message">Error loading conversation</div>
                <button class="back-btn" onclick="loadUserChats('${document.querySelector('.user-item.active')?.getAttribute('data-id')}')">
                    <i class="ri-arrow-left-line"></i> Back
                </button>
            `;
        });
}

// Function to ban a user
function banUser(userId) {
    if (confirm('Are you sure you want to ban this user?')) {
        fetch(`/admin/user/${userId}/ban`, {
            method: 'POST'
        })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    alert(data.message);
                    // Reload current user type
                    const activeTab = document.querySelector('.sec-1.active');
                    if (activeTab) {
                        const userType = activeTab.id.replace('-user', '');
                        loadUsersByType(userType);
                    } else {
                        loadUsersByType('total');
                    }
                    // Reload stats
                    loadUserStats();
                } else {
                    alert('Error: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error banning user:', error);
                alert('Error banning user');
            });
    }
}

// Function to unban a user
function unbanUser(userId) {
    fetch(`/admin/user/${userId}/unban`, {
        method: 'POST'
    })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                alert(data.message);
                // Reload current user type
                const activeTab = document.querySelector('.sec-1.active');
                if (activeTab) {
                    const userType = activeTab.id.replace('-user', '');
                    loadUsersByType(userType);
                } else {
                    loadUsersByType('banned');
                }
                // Reload stats
                loadUserStats();
            } else {
                alert('Error: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error unbanning user:', error);
            alert('Error unbanning user');
        });
}

// Function to delete a conversation
function deleteConversation(convId) {
    if (confirm('Are you sure you want to delete this conversation?')) {
        fetch(`/admin/conversation/${convId}`, {
            method: 'DELETE'
        })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    // Remove the conversation element from DOM
                    const convElement = document.querySelector(`.chat-item[data-id="${convId}"]`);
                    if (convElement) {
                        convElement.remove();
                    }

                    // Check if there are no more conversations
                    const convCount = document.querySelectorAll('.chat-item').length;
                    if (convCount === 0) {
                        const container = document.querySelector('.child-2');
                        const title = container.querySelector('.chat-list-title');
                        const noChatsElement = document.createElement('div');
                        noChatsElement.className = 'no-chats';
                        noChatsElement.textContent = 'No conversations found';
                        container.innerHTML = '';
                        container.appendChild(title);
                        container.appendChild(noChatsElement);
                    }

                    // Show alert
                    alert(data.message);
                } else {
                    alert('Error: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error deleting conversation:', error);
                alert('Error deleting conversation');
            });
    }
}

// Helper function to highlight the active user type
function highlightUserType(type) {
    const userTypes = document.querySelectorAll('.sec-1');
    userTypes.forEach(element => {
        element.classList.remove('active');
    });
    document.getElementById(`${type}-user`).classList.add('active');
}

// ---------------------- INQUIRY MANAGEMENT FUNCTIONS ----------------------

// Function to fetch and display inquiries
function loadInquiries() {
    fetch('/admin/inquiries')
        .then(response => response.json())
        .then(data => {
            const container = document.getElementById('inquiriesContainer');
            container.innerHTML = ''; // Clear existing content

            if (data.inquiries.length === 0) {
                container.innerHTML = '<div class="no-inquiries">No inquiries found</div>';
                return;
            }

            data.inquiries.forEach(inquiry => {
                const inquiryElement = document.createElement('div');
                inquiryElement.className = 'inquiry-item';
                inquiryElement.setAttribute('data-id', inquiry._id);

                // Add 'unread' class if inquiry is unread
                if (inquiry.status === 'unread') {
                    inquiryElement.classList.add('unread');
                }

                inquiryElement.innerHTML = `
                    <div class="inquiry-header">
                        <div class="inquiry-actions">
                            ${inquiry.status === 'unread' ?
                        `<button class="mark-read-btn" onclick="markAsRead('${inquiry._id}')"><i class="ri-check-double-line"></i></button>` :
                        ''}
                            <button class="delete-btn" onclick="deleteInquiry('${inquiry._id}')"><i class="ri-delete-bin-5-line"></i> </button>
                        </div>
                        <pre class="inquiry-time">${inquiry.formatted_time.replace(' ', '  | ')}</pre>
                    </div>
                    <div class="inquiry-info">
                        <p><strong>From:</strong> ${inquiry.name} (${inquiry.email})</p>
                        <p><strong>Subject:</strong> ${inquiry.subject}</p>
                    </div>
                    <div class="inquiry-message">
                        <p>${inquiry.message}</p>
                    </div>
                `;

                container.appendChild(inquiryElement);
            });
        })
        .catch(error => {
            console.error('Error loading inquiries:', error);
            const container = document.getElementById('inquiriesContainer');
            container.innerHTML = '<div class="error-message">Error loading inquiries</div>';
        });
}

// Function to mark inquiry as read
function markAsRead(inquiryId) {
    fetch(`/admin/inquiries/${inquiryId}/mark_read`, { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // Update UI directly without full reload
                const inquiryElement = document.querySelector(`.inquiry-item[data-id="${inquiryId}"]`);
                if (inquiryElement) {
                    inquiryElement.classList.remove('unread');
                    const markReadBtn = inquiryElement.querySelector('.mark-read-btn');
                    if (markReadBtn) {
                        markReadBtn.remove();
                    }
                }
            } else {
                alert('Error marking inquiry as read');
                loadInquiries(); // Fallback to full reload
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error marking inquiry as read');
            loadInquiries(); // Fallback to full reload
        });
}

// Function to delete inquiry
function deleteInquiry(inquiryId) {
    if (confirm('Are you sure you want to delete this inquiry?')) {
        fetch(`/admin/inquiries/${inquiryId}`, { method: 'DELETE' })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    // Remove element from DOM without full reload
                    const inquiryElement = document.querySelector(`.inquiry-item[data-id="${inquiryId}"]`);
                    if (inquiryElement) {
                        inquiryElement.remove();
                    }

                    // Check if there are no more inquiries
                    const inquiryCount = document.querySelectorAll('.inquiry-item').length;
                    if (inquiryCount === 0) {
                        const container = document.getElementById('inquiriesContainer');
                        container.innerHTML = '<div class="no-inquiries">No inquiries found</div>';
                    }
                } else {
                    alert('Error deleting inquiry');
                    loadInquiries(); // Fallback to full reload
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Error deleting inquiry');
                loadInquiries(); // Fallback to full reload
            });
    }
}

// ---------------------- ANALYTICS FUNCTIONS ----------------------

// Function to initialize analytics chart
function initAnalyticsChart() {
    // Fetch analytics data
    fetch('/admin/analytics')
        .then(response => response.json())
        .then(data => {
            renderUserActivityChart(data);
            renderMessageDistributionChart(data);
        })
        .catch(error => {
            console.error('Error loading analytics data:', error);
            document.querySelector('.box-3').innerHTML = '<div class="error-message">Error loading analytics data</div>';
        });
}

// Function to render user activity chart
function renderUserActivityChart(data) {
    // Sample data if API doesn't exist yet
    const sampleData = {
        dates: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        newUsers: [30, 45, 60, 35, 55, 70],
        activeUsers: [80, 90, 105, 85, 110, 130]
    };
    
    const chartData = data || sampleData;
    
    // Create user activity chart container
    const chartContainer = document.createElement('div');
    chartContainer.className = 'chart-container';
    chartContainer.innerHTML = `
        <h3>User Activity</h3>
        <canvas id="userActivityChart"></canvas>
    `;
    
    document.querySelector('.box-3').appendChild(chartContainer);
    
    // Initialize chart using Chart.js
    const ctx = document.getElementById('userActivityChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.dates,
            datasets: [
                {
                    label: 'New Users',
                    data: chartData.newUsers,
                    borderColor: '#ffd900',
                    backgroundColor: 'rgba(255, 217, 0, 0.2)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Active Users',
                    data: chartData.activeUsers,
                    borderColor: '#36a2eb',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Function to render message distribution chart
function renderMessageDistributionChart(data) {
    // Sample data if API doesn't exist yet
    const sampleData = {
        categories: ['Legal Advice', 'Document Review', 'Court Procedures', 'Rights Information', 'Other'],
        counts: [150, 120, 80, 95, 45]
    };
    
    const chartData = data || sampleData;
    
    // Create message distribution chart container
    const chartContainer = document.createElement('div');
    chartContainer.className = 'chart-container';
    chartContainer.innerHTML = `
        <h3>Message Distribution by Category</h3>
        <canvas id="messageDistributionChart"></canvas>
    `;
    
    document.querySelector('.box-3').appendChild(chartContainer);
    
    // Initialize chart using Chart.js
    const ctx = document.getElementById('messageDistributionChart').getContext('2d');
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: chartData.categories,
            datasets: [{
                data: chartData.counts,
                backgroundColor: [
                    'rgba(255, 217, 0, 0.7)',
                    'rgba(54, 162, 235, 0.7)',
                    'rgba(255, 99, 132, 0.7)',
                    'rgba(75, 192, 192, 0.7)',
                    'rgba(153, 102, 255, 0.7)'
                ],
                borderColor: [
                    'rgba(255, 217, 0, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 99, 132, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(153, 102, 255, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

// ---------------------- NAVIGATION FUNCTIONS ----------------------

// Function to handle navigation between sections
function navigateToSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.content > div').forEach(section => {
        section.style.display = 'none';
    });

    // Show the selected section
    document.getElementById(sectionId).style.display = 'block';

    // Update the active nav item
    document.querySelectorAll('.nav-bar a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${sectionId}`) {
            link.classList.add('active');
        }
    });

    // Load section-specific data
    if (sectionId === 'dashboard') {
        loadUserStats();
        initAnalyticsChart();
    } else if (sectionId === 'user') {
        loadUserStats();
        loadUsersByType('total');
        highlightUserType('total');
    } else if (sectionId === 'inquiry') {
        loadInquiries();
    }
}

// ---------------------- INITIALIZATION ----------------------

// Initialize admin dashboard
document.addEventListener('DOMContentLoaded', function () {
    // Fix scrolling issue
    document.body.style.height = '100vh';
    document.body.style.overflow = 'hidden';
    document.querySelector('.content').style.overflowY = 'auto';
    document.querySelector('.content').style.height = 'calc(100vh - 60px)';

    // Set up navigation
    document.querySelectorAll('.nav-bar a').forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const sectionId = this.getAttribute('href').substring(1);
            navigateToSection(sectionId);
        });
    });

    // Add click event listeners to user counts
    document.getElementById('total-user').addEventListener('click', function () {
        loadUsersByType('total');
        highlightUserType('total');
    });

    document.getElementById('active-user').addEventListener('click', function () {
        loadUsersByType('active');
        highlightUserType('active');
    });

    document.getElementById('banned-user').addEventListener('click', function () {
        loadUsersByType('banned');
        highlightUserType('banned');
    });

    // Make box divs clickable to redirect to user section
    document.querySelectorAll('#dashboard .box .child').forEach(box => {
        box.addEventListener('click', function() {
            navigateToSection('user');
            const categoryText = this.querySelector('.sec-2').textContent.trim().toLowerCase();
            
            if (categoryText.includes('active')) {
                loadUsersByType('active');
                highlightUserType('active');
            } else if (categoryText.includes('banned')) {
                loadUsersByType('banned');
                highlightUserType('banned');
            } else if (categoryText.includes('total users')) {
                loadUsersByType('total');
                highlightUserType('total');
            }
        });
    });

    // Fix logout button
    document.querySelector('.logout-btn').addEventListener('click', function(e) {
        e.preventDefault();
        fetch('/logout', {
            method: 'POST',
            credentials: 'same-origin'
        })
        .then(response => {
            if (response.ok) {
                window.location.href = '/login';
            } else {
                throw new Error('Logout failed');
            }
        })
        .catch(error => {
            console.error('Error during logout:', error);
            alert('Error during logout. Please try again.');
        });
    });

    // Navigate to dashboard by default
    navigateToSection('dashboard');

    // Load Charts.js library
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js';
    script.integrity = 'sha512-ElRFoEQdI5Ht6kZvyzXhYG9NqjtkmlkfYk0wr6wHxU9JEHakS7UJZNeml5ALk+8IKlU6jDgMabC3vkumRokgJA==';
    script.crossOrigin = 'anonymous';
    script.referrerPolicy = 'no-referrer';
    script.onload = function() {
        initAnalyticsChart();
    };
    document.head.appendChild(script);

    // Set refresh intervals
    setInterval(loadUserStats, 30000);  // Refresh user stats every 30 seconds
    setInterval(function () {
        // Only refresh inquiries if the inquiry tab is active
        if (document.getElementById('inquiry').style.display !== 'none') {
            loadInquiries();
        }
    }, 30000);  // Refresh inquiries every 30 seconds
});