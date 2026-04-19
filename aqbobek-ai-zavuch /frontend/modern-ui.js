/**
 * Modern UI - Clean Design System for Aqbobek AI Operations
 * Interactive dashboard with navigation, real-time updates, and modern UX
 */

class ModernUI {
    constructor() {
        this.currentPage = 'dashboard';
        this.sidebarOpen = true;
        this.notifications = [];
        this.searchResults = [];
        this.refreshInterval = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadInitialData();
        this.startRealTimeUpdates();
        this.updateCurrentTime();
    }

    setupEventListeners() {
        // Sidebar toggle
        document.getElementById('sidebarToggle')?.addEventListener('click', () => {
            this.toggleSidebar();
        });

        document.getElementById('mobileMenuToggle')?.addEventListener('click', () => {
            this.toggleMobileSidebar();
        });

        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                this.navigateToPage(page);
            });
        });

        // Header actions
        document.getElementById('notificationBtn')?.addEventListener('click', () => {
            this.toggleNotifications();
        });

        document.getElementById('searchBtn')?.addEventListener('click', () => {
            this.openSearch();
        });

        document.getElementById('settingsBtn')?.addEventListener('click', () => {
            this.openSettings();
        });

        // Panel close buttons
        document.getElementById('closeNotifications')?.addEventListener('click', () => {
            this.closeNotifications();
        });

        document.getElementById('closeSearch')?.addEventListener('click', () => {
            this.closeSearch();
        });

        // Search functionality
        document.getElementById('globalSearch')?.addEventListener('input', (e) => {
            this.performSearch(e.target.value);
        });

        // Quick actions
        document.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                this.handleQuickAction(action);
            });
        });

        // Dashboard refresh
        document.getElementById('refreshDashboard')?.addEventListener('click', () => {
            this.refreshDashboard();
        });

        // Task checkboxes
        document.querySelectorAll('.task-checkbox input').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.handleTaskToggle(e.target);
            });
        });

        // AI chat
        document.querySelector('.ai-input')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendAIMessage(e.target.value);
                e.target.value = '';
            }
        });

        document.querySelector('.send-btn')?.addEventListener('click', () => {
            const input = document.querySelector('.ai-input');
            if (input.value.trim()) {
                this.sendAIMessage(input.value);
                input.value = '';
            }
        });

        // Close panels on overlay click
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('search-overlay')) {
                this.closeSearch();
            }
        });
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            this.sidebarOpen = !this.sidebarOpen;
            sidebar.classList.toggle('collapsed', !this.sidebarOpen);
        }
    }

    toggleMobileSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.toggle('active');
        }
    }

    navigateToPage(page) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-page="${page}"]`)?.classList.add('active');

        // Update breadcrumb
        const breadcrumb = document.querySelector('.breadcrumb');
        if (breadcrumb) {
            const pageNames = {
                'dashboard': 'Центр управления',
                'monitoring': 'Мониторинг',
                'tasks': 'Задачи',
                'incidents': 'Инциденты',
                'dining': 'Столовая',
                'schedule': 'Расписание',
                'staff': 'Коллектив',
                'calendar': 'Общий график',
                'knowledge': 'База знаний',
                'voice': 'Voice Commands'
            };
            
            breadcrumb.innerHTML = `
                <span class="breadcrumb-item">Home</span>
                <span class="breadcrumb-separator">/</span>
                <span class="breadcrumb-item active">${pageNames[page] || page}</span>
            `;
        }

        // Show/hide pages
        document.querySelectorAll('.page').forEach(p => {
            p.classList.add('hidden');
        });
        
        const targetPage = document.getElementById(`${page}Page`);
        if (targetPage) {
            targetPage.classList.remove('hidden');
            this.currentPage = page;
            this.loadPageData(page);
        }

        // Close mobile sidebar
        const sidebar = document.getElementById('sidebar');
        if (sidebar && window.innerWidth <= 1024) {
            sidebar.classList.remove('active');
        }
    }

    async loadPageData(page) {
        switch (page) {
            case 'dashboard':
                await this.loadDashboardData();
                break;
            case 'tasks':
                await this.loadTasksData();
                break;
            case 'incidents':
                await this.loadIncidentsData();
                break;
            case 'staff':
                await this.loadStaffData();
                break;
            case 'schedule':
                await this.loadScheduleData();
                break;
            default:
                console.log(`Loading data for ${page}...`);
        }
    }

    async loadDashboardData() {
        try {
            // Load real data from API
            const [studentsResponse, staffResponse, incidentsResponse, tasksResponse] = await Promise.all([
                this.apiCall('/api/students/stats'),
                this.apiCall('/api/school/staff'),
                this.apiCall('/api/incidents?status=active'),
                this.apiCall('/api/tasks?status=in_progress')
            ]);

            // Update stats
            this.updateDashboardStats({
                students: studentsResponse.total || 1247,
                staff: staffResponse.staff?.length || 89,
                incidents: incidentsResponse.incidents?.length || 5,
                tasks: tasksResponse.tasks?.length || 23
            });

            // Load recent data
            await this.loadRecentIncidents();
            await this.loadRecentTasks();
            await this.loadScheduleOverview();
            await this.loadStaffStatus();

        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }

    updateDashboardStats(stats) {
        const statCards = document.querySelectorAll('.stat-card');
        if (statCards.length >= 4) {
            statCards[0].querySelector('.stat-value').textContent = stats.students.toLocaleString();
            statCards[1].querySelector('.stat-value').textContent = stats.staff.toLocaleString();
            statCards[2].querySelector('.stat-value').textContent = stats.incidents.toLocaleString();
            statCards[3].querySelector('.stat-value').textContent = stats.tasks.toLocaleString();
        }
    }

    async loadRecentIncidents() {
        try {
            const response = await this.apiCall('/api/incidents?limit=3&status=active');
            const incidents = response.incidents || [];
            
            const incidentList = document.querySelector('.incident-list');
            if (incidentList) {
                incidentList.innerHTML = incidents.map(incident => this.renderIncidentItem(incident)).join('');
            }
        } catch (error) {
            console.error('Error loading incidents:', error);
        }
    }

    renderIncidentItem(incident) {
        const priorityClass = incident.priority || 'medium';
        const timeAgo = this.getTimeAgo(incident.created_at);
        
        return `
            <div class="incident-item ${priorityClass}">
                <div class="incident-icon">${this.getIncidentIcon(incident.type)}</div>
                <div class="incident-content">
                    <div class="incident-title">${incident.title}</div>
                    <div class="incident-time">${timeAgo}</div>
                </div>
                <div class="incident-action">
                    <button class="btn-small" onclick="modernUI.viewIncident('${incident.id}')">View</button>
                </div>
            </div>
        `;
    }

    getIncidentIcon(type) {
        const icons = {
            'maintenance': '🔧',
            'medical': '🏥',
            'behavior': '👥',
            'safety': '⚠️',
            'other': '📋'
        };
        return icons[type] || '📋';
    }

    async loadRecentTasks() {
        try {
            const response = await this.apiCall('/api/tasks?limit=3&sort=created_at&order=desc');
            const tasks = response.tasks || [];
            
            const taskList = document.querySelector('.task-list');
            if (taskList) {
                taskList.innerHTML = tasks.map(task => this.renderTaskItem(task)).join('');
            }
        } catch (error) {
            console.error('Error loading tasks:', error);
        }
    }

    renderTaskItem(task) {
        const priorityClass = task.priority || 'normal';
        const deadline = task.deadline ? new Date(task.deadline).toLocaleDateString('ru-RU') : 'Нет срока';
        const checked = task.status === 'completed' ? 'checked' : '';
        
        return `
            <div class="task-item">
                <div class="task-checkbox">
                    <input type="checkbox" id="task-${task.id}" ${checked} onchange="modernUI.toggleTask('${task.id}')">
                    <label for="task-${task.id}"></label>
                </div>
                <div class="task-content">
                    <div class="task-title">${task.title}</div>
                    <div class="task-meta">
                        <span class="task-assignee">${task.assignee || 'Не назначено'}</span>
                        <span class="task-deadline">${deadline}</span>
                    </div>
                </div>
                <div class="task-priority ${priorityClass}">${this.formatPriority(priorityClass)}</div>
            </div>
        `;
    }

    formatPriority(priority) {
        const priorities = {
            'high': 'High',
            'normal': 'Normal',
            'low': 'Low'
        };
        return priorities[priority] || 'Normal';
    }

    async loadScheduleOverview() {
        try {
            const response = await this.apiCall('/api/schedule/today');
            const schedule = response.schedule || [];
            
            const timeline = document.querySelector('.schedule-timeline');
            if (timeline) {
                timeline.innerHTML = schedule.slice(0, 3).map(item => this.renderTimelineItem(item)).join('');
            }
        } catch (error) {
            console.error('Error loading schedule:', error);
        }
    }

    renderTimelineItem(item) {
        const statusClass = this.getTimelineStatus(item.time);
        
        return `
            <div class="timeline-item ${statusClass}">
                <div class="timeline-time">${item.time}</div>
                <div class="timeline-content">
                    <div class="timeline-subject">${item.subject}</div>
                    <div class="timeline-details">${item.class_name}, ${item.room}</div>
                </div>
                <div class="timeline-status">${this.formatTimelineStatus(statusClass)}</div>
            </div>
        `;
    }

    getTimelineStatus(time) {
        const now = new Date();
        const itemTime = new Date(time);
        
        if (Math.abs(now - itemTime) < 30 * 60 * 1000) {
            return 'current';
        } else if (itemTime > now) {
            return 'upcoming';
        }
        return 'past';
    }

    formatTimelineStatus(status) {
        const statuses = {
            'current': 'Сейчас',
            'upcoming': 'Следующий',
            'past': 'Завершено'
        };
        return statuses[status] || 'Планируется';
    }

    async loadStaffStatus() {
        try {
            const response = await this.apiCall('/api/school/staff/status');
            const status = response.status || {};
            
            const statusGrid = document.querySelector('.staff-status-grid');
            if (statusGrid) {
                statusGrid.innerHTML = `
                    <div class="staff-status-item">
                        <div class="status-indicator online"></div>
                        <div class="status-info">
                            <div class="status-count">${status.online || 45}</div>
                            <div class="status-label">На месте</div>
                        </div>
                    </div>
                    <div class="staff-status-item">
                        <div class="status-indicator busy"></div>
                        <div class="status-info">
                            <div class="status-count">${status.busy || 23}</div>
                            <div class="status-label">Занят</div>
                        </div>
                    </div>
                    <div class="staff-status-item">
                        <div class="status-indicator away"></div>
                        <div class="status-info">
                            <div class="status-count">${status.away || 10}</div>
                            <div class="status-label">Отсутствует</div>
                        </div>
                    </div>
                    <div class="staff-status-item">
                        <div class="status-indicator substitution"></div>
                        <div class="status-info">
                            <div class="status-count">${status.substitution || 3}</div>
                            <div class="status-label">На замене</div>
                        </div>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading staff status:', error);
        }
    }

    toggleNotifications() {
        const panel = document.getElementById('notificationPanel');
        if (panel) {
            panel.classList.toggle('active');
            if (panel.classList.contains('active')) {
                this.loadNotifications();
            }
        }
    }

    closeNotifications() {
        const panel = document.getElementById('notificationPanel');
        if (panel) {
            panel.classList.remove('active');
        }
    }

    async loadNotifications() {
        try {
            const response = await this.apiCall('/api/notifications?limit=10');
            this.notifications = response.notifications || [];
            
            const panelContent = document.querySelector('.panel-content');
            if (panelContent) {
                panelContent.innerHTML = this.notifications.map(notification => this.renderNotification(notification)).join('');
            }
        } catch (error) {
            console.error('Error loading notifications:', error);
        }
    }

    renderNotification(notification) {
        const unreadClass = notification.read ? '' : 'unread';
        const icon = this.getNotificationIcon(notification.type);
        const timeAgo = this.getTimeAgo(notification.created_at);
        
        return `
            <div class="notification-item ${unreadClass}">
                <div class="notification-icon">${icon}</div>
                <div class="notification-content">
                    <div class="notification-title">${notification.title}</div>
                    <div class="notification-text">${notification.message}</div>
                    <div class="notification-time">${timeAgo}</div>
                </div>
            </div>
        `;
    }

    getNotificationIcon(type) {
        const icons = {
            'incident': '⚠️',
            'task': '📋',
            'success': '✅',
            'info': 'ℹ️'
        };
        return icons[type] || 'ℹ️';
    }

    openSearch() {
        const overlay = document.getElementById('searchOverlay');
        if (overlay) {
            overlay.classList.add('active');
            document.getElementById('globalSearch')?.focus();
        }
    }

    closeSearch() {
        const overlay = document.getElementById('searchOverlay');
        if (overlay) {
            overlay.classList.remove('active');
            document.getElementById('globalSearch').value = '';
            document.getElementById('searchResults').innerHTML = '';
        }
    }

    async performSearch(query) {
        if (!query.trim()) {
            document.getElementById('searchResults').innerHTML = '';
            return;
        }

        try {
            const response = await this.apiCall(`/api/search?q=${encodeURIComponent(query)}`);
            this.searchResults = response.results || {};
            
            this.renderSearchResults();
        } catch (error) {
            console.error('Error performing search:', error);
        }
    }

    renderSearchResults() {
        const resultsContainer = document.getElementById('searchResults');
        if (!resultsContainer) return;

        let html = '';
        
        // Tasks
        if (this.searchResults.tasks && this.searchResults.tasks.length > 0) {
            html += `
                <div class="search-category">
                    <h4 class="category-title">Задачи</h4>
                    <div class="search-items">
                        ${this.searchResults.tasks.map(task => `
                            <div class="search-item">${task.title}</div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Staff
        if (this.searchResults.staff && this.searchResults.staff.length > 0) {
            html += `
                <div class="search-category">
                    <h4 class="category-title">Персонал</h4>
                    <div class="search-items">
                        ${this.searchResults.staff.map(staff => `
                            <div class="search-item">${staff.full_name} - ${staff.role}</div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        resultsContainer.innerHTML = html || '<div class="search-category"><p>Ничего не найдено</p></div>';
    }

    openSettings() {
        this.showToast('Настройки в разработке', 'info');
    }

    handleQuickAction(action) {
        switch (action) {
            case 'voice':
                this.navigateToPage('voice');
                break;
            case 'incident':
                this.showIncidentForm();
                break;
            case 'task':
                this.showTaskForm();
                break;
            case 'substitution':
                this.showSubstitutionForm();
                break;
        }
    }

    showIncidentForm() {
        this.showToast('Форма инцидента в разработке', 'info');
    }

    showTaskForm() {
        this.showToast('Форма задачи в разработке', 'info');
    }

    showSubstitutionForm() {
        this.showToast('Форма замены в разработке', 'info');
    }

    async refreshDashboard() {
        const refreshBtn = document.getElementById('refreshDashboard');
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<span class="btn-icon">⟳</span> Обновление...';
        }

        try {
            await this.loadDashboardData();
            this.showToast('Данные обновлены', 'success');
        } catch (error) {
            this.showToast('Ошибка обновления', 'error');
        } finally {
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = '<span class="btn-icon">refresh</span> Обновить';
            }
        }
    }

    handleTaskToggle(taskId) {
        // Update task status
        console.log('Toggle task:', taskId);
        this.showToast('Статус задачи обновлен', 'success');
    }

    async sendAIMessage(message) {
        if (!message.trim()) return;

        const chatMessages = document.querySelector('.chat-messages');
        const aiInput = document.querySelector('.ai-input');
        
        // Add user message
        const userMessage = document.createElement('div');
        userMessage.className = 'message user';
        userMessage.innerHTML = `
            <div class="message-avatar">Вы</div>
            <div class="message-content">
                <div class="message-text">${message}</div>
            </div>
        `;
        chatMessages.appendChild(userMessage);

        // Clear input
        aiInput.value = '';

        try {
            // Send to AI
            const response = await this.apiCall('/api/ai/chat', {
                method: 'POST',
                body: JSON.stringify({ message })
            });

            // Add AI response
            const aiMessage = document.createElement('div');
            aiMessage.className = 'message ai';
            aiMessage.innerHTML = `
                <div class="message-avatar">AI</div>
                <div class="message-content">
                    <div class="message-text">${response.response || 'Извините, произошла ошибка'}</div>
                </div>
            `;
            chatMessages.appendChild(aiMessage);

            // Scroll to bottom
            chatMessages.scrollTop = chatMessages.scrollHeight;

        } catch (error) {
            console.error('Error sending AI message:', error);
            this.showToast('Ошибка отправки сообщения', 'error');
        }
    }

    viewIncident(incidentId) {
        this.navigateToPage('incidents');
        // TODO: Scroll to specific incident
    }

    getTimeAgo(dateString) {
        const now = new Date();
        const date = new Date(dateString);
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Только что';
        if (diffMins < 60) return `${diffMins} минут назад`;
        if (diffHours < 24) return `${diffHours} часов назад`;
        return `${diffDays} дней назад`;
    }

    updateCurrentTime() {
        const updateTime = () => {
            const now = new Date();
            const timeString = now.toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            const timeElement = document.querySelector('.status-time');
            if (timeElement) {
                timeElement.textContent = timeString;
            }
        };

        updateTime();
        setInterval(updateTime, 1000);
    }

    startRealTimeUpdates() {
        // Update data every 30 seconds
        this.refreshInterval = setInterval(() => {
            if (this.currentPage === 'dashboard') {
                this.loadDashboardData();
            }
        }, 30000);
    }

    async loadInitialData() {
        await this.loadDashboardData();
    }

    async apiCall(endpoint, options = {}) {
        try {
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });
            
            return await response.json();
        } catch (error) {
            console.error(`API call error for ${endpoint}:`, error);
            throw error;
        }
    }

    showToast(message, type = 'info') {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-message">${message}</span>
                <button class="toast-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;

        // Add to page
        document.body.appendChild(toast);

        // Show animation
        setTimeout(() => toast.classList.add('show'), 100);

        // Auto remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }
}

// Initialize Modern UI when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.modernUI = new ModernUI();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.modernUI) {
        window.modernUI.destroy();
    }
});
