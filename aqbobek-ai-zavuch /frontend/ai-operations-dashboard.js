/**
 * AI Operations Dashboard - Premium School Management Interface
 * Real-time monitoring and control system for school operations
 */

class AIOperationsDashboard {
    constructor() {
        this.currentPage = 'dashboard';
        this.data = {
            incidents: [],
            tasks: [],
            attendance: [],
            staff: [],
            substitutions: [],
            schedule: [],
            notifications: []
        };
        this.refreshInterval = null;
        this.aiChatHistory = [];
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupNavigation();
        this.startRealTimeUpdates();
        this.updateCurrentTime();
        await this.loadInitialData();
        this.renderCurrentPage();
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const page = e.currentTarget.dataset.page;
                this.navigateToPage(page);
            });
        });

        // Dashboard actions
        document.getElementById('refreshDashboard')?.addEventListener('click', () => {
            this.refreshDashboard();
        });

        document.getElementById('exportReport')?.addEventListener('click', () => {
            this.exportReport();
        });

        // AI Chat
        const aiInput = document.getElementById('aiInput');
        const aiSend = document.getElementById('aiSend');
        
        aiSend?.addEventListener('click', () => {
            this.sendAIMessage(aiInput.value);
            aiInput.value = '';
        });

        aiInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendAIMessage(aiInput.value);
                aiInput.value = '';
            }
        });

        // Task actions
        document.getElementById('createTask')?.addEventListener('click', () => {
            this.showCreateTaskModal();
        });

        // Incident actions
        document.getElementById('reportIncident')?.addEventListener('click', () => {
            this.showReportIncidentModal();
        });

        // Schedule actions
        document.getElementById('createSchedule')?.addEventListener('click', () => {
            this.showCreateScheduleModal();
        });

        // Knowledge base
        document.getElementById('knowledgeSearchBtn')?.addEventListener('click', () => {
            this.searchKnowledge();
        });

        document.getElementById('knowledgeSearchInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchKnowledge();
            }
        });

        // Filters
        document.getElementById('taskStatusFilter')?.addEventListener('change', () => {
            this.filterTasks();
        });

        document.getElementById('taskPriorityFilter')?.addEventListener('change', () => {
            this.filterTasks();
        });

        document.getElementById('scheduleTypeFilter')?.addEventListener('change', () => {
            this.filterSchedule();
        });

        document.getElementById('scheduleDayFilter')?.addEventListener('change', () => {
            this.filterSchedule();
        });

        // Toast close
        document.getElementById('toastClose')?.addEventListener('click', () => {
            this.hideToast();
        });
    }

    setupNavigation() {
        // Set active nav item
        const activeNavItem = document.querySelector(`.nav-item[data-page="${this.currentPage}"]`);
        if (activeNavItem) {
            activeNavItem.classList.add('active');
        }
    }

    navigateToPage(page) {
        // Update active nav item
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const newActiveItem = document.querySelector(`.nav-item[data-page="${page}"]`);
        if (newActiveItem) {
            newActiveItem.classList.add('active');
        }

        // Update page sections
        document.querySelectorAll('.page-section').forEach(section => {
            section.classList.remove('active');
        });

        const newSection = document.getElementById(page);
        if (newSection) {
            newSection.classList.add('active');
        }

        this.currentPage = page;
        this.renderCurrentPage();
    }

    async loadInitialData() {
        this.showLoading();
        
        try {
            // Load all data in parallel
            const [
                incidentsResponse,
                tasksResponse,
                attendanceResponse,
                staffResponse,
                substitutionsResponse,
                scheduleResponse,
                notificationsResponse
            ] = await Promise.all([
                this.apiCall('/api/incidents'),
                this.apiCall('/api/tasks'),
                this.apiCall('/api/attendance'),
                this.apiCall('/api/school/staff'),
                this.apiCall('/api/substitutions'),
                this.apiCall('/api/schedule'),
                this.apiCall('/api/notifications')
            ]);

            this.data.incidents = incidentsResponse.ok ? incidentsResponse.incidents || [] : [];
            this.data.tasks = tasksResponse.ok ? tasksResponse.tasks || [] : [];
            this.data.attendance = attendanceResponse.ok ? attendanceResponse.data || [] : [];
            this.data.staff = staffResponse.ok ? staffResponse.staff || [] : [];
            this.data.substitutions = substitutionsResponse.ok ? substitutionsResponse.data || [] : [];
            this.data.schedule = scheduleResponse.ok ? scheduleResponse.data || [] : [];
            this.data.notifications = notificationsResponse.ok ? notificationsResponse.data || [] : [];

            this.updateDashboardWidgets();
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showToast('Error loading data', 'error');
        } finally {
            this.hideLoading();
        }
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

    renderCurrentPage() {
        switch (this.currentPage) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'monitoring':
                this.renderMonitoring();
                break;
            case 'tasks':
                this.renderTasks();
                break;
            case 'incidents':
                this.renderIncidents();
                break;
            case 'dining':
                this.renderDining();
                break;
            case 'schedule':
                this.renderSchedule();
                break;
            case 'collective':
                this.renderCollective();
                break;
            case 'general-timetable':
                this.renderGeneralTimetable();
                break;
            case 'knowledge':
                this.renderKnowledge();
                break;
        }
    }

    renderDashboard() {
        this.updateCriticalAlerts();
        this.updateActiveIncidents();
        this.updateTasksInProgress();
        this.updateMissingAttendance();
        this.updateStaffWorkload();
        this.updateSubstitutionRequests();
        this.updateQuickStats();
    }

    updateCriticalAlerts() {
        const alertsContainer = document.getElementById('criticalAlerts');
        const criticalCount = document.getElementById('criticalCount');
        
        const criticalIncidents = this.data.incidents.filter(incident => 
            incident.priority === 'critical' && incident.status === 'new'
        );
        
        const criticalTasks = this.data.tasks.filter(task => 
            task.priority === 'critical' && task.status === 'new'
        );

        const allCritical = [
            ...criticalIncidents.map(incident => ({
                type: 'incident',
                title: `Incident: ${incident.title}`,
                description: incident.description,
                time: incident.created_at,
                priority: incident.priority
            })),
            ...criticalTasks.map(task => ({
                type: 'task',
                title: `Task: ${task.title}`,
                description: task.description || 'No description',
                time: task.created_at,
                priority: task.priority
            }))
        ];

        allCritical.sort((a, b) => new Date(b.time) - new Date(a.time));

        if (criticalCount) {
            criticalCount.textContent = allCritical.length;
        }

        if (alertsContainer) {
            alertsContainer.innerHTML = allCritical.slice(0, 5).map(alert => `
                <div class="alert-item">
                    <div class="alert-title">${alert.title}</div>
                    <div class="alert-description">${alert.description}</div>
                    <div class="alert-time">${this.formatTime(alert.time)}</div>
                </div>
            `).join('') || '<div class="no-data">No critical alerts</div>';
        }
    }

    updateActiveIncidents() {
        const incidentGrid = document.getElementById('incidentGrid');
        const incidentCount = document.getElementById('incidentCount');
        
        const activeIncidents = this.data.incidents.filter(incident => 
            incident.status !== 'resolved'
        );

        if (incidentCount) {
            incidentCount.textContent = activeIncidents.length;
        }

        if (incidentGrid) {
            incidentGrid.innerHTML = activeIncidents.slice(0, 6).map(incident => `
                <div class="incident-card" onclick="dashboard.viewIncident('${incident.id}')">
                    <div class="incident-type">${incident.type}</div>
                    <div class="incident-title">${incident.title}</div>
                    <div class="incident-priority ${incident.priority}">${incident.priority}</div>
                </div>
            `).join('') || '<div class="no-data">No active incidents</div>';
        }
    }

    updateTasksInProgress() {
        const taskList = document.getElementById('taskList');
        const taskCount = document.getElementById('taskCount');
        
        const inProgressTasks = this.data.tasks.filter(task => 
            task.status === 'in_progress'
        );

        if (taskCount) {
            taskCount.textContent = inProgressTasks.length;
        }

        if (taskList) {
            taskList.innerHTML = inProgressTasks.slice(0, 5).map(task => `
                <div class="task-item" onclick="dashboard.viewTask('${task.id}')">
                    <div class="task-title">${task.title}</div>
                    <div class="task-assignee">${task.assignee}</div>
                    <div class="task-status ${task.status}">${task.status}</div>
                </div>
            `).join('') || '<div class="no-data">No tasks in progress</div>';
        }
    }

    updateMissingAttendance() {
        const attendanceList = document.getElementById('missingAttendance');
        const missingCount = document.getElementById('missingCount');
        
        // Get expected classes from attendance data
        const reportedClasses = new Set(this.data.attendance.map(a => a.class_name));
        const expectedClasses = ['7A', '7B', '7C', '8A', '8B', '8C', '8D', '9A', '9B', '10A', '10B', '11A', '11B'];
        const missingClasses = expectedClasses.filter(cls => !reportedClasses.has(cls));

        if (missingCount) {
            missingCount.textContent = missingClasses.length;
        }

        if (attendanceList) {
            attendanceList.innerHTML = missingClasses.map(cls => `
                <div class="attendance-item">
                    <div class="class-name">${cls}</div>
                    <div class="attendance-status">Missing report</div>
                </div>
            `).join('') || '<div class="no-data">All attendance reported</div>';
        }
    }

    updateStaffWorkload() {
        const workloadGrid = document.getElementById('workloadGrid');
        const staffCount = document.getElementById('staffCount');
        
        // Calculate workload from tasks and schedule
        const staffWorkload = this.data.staff.map(staff => {
            const staffTasks = this.data.tasks.filter(task => task.assignee === staff.full_name);
            const workload = staffTasks.length;
            
            let status = 'normal';
            if (workload >= 5) status = 'overload';
            else if (workload >= 3) status = 'busy';
            
            return {
                name: staff.full_name,
                workload,
                status
            };
        });

        if (staffCount) {
            staffCount.textContent = this.data.staff.length;
        }

        if (workloadGrid) {
            workloadGrid.innerHTML = staffWorkload.slice(0, 8).map(staff => `
                <div class="workload-item">
                    <div class="staff-name">${staff.name}</div>
                    <div class="workload-value ${staff.status}">${staff.workload}</div>
                    <div class="workload-label">tasks</div>
                </div>
            `).join('') || '<div class="no-data">No staff data</div>';
        }
    }

    updateSubstitutionRequests() {
        const substitutionList = document.getElementById('substitutionList');
        const substitutionCount = document.getElementById('substitutionCount');
        
        const pendingSubstitutions = this.data.substitutions.filter(sub => 
            sub.status === 'pending'
        );

        if (substitutionCount) {
            substitutionCount.textContent = pendingSubstitutions.length;
        }

        if (substitutionList) {
            substitutionList.innerHTML = pendingSubstitutions.slice(0, 5).map(sub => `
                <div class="substitution-item" onclick="dashboard.viewSubstitution('${sub.id}')">
                    <div class="substitution-details">${sub.absent_teacher} - ${sub.subject} (${sub.class_name})</div>
                    <div class="substitution-status">${sub.status}</div>
                </div>
            `).join('') || '<div class="no-data">No pending substitutions</div>';
        }
    }

    updateQuickStats() {
        // Update quick stats
        const totalStudents = document.getElementById('totalStudents');
        const totalStaff = document.getElementById('totalStaff');
        const totalClasses = document.getElementById('totalClasses');
        const totalRooms = document.getElementById('totalRooms');

        if (totalStudents) {
            // Calculate from attendance data
            const totalStudentsCount = this.data.attendance.reduce((sum, att) => 
                sum + (att.present || 0) + (att.absent || 0), 0
            );
            totalStudents.textContent = totalStudentsCount || '--';
        }

        if (totalStaff) {
            totalStaff.textContent = this.data.staff.length;
        }

        if (totalClasses) {
            const classes = new Set(this.data.attendance.map(a => a.class_name));
            totalClasses.textContent = classes.size || '--';
        }

        if (totalRooms) {
            // Extract from schedule data
            const rooms = new Set();
            if (this.data.schedule.master_schedule) {
                Object.values(this.data.schedule.master_schedule).forEach(schedule => {
                    if (Array.isArray(schedule)) {
                        schedule.forEach(item => {
                            if (item.room) rooms.add(item.room);
                        });
                    }
                });
            }
            totalRooms.textContent = rooms.size || '--';
        }
    }

    renderMonitoring() {
        // Update monitoring-specific widgets
        this.updateSystemMetrics();
        this.updateActiveUsers();
    }

    updateSystemMetrics() {
        const activeUsersElement = document.getElementById('activeUsers');
        if (activeUsersElement) {
            activeUsersElement.textContent = this.data.staff.length;
        }
    }

    updateActiveUsers() {
        // This would typically come from a real-time system
        // For now, we'll use staff count as a proxy
    }

    renderTasks() {
        this.renderDetailedTasks();
    }

    renderDetailedTasks() {
        const taskList = document.getElementById('detailedTaskList');
        if (!taskList) return;

        const statusFilter = document.getElementById('taskStatusFilter')?.value || 'all';
        const priorityFilter = document.getElementById('taskPriorityFilter')?.value || 'all';

        let filteredTasks = this.data.tasks;

        if (statusFilter !== 'all') {
            filteredTasks = filteredTasks.filter(task => task.status === statusFilter);
        }

        if (priorityFilter !== 'all') {
            filteredTasks = filteredTasks.filter(task => task.priority === priorityFilter);
        }

        taskList.innerHTML = filteredTasks.map(task => `
            <div class="task-item detailed" onclick="dashboard.viewTask('${task.id}')">
                <div class="task-header">
                    <div class="task-title">${task.title}</div>
                    <div class="task-priority ${task.priority}">${task.priority}</div>
                </div>
                <div class="task-details">
                    <div class="task-assignee">${task.assignee}</div>
                    <div class="task-deadline">${task.deadline || 'No deadline'}</div>
                </div>
                <div class="task-status ${task.status}">${task.status}</div>
            </div>
        `).join('') || '<div class="no-data">No tasks found</div>';
    }

    renderIncidents() {
        this.renderDetailedIncidents();
    }

    renderDetailedIncidents() {
        const incidentList = document.getElementById('detailedIncidentList');
        if (!incidentList) return;

        incidentList.innerHTML = this.data.incidents.map(incident => `
            <div class="incident-item detailed" onclick="dashboard.viewIncident('${incident.id}')">
                <div class="incident-header">
                    <div class="incident-title">${incident.title}</div>
                    <div class="incident-priority ${incident.priority}">${incident.priority}</div>
                </div>
                <div class="incident-details">
                    <div class="incident-type">${incident.type}</div>
                    <div class="incident-location">${incident.location || 'No location'}</div>
                </div>
                <div class="incident-status">${incident.status}</div>
            </div>
        `).join('') || '<div class="no-data">No incidents found</div>';
    }

    renderDining() {
        this.updateDiningStats();
    }

    updateDiningStats() {
        const totalMeals = document.getElementById('totalMeals');
        const presentMeals = document.getElementById('presentMeals');
        const absentMeals = document.getElementById('absentMeals');

        // Calculate from attendance data
        const totalStudentsCount = this.data.attendance.reduce((sum, att) => 
            sum + (att.present || 0) + (att.absent || 0), 0
        );
        const presentCount = this.data.attendance.reduce((sum, att) => sum + (att.present || 0), 0);
        const absentCount = this.data.attendance.reduce((sum, att) => sum + (att.absent || 0), 0);

        if (totalMeals) totalMeals.textContent = totalStudentsCount || '--';
        if (presentMeals) presentMeals.textContent = presentCount || '--';
        if (absentMeals) absentMeals.textContent = absentCount || '--';
    }

    renderSchedule() {
        this.renderScheduleTable();
    }

    renderScheduleTable() {
        const scheduleTable = document.getElementById('scheduleTable');
        if (!scheduleTable) return;

        const typeFilter = document.getElementById('scheduleTypeFilter')?.value || 'class';
        const dayFilter = document.getElementById('scheduleDayFilter')?.value || 'all';
        const entityFilter = document.getElementById('scheduleEntityFilter')?.value || '';

        // This would typically filter and render schedule data
        scheduleTable.innerHTML = '<div class="no-data">Schedule view coming soon</div>';
    }

    renderCollective() {
        this.renderStaffMatrix();
        this.renderWorkloadAnalysis();
    }

    renderStaffMatrix() {
        const staffGrid = document.getElementById('staffGrid');
        if (!staffGrid) return;

        staffGrid.innerHTML = this.data.staff.slice(0, 12).map(staff => `
            <div class="staff-card">
                <div class="staff-name">${staff.full_name}</div>
                <div class="staff-role">${staff.role}</div>
                <div class="staff-category">${staff.category}</div>
                <div class="staff-status ${staff.is_active ? 'active' : 'inactive'}">
                    ${staff.is_active ? 'Active' : 'Inactive'}
                </div>
            </div>
        `).join('') || '<div class="no-data">No staff data</div>';
    }

    renderWorkloadAnalysis() {
        const workloadCharts = document.getElementById('workloadCharts');
        if (!workloadCharts) return;

        workloadCharts.innerHTML = '<div class="no-data">Workload analysis coming soon</div>';
    }

    renderGeneralTimetable() {
        this.renderCalendar();
    }

    renderCalendar() {
        const calendarContainer = document.getElementById('calendarContainer');
        if (!calendarContainer) return;

        calendarContainer.innerHTML = '<div class="no-data">Calendar view coming soon</div>';
    }

    renderKnowledge() {
        this.renderKnowledgeTemplates();
    }

    renderKnowledgeTemplates() {
        const templateList = document.getElementById('templateList');
        if (!templateList) return;

        templateList.innerHTML = '<div class="no-data">Knowledge templates coming soon</div>';
    }

    async searchKnowledge() {
        const searchInput = document.getElementById('knowledgeSearchInput');
        const searchResults = document.getElementById('knowledgeSearchResults');
        
        if (!searchInput || !searchResults) return;

        const query = searchInput.value.trim();
        if (!query) return;

        try {
            this.showLoading();
            const response = await this.apiCall('/api/knowledge/search', {
                method: 'POST',
                body: JSON.stringify({
                    query: query,
                    query_type: 'search',
                    max_results: 10
                })
            });

            if (response.ok) {
                searchResults.innerHTML = response.results.map(result => `
                    <div class="search-result-item">
                        <div class="result-title">${result.title}</div>
                        <div class="result-content">${result.content}</div>
                        <div class="result-confidence">Confidence: ${Math.round(result.confidence * 100)}%</div>
                    </div>
                `).join('') || '<div class="no-data">No results found</div>';
            } else {
                searchResults.innerHTML = '<div class="error">Search failed</div>';
            }
        } catch (error) {
            console.error('Knowledge search error:', error);
            searchResults.innerHTML = '<div class="error">Search failed</div>';
        } finally {
            this.hideLoading();
        }
    }

    async sendAIMessage(message) {
        if (!message.trim()) return;

        const aiChat = document.getElementById('aiChat');
        if (!aiChat) return;

        // Add user message
        this.addChatMessage(message, 'user');

        try {
            this.showLoading();
            
            // Simulate AI response (in real implementation, this would call AI API)
            setTimeout(() => {
                const aiResponse = this.generateAIResponse(message);
                this.addChatMessage(aiResponse, 'ai');
                this.hideLoading();
            }, 1000);

        } catch (error) {
            console.error('AI chat error:', error);
            this.addChatMessage('Sorry, I encountered an error. Please try again.', 'ai');
            this.hideLoading();
        }
    }

    addChatMessage(message, sender) {
        const aiChat = document.getElementById('aiChat');
        if (!aiChat) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}`;
        messageDiv.innerHTML = `<div class="message-text">${message}</div>`;
        
        aiChat.appendChild(messageDiv);
        aiChat.scrollTop = aiChat.scrollHeight;
    }

    generateAIResponse(userMessage) {
        const message = userMessage.toLowerCase();
        
        if (message.includes('incident') || message.includes('problem')) {
            return 'I can help you with incident management. Current active incidents: ' + this.data.incidents.filter(i => i.status !== 'resolved').length;
        } else if (message.includes('task') || message.includes('todo')) {
            return 'You have ' + this.data.tasks.filter(t => t.status === 'in_progress').length + ' tasks in progress.';
        } else if (message.includes('attendance') || message.includes('report')) {
            return 'Attendance status: ' + this.data.attendance.length + ' classes reported today.';
        } else if (message.includes('substitution') || message.includes('replace')) {
            return 'Pending substitutions: ' + this.data.substitutions.filter(s => s.status === 'pending').length;
        } else if (message.includes('staff') || message.includes('teacher')) {
            return 'Total staff members: ' + this.data.staff.length + ', Active: ' + this.data.staff.filter(s => s.is_active).length;
        } else {
            return 'I understand you need help with school operations. I can assist with incidents, tasks, attendance, substitutions, and staff management. What specific area would you like to explore?';
        }
    }

    viewIncident(incidentId) {
        const incident = this.data.incidents.find(i => i.id === incidentId);
        if (incident) {
            this.showToast(`Viewing incident: ${incident.title}`, 'info');
            // In a real implementation, this would open a detailed view
        }
    }

    viewTask(taskId) {
        const task = this.data.tasks.find(t => t.id === taskId);
        if (task) {
            this.showToast(`Viewing task: ${task.title}`, 'info');
            // In a real implementation, this would open a detailed view
        }
    }

    viewSubstitution(substitutionId) {
        const substitution = this.data.substitutions.find(s => s.id === substitutionId);
        if (substitution) {
            this.showToast(`Viewing substitution: ${substitution.absent_teacher}`, 'info');
            // In a real implementation, this would open a detailed view
        }
    }

    showCreateTaskModal() {
        this.showToast('Create task modal coming soon', 'info');
    }

    showReportIncidentModal() {
        this.showToast('Report incident modal coming soon', 'info');
    }

    showCreateScheduleModal() {
        this.showToast('Create schedule modal coming soon', 'info');
    }

    filterTasks() {
        this.renderDetailedTasks();
    }

    filterSchedule() {
        this.renderScheduleTable();
    }

    async refreshDashboard() {
        await this.loadInitialData();
        this.showToast('Dashboard refreshed', 'success');
    }

    exportReport() {
        this.showToast('Export feature coming soon', 'info');
    }

    startRealTimeUpdates() {
        // Update every 30 seconds
        this.refreshInterval = setInterval(() => {
            this.loadInitialData();
        }, 30000);
    }

    updateCurrentTime() {
        const updateTime = () => {
            const timeElement = document.getElementById('currentTime');
            if (timeElement) {
                const now = new Date();
                timeElement.textContent = now.toLocaleTimeString('ru-RU', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
            }
        };

        updateTime();
        setInterval(updateTime, 1000);
    }

    formatTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: 'short'
        });
    }

    showLoading() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.classList.add('active');
        }
    }

    hideLoading() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.classList.remove('active');
        }
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('notificationToast');
        const toastMessage = document.getElementById('toastMessage');
        
        if (toast && toastMessage) {
            toastMessage.textContent = message;
            toast.classList.add('show');
            
            setTimeout(() => {
                this.hideToast();
            }, 3000);
        }
    }

    hideToast() {
        const toast = document.getElementById('notificationToast');
        if (toast) {
            toast.classList.remove('show');
        }
    }

    updateDashboardWidgets() {
        if (this.currentPage === 'dashboard') {
            this.renderDashboard();
        }
    }

    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new AIOperationsDashboard();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.dashboard) {
        window.dashboard.destroy();
    }
});
