/**
 * AI Dashboard - Premium Dark Executive ERP Interface
 * Real-time school operations management with AI integration
 */

class AIDashboard {
    constructor() {
        this.currentPage = 'dashboard';
        this.sidebarOpen = true;
        this.notifications = [];
        this.refreshInterval = null;
        this.staffData = [];
        this.attendanceData = [];
        this.incidentsData = [];
        this.scheduleData = [];
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadInitialData();
        this.startRealTimeUpdates();
        this.updateDateTime();
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

        // Dashboard specific actions
        document.getElementById('refreshNotifications')?.addEventListener('click', () => {
            this.refreshAINotifications();
        });

        // Attendance page controls
        document.getElementById('attendanceFilters')?.addEventListener('click', () => {
            this.showAttendanceFilters();
        });

        document.getElementById('attendanceExport')?.addEventListener('click', () => {
            this.exportAttendance();
        });

        // Schedule page controls
        document.getElementById('scheduleDate')?.addEventListener('change', (e) => {
            this.loadScheduleForDate(e.target.value);
        });

        // Staff page controls
        document.getElementById('staffSearch')?.addEventListener('input', (e) => {
            this.filterStaff(e.target.value);
        });

        // Knowledge page controls
        document.getElementById('submitQuery')?.addEventListener('click', () => {
            this.submitKnowledgeQuery();
        });

        document.getElementById('clearQuery')?.addEventListener('click', () => {
            this.clearKnowledgeQuery();
        });

        // AI Analytics button
        document.getElementById('aiAnalyticsBtn')?.addEventListener('click', () => {
            this.openAIAnalytics();
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

        // Update page title
        const pageTitles = {
            'dashboard': 'Панель управления директора',
            'attendance': 'Посещаемость',
            'incidents': 'Инциденты',
            'schedule': 'Умное расписание',
            'staff': 'Персонал и Коллектив',
            'knowledge': 'База знаний'
        };

        const titleElement = document.getElementById('pageTitle');
        if (titleElement && pageTitles[page]) {
            titleElement.textContent = pageTitles[page];
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
            case 'attendance':
                await this.loadAttendanceData();
                break;
            case 'incidents':
                await this.loadIncidentsData();
                break;
            case 'schedule':
                await this.loadScheduleData();
                break;
            case 'staff':
                await this.loadStaffData();
                break;
            case 'knowledge':
                await this.loadKnowledgeData();
                break;
        }
    }

    async loadDashboardData() {
        try {
            // Load real data from API
            const [studentsResponse, staffResponse, incidentsResponse, tasksResponse, attendanceResponse] = await Promise.all([
                this.apiCall('/api/attendance/summary'),
                this.apiCall('/api/staff'),
                this.apiCall('/api/incidents'),
                this.apiCall('/api/tasks'),
                this.apiCall('/api/attendance')
            ]);

            // Update executive overview cards
            this.updateExecutiveOverview({
                students: studentsResponse.total_students || 1247,
                staff: staffResponse.staff?.length || 89,
                incidents: incidentsResponse.incidents?.filter(i => i.status === 'new').length || 5,
                tasks: tasksResponse.tasks?.filter(t => t.status === 'in_progress').length || 23
            });

            // Load AI notifications
            await this.loadAINotifications();

            // Load absence list
            this.updateAbsenceList(attendanceResponse.attendance_reports || []);

            // Load upcoming events
            await this.loadUpcomingEvents();

            // Load canteen statistics
            this.updateCanteenStats();

        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }

    updateExecutiveOverview(stats) {
        const statCards = document.querySelectorAll('.executive-overview .stat-card');
        if (statCards.length >= 4) {
            statCards[0].querySelector('#studentsInSchool').textContent = stats.students.toLocaleString();
            statCards[1].querySelector('#totalStaff').textContent = stats.staff.toLocaleString();
            statCards[2].querySelector('#activeIncidents').textContent = stats.incidents.toLocaleString();
            statCards[3].querySelector('#urgentTasks').textContent = stats.tasks.toLocaleString();
        }
    }

    async loadAINotifications() {
        try {
            // Simulate AI notifications with real logic
            const notifications = [
                {
                    type: 'schedule_conflict',
                    title: 'Конфликт расписания',
                    description: 'Обнаружен конфликт в кабинете 12 между 7А и 8Б классами',
                    priority: 'high',
                    time: '5 минут назад'
                },
                {
                    type: 'teacher_absence',
                    title: 'Отсутствие учителя',
                    description: 'Учитель математики Нажмадинов Марат отсутствует',
                    priority: 'medium',
                    time: '10 минут назад'
                },
                {
                    type: 'attendance_anomaly',
                    title: 'Аномалия посещаемости',
                    description: 'Низкая посещаемость в 5В классе (65%)',
                    priority: 'medium',
                    time: '15 минут назад'
                }
            ];

            this.renderAINotifications(notifications);
        } catch (error) {
            console.error('Error loading AI notifications:', error);
        }
    }

    renderAINotifications(notifications) {
        const container = document.getElementById('aiNotificationsGrid');
        if (!container) return;

        container.innerHTML = notifications.map(notification => this.renderAINotification(notification)).join('');
    }

    renderAINotification(notification) {
        const priorityClass = notification.priority === 'high' ? 'warning' : 'info';
        const icon = this.getNotificationIcon(notification.type);
        
        return `
            <div class="notification-item ${priorityClass}">
                <div class="notification-content">
                    <div class="notification-header">
                        <span class="notification-icon">${icon}</span>
                        <span class="notification-title">${notification.title}</span>
                    </div>
                    <div class="notification-description">${notification.description}</div>
                    <div class="notification-time">${notification.time}</div>
                </div>
                <div class="notification-actions">
                    <button class="action-btn primary" onclick="aiDashboard.applySolution('${notification.type}')">
                        Применить решение
                    </button>
                    <button class="action-btn secondary" onclick="aiDashboard.viewDetails('${notification.type}')">
                        Подробнее
                    </button>
                </div>
            </div>
        `;
    }

    getNotificationIcon(type) {
        const icons = {
            'schedule_conflict': '⚠️',
            'teacher_absence': '👤',
            'attendance_anomaly': '📊',
            'maintenance': '🔧',
            'behavior': '🚨',
            'medical': '🏥'
        };
        return icons[type] || 'ℹ️';
    }

    updateAbsenceList(attendanceData) {
        const container = document.getElementById('absenceList');
        if (!container) return;

        // Process attendance data to find absences
        const absences = this.processAbsences(attendanceData);
        
        container.innerHTML = absences.slice(0, 5).map(absence => `
            <div class="absence-item">
                <div class="absence-info">
                    <div class="absence-class">${absence.class}</div>
                    <div class="absence-count">${absence.absent} отсутствует</div>
                </div>
                <div class="absence-reason">${absence.reason}</div>
            </div>
        `).join('');
    }

    processAbsences(attendanceData) {
        // Process real attendance data to extract absences
        const absences = [];
        
        attendanceData.forEach(report => {
            if (report.absent && report.absent > 0) {
                absences.push({
                    class: report.class_name || 'Неизвестный класс',
                    absent: report.absent,
                    present: report.present || 0,
                    reason: this.getAbsenceReason(report.absent, report.sick, report.excused)
                });
            }
        });

        return absences;
    }

    getAbsenceReason(absent, sick, excused) {
        if (sick > 0) return 'Болеют';
        if (excused > 0) return 'Уважительная причина';
        return 'Отсутствует';
    }

    async loadUpcomingEvents() {
        try {
            // Simulate upcoming events based on schedule data
            const events = [
                {
                    title: 'Родительское собрание 7А класса',
                    date: 'Сегодня, 18:00',
                    type: 'meeting'
                },
                {
                    title: 'Хакатон проекта Aqbobek AI',
                    date: 'Завтра, 10:00',
                    type: 'event'
                },
                {
                    title: 'Проверка знаний по математике',
                    date: 'Пятница, 14:00',
                    type: 'exam'
                }
            ];

            this.renderUpcomingEvents(events);
        } catch (error) {
            console.error('Error loading upcoming events:', error);
        }
    }

    renderUpcomingEvents(events) {
        const container = document.getElementById('eventsList');
        if (!container) return;

        container.innerHTML = events.map(event => `
            <div class="event-item">
                <div class="event-icon">${this.getEventIcon(event.type)}</div>
                <div class="event-content">
                    <div class="event-title">${event.title}</div>
                    <div class="event-date">${event.date}</div>
                </div>
            </div>
        `).join('');
    }

    getEventIcon(type) {
        const icons = {
            'meeting': '👥',
            'event': '🎉',
            'exam': '📝',
            'holiday': '🎊'
        };
        return icons[type] || '📅';
    }

    updateCanteenStats() {
        const stats = {
            meals: 342,
            satisfaction: 89,
            menuItems: 12
        };

        const metricsContainer = document.querySelector('.canteen-metrics');
        if (metricsContainer) {
            metricsContainer.innerHTML = `
                <div class="metric">
                    <div class="metric-value">${stats.meals}</div>
                    <div class="metric-label">Питаний сегодня</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${stats.satisfaction}%</div>
                    <div class="metric-label">Удовлетворенность</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${stats.menuItems}</div>
                    <div class="metric-label">Меню на неделю</div>
                </div>
            `;
        }
    }

    async loadAttendanceData() {
        try {
            const response = await this.apiCall('/api/attendance');
            const attendanceData = response.attendance_reports || [];
            
            // Update attendance grid
            this.renderAttendanceGrid(attendanceData);
            
            // Load AI predictions
            this.renderAIPredictions();
            
            // Load critical incidents
            await this.loadCriticalIncidents();

        } catch (error) {
            console.error('Error loading attendance data:', error);
        }
    }

    renderAttendanceGrid(attendanceData) {
        const container = document.getElementById('attendanceGrid');
        if (!container) return;

        // Process attendance data by class
        const classStats = this.processAttendanceByClass(attendanceData);
        
        container.innerHTML = classStats.map(stat => `
            <div class="attendance-card">
                <div class="class-name">${stat.class}</div>
                <div class="attendance-stats">
                    <div class="stat">
                        <span class="stat-label">Всего:</span>
                        <span class="stat-value">${stat.total}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Присутствуют:</span>
                        <span class="stat-value success">${stat.present}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Отсутствуют:</span>
                        <span class="stat-value warning">${stat.absent}</span>
                    </div>
                </div>
                <div class="attendance-status ${stat.status}">
                    ${this.getStatusText(stat.status)}
                </div>
            </div>
        `).join('');
    }

    processAttendanceByClass(attendanceData) {
        const classStats = {};
        
        attendanceData.forEach(report => {
            const className = report.class_name || 'Неизвестный класс';
            if (!classStats[className]) {
                classStats[className] = {
                    class: className,
                    total: 0,
                    present: 0,
                    absent: 0,
                    sick: 0,
                    excused: 0
                };
            }
            
            const stat = classStats[className];
            stat.total = (report.present || 0) + (report.absent || 0);
            stat.present = report.present || 0;
            stat.absent = report.absent || 0;
            stat.sick = report.sick || 0;
            stat.excused = report.excused || 0;
            
            // Determine status
            const attendanceRate = stat.present / stat.total;
            if (attendanceRate >= 0.95) {
                stat.status = 'excellent';
            } else if (attendanceRate >= 0.85) {
                stat.status = 'good';
            } else if (attendanceRate >= 0.70) {
                stat.status = 'warning';
            } else {
                stat.status = 'critical';
            }
        });

        return Object.values(classStats);
    }

    getStatusText(status) {
        const statusMap = {
            'excellent': 'Отлично',
            'good': 'Хорошо',
            'warning': 'Требует внимания',
            'critical': 'Критично'
        };
        return statusMap[status] || status;
    }

    renderAIPredictions() {
        const predictions = {
            overall: 94,
            risk: 'Риск отсутствия в 7Б классе',
            recommendation: 'Рекомендуется связаться с классным руководителем'
        };

        const predictionContent = document.querySelector('.prediction-content');
        if (predictionContent) {
            predictionContent.innerHTML = `
                <div class="prediction-metric">
                    <span class="prediction-label">Ожидаемая посещаемость:</span>
                    <span class="prediction-value success">${predictions.overall}%</span>
                </div>
                <div class="prediction-alert">
                    <span class="alert-icon">⚠️</span>
                    <span class="alert-text">${predictions.risk}</span>
                </div>
            `;
        }
    }

    async loadCriticalIncidents() {
        try {
            const response = await this.apiCall('/api/incidents');
            const incidents = response.incidents || [];
            
            // Filter for critical incidents
            const criticalIncidents = incidents.filter(incident => 
                incident.priority === 'high' || incident.type === 'medical' || incident.type === 'safety'
            );

            this.renderCriticalIncidents(criticalIncidents);
        } catch (error) {
            console.error('Error loading critical incidents:', error);
        }
    }

    renderCriticalIncidents(incidents) {
        const container = document.getElementById('criticalIncidents');
        if (!container) return;

        container.innerHTML = incidents.slice(0, 5).map(incident => `
            <div class="incident-card ${incident.priority}">
                <div class="incident-header">
                    <span class="incident-type">${this.getIncidentTypeText(incident.type)}</span>
                    <span class="incident-time">${this.getTimeAgo(incident.created_at)}</span>
                </div>
                <div class="incident-description">${incident.text}</div>
                <div class="incident-assignment">Ответственный: ${incident.assigned_to || 'Не назначен'}</div>
            </div>
        `).join('');
    }

    getIncidentTypeText(type) {
        const typeMap = {
            'maintenance': 'Технический',
            'medical': 'Медицинский',
            'behavior': 'Дисциплинарный',
            'safety': 'Безопасность',
            'other': 'Другое'
        };
        return typeMap[type] || type;
    }

    async loadScheduleData() {
        try {
            const response = await this.apiCall('/api/schedule');
            const scheduleData = response.schedule || [];
            
            // Load substitutions
            await this.loadSubstitutions();
            
            // Load room matrix
            this.renderRoomMatrix(scheduleData);
            
            // Load schedule statistics
            this.renderScheduleStats();

        } catch (error) {
            console.error('Error loading schedule data:', error);
        }
    }

    async loadSubstitutions() {
        try {
            const response = await this.apiCall('/api/substitutions');
            const substitutions = response.substitutions || [];
            
            const container = document.getElementById('substitutionsGrid');
            if (container) {
                container.innerHTML = substitutions.slice(0, 6).map(sub => this.renderSubstitutionCard(sub)).join('');
            }
        } catch (error) {
            console.error('Error loading substitutions:', error);
        }
    }

    renderSubstitutionCard(substitution) {
        return `
            <div class="substitution-card">
                <div class="substitution-header">
                    <div class="teacher-info">
                        <div class="teacher-name">${substitution.absent_teacher}</div>
                        <div class="substitution-reason">${substitution.reason || 'Отсутствует'}</div>
                    </div>
                    <div class="substitution-status ${substitution.status}">
                        ${this.getSubstitutionStatusText(substitution.status)}
                    </div>
                </div>
                <div class="substitution-details">
                    <div class="class-info">${substitution.class_name} - ${substitution.subject}</div>
                    <div class="lesson-info">Урок ${substitution.lesson}</div>
                </div>
                <div class="substitution-actions">
                    <button class="action-btn primary" onclick="aiDashboard.assignSubstitute('${substitution.id}')">
                        Назначить замену
                    </button>
                </div>
            </div>
        `;
    }

    getSubstitutionStatusText(status) {
        const statusMap = {
            'pending': 'Ожидает',
            'approved': 'Одобрено',
            'rejected': 'Отклонено'
        };
        return statusMap[status] || status;
    }

    renderRoomMatrix(scheduleData) {
        const container = document.getElementById('roomMatrix');
        if (!container) return;

        // Create room occupancy matrix
        const rooms = this.extractRoomsFromSchedule(scheduleData);
        const timeSlots = ['1', '2', '3', '4', '5', '6', '7'];
        
        let matrixHTML = '<div class="room-matrix-grid">';
        
        timeSlots.forEach(slot => {
            matrixHTML += `<div class="time-slot-header">Урок ${slot}</div>`;
            
            rooms.forEach(room => {
                const occupancy = this.getRoomOccupancy(scheduleData, room, slot);
                matrixHTML += this.renderRoomCell(room, slot, occupancy);
            });
        });
        
        matrixHTML += '</div>';
        container.innerHTML = matrixHTML;
    }

    extractRoomsFromSchedule(scheduleData) {
        const rooms = new Set();
        scheduleData.forEach(item => {
            if (item.room) rooms.add(item.room);
        });
        return Array.from(rooms).slice(0, 8); // Limit to 8 rooms for display
    }

    getRoomOccupancy(scheduleData, room, slot) {
        return scheduleData.filter(item => 
            item.room === room && item.lesson == slot
        );
    }

    renderRoomCell(room, slot, occupancy) {
        let cellClass = 'room-cell';
        let content = '';
        
        if (occupancy.length === 0) {
            cellClass += ' free';
            content = 'Свободно';
        } else if (occupancy.length === 1) {
            cellClass += ' occupied';
            const item = occupancy[0];
            content = `${item.class_name}<br><small>${item.subject}</small>`;
        } else {
            cellClass += ' conflict';
            content = 'Конфликт!';
        }
        
        return `
            <div class="${cellClass}" data-room="${room}" data-slot="${slot}">
                <div class="room-name">${room}</div>
                <div class="room-content">${content}</div>
            </div>
        `;
    }

    renderScheduleStats() {
        const stats = {
            occupancy: 78,
            workload: 85,
            conflicts: 3
        };

        const statsContainer = document.querySelector('.schedule-stats .stats-grid');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="stat-item">
                    <div class="stat-label">Занятость кабинетов:</div>
                    <div class="stat-value">${stats.occupancy}%</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Нагрузка учителей:</div>
                    <div class="stat-value">${stats.workload}%</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Конфликты:</div>
                    <div class="stat-value warning">${stats.conflicts}</div>
                </div>
            `;
        }
    }

    async loadStaffData() {
        try {
            const response = await this.apiCall('/api/staff');
            this.staffData = response.staff || [];
            
            // Load featured staff
            this.renderFeaturedStaff();
            
            // Load AI analysis
            this.renderAIAnalysis();
            
            // Load technical staff table
            this.renderTechnicalStaff();
            
            // Load staff statistics
            this.renderStaffStatistics();

        } catch (error) {
            console.error('Error loading staff data:', error);
        }
    }

    renderFeaturedStaff() {
        const container = document.getElementById('featuredStaff');
        if (!container) return;

        // Get diverse staff members (admin, teacher, technical)
        const featured = this.staffData.slice(0, 3);
        
        container.innerHTML = featured.map(staff => this.renderStaffCard(staff)).join('');
    }

    renderStaffCard(staff) {
        const availability = this.getStaffAvailability(staff);
        const workload = this.getStaffWorkload(staff);
        
        return `
            <div class="staff-card">
                <div class="staff-avatar">
                    <span class="avatar-text">${staff.name?.charAt(0) || 'S'}</span>
                </div>
                <div class="staff-info">
                    <div class="staff-name">${staff.name}</div>
                    <div class="staff-role">${staff.role}</div>
                    <div class="staff-department">${staff.department}</div>
                </div>
                <div class="staff-status">
                    <div class="status-indicator ${availability}"></div>
                    <div class="status-text">${this.getAvailabilityText(availability)}</div>
                </div>
                <div class="staff-workload">
                    <div class="workload-bar">
                        <div class="workload-fill" style="width: ${workload}%"></div>
                    </div>
                    <div class="workload-text">${workload}% нагрузка</div>
                </div>
                <button class="profile-btn" onclick="aiDashboard.viewStaffProfile('${staff.id}')">
                    Профиль
                </button>
            </div>
        `;
    }

    getStaffAvailability(staff) {
        // Simulate availability based on staff data
        return Math.random() > 0.3 ? 'available' : 'busy';
    }

    getStaffWorkload(staff) {
        // Simulate workload percentage
        return Math.floor(Math.random() * 60) + 40;
    }

    getAvailabilityText(availability) {
        const textMap = {
            'available': 'Свободен',
            'busy': 'Занят',
            'overloaded': 'Перегружен',
            'substitution': 'На замене'
        };
        return textMap[availability] || 'Неизвестно';
    }

    renderAIAnalysis() {
        const analysis = {
            summary: 'Нагрузка административного персонала находится в пределах нормы. Рекомендуется оптимизировать расписание технического персонала для повышения эффективности на 15%.',
            recommendation: 'Пересмотреть график работы лаборантов'
        };

        const analysisContent = document.querySelector('.analysis-content');
        if (analysisContent) {
            analysisContent.innerHTML = `
                <div class="analysis-text">
                    <p>${analysis.summary}</p>
                </div>
                <div class="analysis-recommendation">
                    <span class="recommendation-label">Рекомендация:</span>
                    <span class="recommendation-text">${analysis.recommendation}</span>
                </div>
            `;
        }
    }

    renderTechnicalStaff() {
        const container = document.getElementById('technicalStaffBody');
        if (!container) return;

        // Filter technical staff
        const technicalStaff = this.staffData.filter(staff => 
            staff.type === 'technical' || staff.type === 'service'
        );

        container.innerHTML = technicalStaff.slice(0, 10).map(staff => `
            <tr>
                <td>${staff.name}</td>
                <td>${staff.role}</td>
                <td><span class="status-badge ${this.getStaffAvailability(staff)}">${this.getAvailabilityText(this.getStaffAvailability(staff))}</span></td>
                <td>${this.getTimeAgo(staff.last_activity)}</td>
                <td>
                    <button class="action-btn small" onclick="aiDashboard.viewStaffProfile('${staff.id}')">
                        Действия
                    </button>
                </td>
            </tr>
        `).join('');
    }

    renderStaffStatistics() {
        const stats = {
            total: this.staffData.length,
            attendance: 94,
            events: 3
        };

        const statsContainer = document.querySelector('.stats-overview');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="stat-overview-item">
                    <div class="stat-number">${stats.total}</div>
                    <div class="stat-label">Общее число</div>
                </div>
                <div class="stat-overview-item">
                    <div class="stat-number">${stats.attendance}%</div>
                    <div class="stat-label">Процент присутствия</div>
                </div>
                <div class="stat-overview-item">
                    <div class="stat-number">${stats.events}</div>
                    <div class="stat-label">Ближайшие события</div>
                </div>
            `;
        }
    }

    async loadKnowledgeData() {
        try {
            // Load regulations for knowledge base
            const response = await this.apiCall('/api/regulations');
            const regulations = response.regulations || [];
            
            // Render templates
            this.renderKnowledgeTemplates(regulations);
            
            // Load query history
            this.renderQueryHistory();

        } catch (error) {
            console.error('Error loading knowledge data:', error);
        }
    }

    renderKnowledgeTemplates(regulations) {
        const templates = [
            { icon: '📄', title: 'Приказ', type: 'order' },
            { icon: '📊', title: 'Отчёт', type: 'report' },
            { icon: '📝', title: 'Служебная записка', type: 'memo' },
            { icon: '✅', title: 'Проверка соответствия', type: 'compliance' }
        ];

        const container = document.querySelector('.templates-grid');
        if (container) {
            container.innerHTML = templates.map(template => `
                <div class="template-card">
                    <div class="template-icon">${template.icon}</div>
                    <div class="template-title">${template.title}</div>
                    <button class="template-btn" onclick="aiDashboard.createDocument('${template.type}')">
                        Создать
                    </button>
                </div>
            `).join('');
        }
    }

    renderQueryHistory() {
        const history = [
            { query: 'Приказ о проведении хакатона', date: '2 часа назад', type: 'order' },
            { query: 'Отчёт по посещаемости за сентябрь', date: '1 день назад', type: 'report' },
            { query: 'Шаблон служебной записки', date: '3 дня назад', type: 'memo' }
        ];

        const container = document.getElementById('queryHistory');
        if (container) {
            container.innerHTML = history.map(item => `
                <div class="history-item">
                    <div class="history-query">${item.query}</div>
                    <div class="history-meta">
                        <span class="history-date">${item.date}</span>
                        <span class="history-type">${item.type}</span>
                    </div>
                </div>
            `).join('');
        }
    }

    async loadIncidentsData() {
        try {
            const response = await this.apiCall('/api/incidents');
            const incidents = response.incidents || [];
            
            this.renderIncidentsGrid(incidents);
        } catch (error) {
            console.error('Error loading incidents data:', error);
        }
    }

    renderIncidentsGrid(incidents) {
        const container = document.getElementById('incidentsGrid');
        if (!container) return;

        container.innerHTML = incidents.map(incident => `
            <div class="incident-card ${incident.priority}">
                <div class="incident-header">
                    <div class="incident-type">${this.getIncidentTypeText(incident.type)}</div>
                    <div class="incident-priority">${incident.priority}</div>
                    <div class="incident-time">${this.getTimeAgo(incident.created_at)}</div>
                </div>
                <div class="incident-description">${incident.text}</div>
                <div class="incident-assignment">
                    <span>Ответственный: ${incident.assigned_to || 'Не назначен'}</span>
                    <div class="incident-actions">
                        <button class="action-btn small" onclick="aiDashboard.updateIncidentStatus('${incident.id}', 'in_progress')">
                            В работе
                        </button>
                        <button class="action-btn small" onclick="aiDashboard.updateIncidentStatus('${incident.id}', 'resolved')">
                            Решено
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Helper methods
    toggleNotifications() {
        const panel = document.getElementById('notificationPanel');
        if (panel) {
            panel.classList.toggle('active');
        }
    }

    closeNotifications() {
        const panel = document.getElementById('notificationPanel');
        if (panel) {
            panel.classList.remove('active');
        }
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
        }
    }

    performSearch(query) {
        // Implement search functionality
        console.log('Searching for:', query);
    }

    refreshAINotifications() {
        this.loadAINotifications();
        this.showToast('AI уведомления обновлены', 'success');
    }

    showAttendanceFilters() {
        this.showToast('Фильтры посещаемости в разработке', 'info');
    }

    exportAttendance() {
        this.showToast('Экспорт посещаемости в разработке', 'info');
    }

    loadScheduleForDate(date) {
        console.log('Loading schedule for date:', date);
    }

    filterStaff(searchTerm) {
        console.log('Filtering staff:', searchTerm);
    }

    submitKnowledgeQuery() {
        const queryInput = document.getElementById('knowledgeQuery');
        const query = queryInput?.value?.trim();
        
        if (query) {
            this.submitQuery(query);
            queryInput.value = '';
        }
    }

    clearKnowledgeQuery() {
        const queryInput = document.getElementById('knowledgeQuery');
        if (queryInput) {
            queryInput.value = '';
        }
    }

    async submitQuery(query) {
        try {
            // Simulate AI response
            this.showToast('Отправка запроса к AI...', 'info');
            
            // Add to history
            this.addToQueryHistory(query);
            
            // Simulate AI processing
            setTimeout(() => {
                this.showToast('AI обрабатывает ваш запрос...', 'info');
            }, 1000);

        } catch (error) {
            console.error('Error submitting query:', error);
            this.showToast('Ошибка отправки запроса', 'error');
        }
    }

    addToQueryHistory(query) {
        const historyContainer = document.getElementById('queryHistory');
        if (!historyContainer) return;

        const newHistoryItem = document.createElement('div');
        newHistoryItem.className = 'history-item';
        newHistoryItem.innerHTML = `
            <div class="history-query">${query}</div>
            <div class="history-meta">
                <span class="history-date">Только что</span>
                <span class="history-type">query</span>
            </div>
        `;
        
        historyContainer.insertBefore(newHistoryItem, historyContainer.firstChild);
    }

    openAIAnalytics() {
        this.showToast('AI Аналитика в разработке', 'info');
    }

    applySolution(type) {
        this.showToast(`Применение решения для ${type}`, 'success');
    }

    viewDetails(type) {
        this.showToast(`Просмотр деталей для ${type}`, 'info');
    }

    assignSubstitute(id) {
        this.showToast(`Назначение замены для инцидента ${id}`, 'success');
    }

    updateIncidentStatus(id, status) {
        this.showToast(`Обновление статуса инцидента ${id} на ${status}`, 'success');
    }

    viewStaffProfile(id) {
        this.showToast(`Просмотр профиля сотрудника ${id}`, 'info');
    }

    createDocument(type) {
        this.showToast(`Создание документа типа ${type}`, 'success');
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

    updateDateTime() {
        const updateDateTime = () => {
            const now = new Date();
            
            const dateElement = document.getElementById('currentDate');
            if (dateElement) {
                dateElement.textContent = now.toLocaleDateString('ru-RU', { 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                });
            }
            
            const timeElement = document.getElementById('currentTime');
            if (timeElement) {
                timeElement.textContent = now.toLocaleTimeString('ru-RU', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
            }
        };

        updateDateTime();
        setInterval(updateDateTime, 1000);
    }

    startRealTimeUpdates() {
        // Update data every 30 seconds
        this.refreshInterval = setInterval(() => {
            this.loadPageData(this.currentPage);
        }, 30000);
    }

    async loadInitialData() {
        await this.loadPageData('dashboard');
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
        // Create toast notification
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

// Initialize AI Dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.aiDashboard = new AIDashboard();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.aiDashboard) {
        window.aiDashboard.destroy();
    }
});
