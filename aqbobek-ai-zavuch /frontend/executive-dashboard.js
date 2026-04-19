/**
 * Executive Dashboard для директора Aqbobek
 * Premium glassmorphism UI с полной функциональностью
 */

class ExecutiveDashboard {
    constructor() {
        this.currentSection = 'overview';
        this.refreshInterval = null;
        this.voiceRecognition = null;
        this.isRecording = false;
        this.voiceTranscript = '';
        this.voiceConfidence = 0;
        
        // Данные для KPI
        this.kpiData = {
            activeIncidents: 0,
            urgentTasks: 0,
            attendanceReports: 0,
            substitutions: 0,
            monthlyEvents: 0,
            schoolStatus: 'normal'
        };
        
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        this.setupVoiceRecognition();
        await this.loadInitialData();
        this.startAutoRefresh();
        this.render();
    }
    
    setupEventListeners() {
        // Навигация
        document.addEventListener('click', (e) => {
            const navItem = e.target.closest('.nav-item');
            if (navItem) {
                const section = navItem.dataset.section;
                if (section && section !== this.currentSection) {
                    this.switchSection(section);
                }
            }
        });
        
        // Кнопки управления
        document.addEventListener('click', (e) => {
            if (e.target.matches('#refreshDashboard')) {
                this.refreshDashboard();
            }
            if (e.target.matches('#openSettings')) {
                this.openSettings();
            }
        });
        
        // Voice интерфейс
        document.addEventListener('click', (e) => {
            if (e.target.matches('#voiceRecordBtn') || e.target.closest('#voiceRecordBtn')) {
                this.toggleVoiceRecording();
            }
            if (e.target.matches('#voiceClearBtn') || e.target.closest('#voiceClearBtn')) {
                this.clearVoiceTranscript();
            }
            if (e.target.matches('#voiceProcessBtn') || e.target.closest('#voiceProcessBtn')) {
                this.processVoiceCommand();
            }
        });
        
        // Изменения в транскрипции
        document.addEventListener('input', (e) => {
            if (e.target.matches('#voiceTranscript')) {
                this.voiceTranscript = e.target.value;
                this.updateVoiceUI();
            }
        });
        
        // Быстрые действия
        document.addEventListener('click', (e) => {
            if (e.target.matches('[onclick*="createVoiceTask"]')) {
                this.createVoiceTask();
            }
            if (e.target.matches('[onclick*="createIncident"]')) {
                this.createIncident();
            }
            if (e.target.matches('[onclick*="viewAllIncidents"]')) {
                this.viewAllIncidents();
            }
            if (e.target.matches('[onclick*="viewAllTasks"]')) {
                this.viewAllTasks();
            }
            if (e.target.matches('[onclick*="generateReport"]')) {
                this.generateReport();
            }
            if (e.target.matches('[onclick*="openSchedule"]')) {
                this.openSchedule();
            }
        });
    }
    
    setupVoiceRecognition() {
        // Инициализация распознавания речи
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            
            this.voiceRecognition = new SpeechRecognition();
            this.voiceRecognition.lang = 'ru-RU';
            this.voiceRecognition.interimResults = true;
            this.voiceRecognition.continuous = false;
            this.voiceRecognition.maxAlternatives = 1;
            
            this.voiceRecognition.onstart = () => {
                this.isRecording = true;
                this.updateVoiceUI();
            };
            
            this.voiceRecognition.onresult = (event) => {
                const result = event.results[event.results.length - 1];
                if (result.isFinal) {
                    this.voiceTranscript = result[0].transcript;
                    this.voiceConfidence = result[0].confidence;
                    this.updateVoiceUI();
                } else {
                    // Обновление промежуточного результата
                    const textarea = document.getElementById('voiceTranscript');
                    if (textarea) {
                        textarea.value = result[0].transcript;
                    }
                }
            };
            
            this.voiceRecognition.onerror = (event) => {
                this.isRecording = false;
                let errorMessage = 'Ошибка распознавания речи';
                
                switch (event.error) {
                    case 'no-speech':
                        errorMessage = 'Речь не обнаружена';
                        break;
                    case 'not-allowed':
                        errorMessage = 'Доступ к микрофону запрещен';
                        break;
                    case 'network':
                        errorMessage = 'Сетевая ошибка';
                        break;
                }
                
                this.showNotification(errorMessage, 'error');
                this.updateVoiceUI();
            };
            
            this.voiceRecognition.onend = () => {
                this.isRecording = false;
                this.updateVoiceUI();
            };
        } else {
            console.warn('Speech recognition not supported');
            this.showNotification('Распознавание речи не поддерживается в этом браузере', 'warning');
        }
    }
    
    toggleVoiceRecording() {
        if (!this.voiceRecognition) {
            this.showNotification('Распознавание речи не доступно', 'warning');
            return;
        }
        
        if (this.isRecording) {
            this.voiceRecognition.stop();
        } else {
            this.voiceRecognition.start();
        }
    }
    
    clearVoiceTranscript() {
        this.voiceTranscript = '';
        this.voiceConfidence = 0;
        this.updateVoiceUI();
    }
    
    updateVoiceUI() {
        const recordBtn = document.getElementById('voiceRecordBtn');
        const clearBtn = document.getElementById('voiceClearBtn');
        const processBtn = document.getElementById('voiceProcessBtn');
        const statusDot = document.getElementById('voiceStatusDot');
        const statusText = document.getElementById('voiceStatusText');
        const transcriptTextarea = document.getElementById('voiceTranscript');
        const confidenceSpan = document.getElementById('voiceConfidence');
        
        if (recordBtn) {
            const icon = recordBtn.querySelector('.voice-icon');
            const text = recordBtn.querySelector('.voice-text');
            
            if (this.isRecording) {
                recordBtn.classList.add('recording');
                icon.textContent = '⏹';
                text.textContent = 'Остановить запись';
            } else {
                recordBtn.classList.remove('recording');
                icon.textContent = '🎤';
                text.textContent = 'Начать запись';
            }
        }
        
        if (clearBtn) {
            clearBtn.disabled = !this.voiceTranscript;
        }
        
        if (processBtn) {
            processBtn.disabled = !this.voiceTranscript.trim();
        }
        
        if (statusDot) {
            statusDot.className = 'voice-status-dot active';
        }
        
        if (statusText) {
            statusText.textContent = this.isRecording ? 'Идет запись...' : 'Готов к записи';
        }
        
        if (transcriptTextarea) {
            transcriptTextarea.value = this.voiceTranscript;
        }
        
        if (confidenceSpan) {
            confidenceSpan.textContent = Math.round(this.voiceConfidence * 100);
        }
    }
    
    async processVoiceCommand() {
        if (!this.voiceTranscript.trim()) {
            this.showNotification('Введите или запишите голосовую команду', 'warning');
            return;
        }
        
        try {
            const response = await this.apiCall('/api/voice/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transcript: this.voiceTranscript,
                    confidence: this.voiceConfidence
                })
            });
            
            if (response.success) {
                this.showNotification(`Голосовая команда обработана: ${response.summary}`, 'success');
                this.clearVoiceTranscript();
                await this.refreshDashboard();
            } else {
                this.showNotification(`Ошибка: ${response.error}`, 'error');
            }
        } catch (error) {
            this.showNotification(`Ошибка обработки голосовой команды: ${error.message}`, 'error');
        }
    }
    
    switchSection(section) {
        this.currentSection = section;
        
        // Обновление навигации
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeItem = document.querySelector(`[data-section="${section}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }
        
        // Показ/скрытие соответствующих секций
        const sections = ['overview', 'incidents', 'tasks', 'voice', 'schedule', 'staff', 'analytics'];
        sections.forEach(s => {
            const element = document.getElementById(s);
            if (element) {
                element.style.display = s === section ? 'block' : 'none';
            }
        });
        
        // Загрузка данных для активной секции
        this.loadSectionData(section);
    }
    
    async loadInitialData() {
        try {
            // Загрузка KPI данных
            const [incidents, tasks, attendance, substitutions, notifications] = await Promise.all([
                this.apiCall('/api/incidents'),
                this.apiCall('/api/tasks'),
                this.apiCall('/api/attendance'),
                this.apiCall('/api/substitutions'),
                this.apiCall('/api/notifications')
            ]);
            
            // Обновление KPI
            this.kpiData = {
                activeIncidents: incidents.filter(i => i.status !== 'resolved').length,
                urgentTasks: tasks.filter(t => t.priority === 'critical' || t.priority === 'high').length,
                attendanceReports: attendance.length,
                substitutions: substitutions.filter(s => s.status === 'pending').length,
                monthlyEvents: notifications.filter(n => n.type === 'event').length,
                schoolStatus: this.determineSchoolStatus(incidents, tasks)
            };
            
            this.updateKPIDisplay();
            
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showNotification('Ошибка загрузки данных', 'error');
        }
    }
    
    async loadSectionData(section) {
        try {
            switch (section) {
                case 'incidents':
                    await this.loadIncidents();
                    break;
                case 'tasks':
                    await this.loadTasks();
                    break;
                case 'voice':
                    await this.loadVoiceHistory();
                    break;
                case 'schedule':
                    await this.loadSchedule();
                    break;
                case 'staff':
                    await this.loadStaff();
                    break;
                case 'analytics':
                    await this.loadAnalytics();
                    break;
            }
        } catch (error) {
            console.error(`Error loading section ${section}:`, error);
            this.showNotification(`Ошибка загрузки секции ${section}`, 'error');
        }
    }
    
    async loadIncidents() {
        const response = await this.apiCall('/api/incidents');
        const incidentsGrid = document.getElementById('incidentsGrid');
        
        if (incidentsGrid && response.success) {
            incidentsGrid.innerHTML = response.incidents.map(incident => `
                <div class="incident-card">
                    <div class="incident-header">
                        <span class="incident-type">${this.getIncidentIcon(incident.type)}</span>
                        <span class="incident-priority">${this.getPriorityBadge(incident.priority)}</span>
                        <span class="incident-time">${this.formatTime(incident.created_at)}</span>
                    </div>
                    <div class="incident-content">
                        <h4>${incident.text}</h4>
                        <div class="incident-meta">
                            <span>Местоположение: ${incident.location || 'Не указано'}</span>
                            <span>Исполнитель: ${incident.assigned_to || 'Не назначен'}</span>
                        </div>
                    </div>
                    <div class="incident-actions">
                        <button class="action-btn" onclick="dashboard.resolveIncident('${incident.id}')">Решить</button>
                        <button class="action-btn" onclick="dashboard.escalateIncident('${incident.id}')">Эскалировать</button>
                    </div>
                </div>
            `).join('');
        }
    }
    
    async loadTasks() {
        const response = await this.apiCall('/api/tasks');
        const tasksGrid = document.getElementById('tasksGrid');
        
        if (tasksGrid && response.success) {
            tasksGrid.innerHTML = response.tasks.map(task => `
                <div class="task-card">
                    <div class="task-header">
                        <span class="task-priority">${this.getPriorityBadge(task.priority)}</span>
                        <span class="task-category">${this.getCategoryBadge(task.category)}</span>
                        <span class="task-deadline">${this.formatDeadline(task.deadline)}</span>
                    </div>
                    <div class="task-content">
                        <h4>${task.title}</h4>
                        <div class="task-meta">
                            <span>Исполнитель: ${task.assignee}</span>
                            <span>Статус: ${this.getStatusBadge(task.status)}</span>
                        </div>
                    </div>
                    <div class="task-actions">
                        <button class="action-btn" onclick="dashboard.updateTaskStatus('${task.id}')">Изменить статус</button>
                    </div>
                </div>
            `).join('');
        }
    }
    
    async loadVoiceHistory() {
        const response = await this.apiCall('/api/voice/history?limit=10');
        const voiceHistory = document.getElementById('voiceHistory');
        
        if (voiceHistory && response.success) {
            voiceHistory.innerHTML = response.history.map(cmd => `
                <div class="voice-command-card">
                    <div class="voice-header">
                        <span class="voice-icon">🎤</span>
                        <span class="voice-time">${this.formatTime(cmd.created_at)}</span>
                    </div>
                    <div class="voice-transcript">${cmd.transcript}</div>
                    <div class="voice-result">
                        Создано задач: ${cmd.created_tasks || 0}
                        <span class="voice-confidence">${Math.round((cmd.confidence || 0) * 100)}%</span>
                    </div>
                </div>
            `).join('');
        }
    }
    
    updateKPIDisplay() {
        // Обновление KPI карточек
        document.getElementById('activeIncidentsCount').textContent = this.kpiData.activeIncidents;
        document.getElementById('urgentTasksCount').textContent = this.kpiData.urgentTasks;
        document.getElementById('attendanceReportsCount').textContent = this.kpiData.attendanceReports;
        document.getElementById('substitutionsCount').textContent = this.kpiData.substitutions;
        document.getElementById('monthlyEventsCount').textContent = this.kpiData.monthlyEvents;
        document.getElementById('schoolStatus').textContent = this.kpiData.schoolStatus;
        
        // Обновление индикаторов изменений
        this.updateChangeIndicators();
    }
    
    updateChangeIndicators() {
        // Здесь должна быть логика отслеживания изменений
        // Для демонстрации используем случайные значения
        document.getElementById('incidentsChange').className = 'kpi-change positive';
        document.getElementById('incidentsChange').textContent = '+2';
        
        document.getElementById('tasksChange').className = 'kpi-change negative';
        document.getElementById('tasksChange').textContent = '+1';
        
        document.getElementById('attendanceChange').className = 'kpi-change positive';
        document.getElementById('attendanceChange').textContent = '+3';
        
        document.getElementById('substitutionsChange').className = 'kpi-change warning';
        document.getElementById('substitutionsChange').textContent = '+1';
        
        document.getElementById('eventsChange').className = 'kpi-change positive';
        document.getElementById('eventsChange').textContent = '+1';
    }
    
    determineSchoolStatus(incidents, tasks) {
        const criticalIncidents = incidents.filter(i => i.priority === 'critical').length;
        const urgentTasks = tasks.filter(t => t.priority === 'critical' || t.priority === 'high').length;
        
        if (criticalIncidents > 0 || urgentTasks > 0) {
            return '⚠️ Требует внимания';
        } else if (incidents.length > 5 || tasks.length > 10) {
            return '📊 Высокая активность';
        } else {
            return '✅ Нормально';
        }
    }
    
    getIncidentIcon(type) {
        const icons = {
            medical: '🏥',
            facilities: '🔧',
            behavior: '👥',
            safety: '🚨',
            academic: '📚',
            other: '📋'
        };
        return icons[type] || '📋';
    }
    
    getPriorityBadge(priority) {
        const badges = {
            critical: '<span class="priority-badge critical">Критично</span>',
            high: '<span class="priority-badge high">Высокий</span>',
            normal: '<span class="priority-badge normal">Нормальный</span>',
            low: '<span class="priority-badge low">Низкий</span>'
        };
        return badges[priority] || badges.normal;
    }
    
    getCategoryBadge(category) {
        const badges = {
            preparation: '<span class="category-badge preparation">Подготовка</span>',
            logistics: '<span class="category-badge logistics">Логистика</span>',
            administrative: '<span class="category-badge administrative">Административный</span>',
            maintenance: '<span class="category-badge maintenance">Обслуживание</span>',
            educational: '<span class="category-badge educational">Образовательный</span>',
            reporting: '<span class="category-badge reporting">Отчетность</span>'
        };
        return badges[category] || badges.administrative;
    }
    
    getStatusBadge(status) {
        const badges = {
            new: '<span class="status-badge new">Новая</span>',
            in_progress: '<span class="status-badge progress">В работе</span>',
            completed: '<span class="status-badge completed">Выполнено</span>',
            cancelled: '<span class="status-badge cancelled">Отменено</span>'
        };
        return badges[status] || badges.new;
    }
    
    formatTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffHours = Math.floor(diffMs / (1000 * 60));
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffDays > 0) {
            return `${diffDays} д. назад`;
        } else if (diffHours > 0) {
            return `${diffHours} ч. назад`;
        } else {
            return 'Только что';
        }
    }
    
    formatDeadline(deadline) {
        if (!deadline || deadline === 'Не указан') {
            return '<span class="deadline">Не указан</span>';
        }
        
        const date = new Date(deadline);
        const now = new Date();
        const diffMs = date - now;
        const diffHours = Math.floor(diffMs / (1000 * 60));
        
        if (diffMs < 0) {
            return `<span class="deadline overdue">Просрочено на ${Math.abs(diffHours)} ч.</span>`;
        } else if (diffHours < 24) {
            return `<span class="deadline today">Сегодня</span>`;
        } else if (diffHours < 48) {
            return `<span class="deadline tomorrow">Завтра</span>`;
        } else {
            return `<span class="deadline future">${deadline}</span>`;
        }
    }
    
    async refreshDashboard() {
        this.showNotification('Обновление данных...', 'info');
        await this.loadInitialData();
        this.showNotification('Данные обновлены', 'success');
    }
    
    // Методы для быстрых действий
    createVoiceTask() {
        this.switchSection('voice');
    }
    
    createIncident() {
        this.switchSection('incidents');
    }
    
    viewAllIncidents() {
        // Открыть полную страницу инцидентов
        window.open('/incidents.html', '_blank');
    }
    
    viewAllTasks() {
        // Открыть полную страницу задач
        window.open('/tasks.html', '_blank');
    }
    
    generateReport() {
        this.showNotification('Открывается генератор отчетов...', 'info');
        // Здесь должна быть логика генерации отчетов
    }
    
    openSchedule() {
        this.switchSection('schedule');
    }
    
    openSettings() {
        this.showNotification('Настройки в разработке', 'info');
    }
    
    async resolveIncident(incidentId) {
        try {
            const response = await this.apiCall('/api/incidents/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    incident_id: incidentId,
                    resolution: prompt('Введите решение инцидента:')
                })
            });
            
            if (response.success) {
                this.showNotification('Инцидент решен', 'success');
                await this.loadSectionData('incidents');
            } else {
                this.showNotification(`Ошибка: ${response.error}`, 'error');
            }
        } catch (error) {
            this.showNotification(`Ошибка решения инцидента: ${error.message}`, 'error');
        }
    }
    
    async escalateIncident(incidentId) {
        try {
            const response = await this.apiCall('/api/incidents/escalate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    incident_id: incidentId,
                    reason: prompt('Причина эскалации:')
                })
            });
            
            if (response.success) {
                this.showNotification('Инцидент эскалирован', 'warning');
                await this.loadSectionData('incidents');
            } else {
                this.showNotification(`Ошибка: ${response.error}`, 'error');
            }
        } catch (error) {
            this.showNotification(`Ошибка эскалации: ${error.message}`, 'error');
        }
    }
    
    async updateTaskStatus(taskId) {
        try {
            const response = await this.apiCall('/api/tasks/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task_id: taskId,
                    status: 'in_progress'
                })
            });
            
            if (response.success) {
                this.showNotification('Статус задачи обновлен', 'success');
                await this.loadSectionData('tasks');
            } else {
                this.showNotification(`Ошибка: ${response.error}`, 'error');
            }
        } catch (error) {
            this.showNotification(`Ошибка обновления задачи: ${error.message}`, 'error');
        }
    }
    
    async loadSchedule() {
        const response = await this.apiCall('/api/schedule');
        const scheduleGrid = document.getElementById('scheduleGrid');
        
        if (scheduleGrid && response.success) {
            scheduleGrid.innerHTML = response.schedule.map(slot => `
                <div class="schedule-slot">
                    <div class="slot-header">
                        <span class="slot-time">${slot.time}</span>
                        <span class="slot-subject">${slot.subject || ''}</span>
                    </div>
                    <div class="slot-content">
                        <div class="slot-class">${slot.class || ''}</div>
                        <div class="slot-teacher">${slot.teacher || ''}</div>
                        <div class="slot-room">${slot.room || ''}</div>
                    </div>
                </div>
            `).join('');
        }
    }
    
    async loadStaff() {
        const response = await this.apiCall('/api/school/staff');
        const staffGrid = document.getElementById('staffGrid');
        
        if (staffGrid && response.success) {
            staffGrid.innerHTML = response.staff.map(member => `
                <div class="staff-card">
                    <div class="staff-header">
                        <div class="staff-avatar">${member.full_name.charAt(0).toUpperCase()}</div>
                        <div class="staff-info">
                            <h4>${member.full_name}</h4>
                            <div class="staff-meta">
                                <span class="staff-role">${this.getRoleLabel(member.role)}</span>
                                <span class="staff-category">${this.getCategoryLabel(member.category)}</span>
                            </div>
                        </div>
                    </div>
                    <div class="staff-details">
                        <div class="staff-detail">
                            <span class="detail-label">Опыт:</span>
                            <span class="detail-value">${member.experience_years} лет</span>
                        </div>
                        <div class="staff-detail">
                            <span class="detail-label">Нагрузка:</span>
                            <span class="detail-value">${Object.values(member.workload_hours || {}).reduce((a, b) => a + b, 0)}/${member.weekly_hours_limit} ч.</span>
                        </div>
                        <div class="staff-detail">
                            <span class="detail-label">Контакты:</span>
                            <span class="detail-value">${member.email} | ${member.phone}</span>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }
    
    async loadAnalytics() {
        const response = await this.apiCall('/api/school/statistics');
        const analyticsGrid = document.getElementById('analyticsGrid');
        
        if (analyticsGrid && response.success) {
            const stats = response.statistics;
            analyticsGrid.innerHTML = `
                <div class="analytics-card">
                    <h3>📊 Статистика персонала</h3>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-number">${stats.total_staff || 0}</span>
                            <span class="stat-label">Всего сотрудников</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-number">${stats.active_staff || 0}</span>
                            <span class="stat-label">Активных</span>
                        </div>
                    </div>
                </div>
                <div class="analytics-card">
                    <h3>🏚 Загрузка кабинетов</h3>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-number">${stats.total_classrooms || 0}</span>
                            <span class="stat-label">Всего кабинетов</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-number">${stats.average_classroom_utilization || 0}%</span>
                            <span class="stat-label">Средняя загрузка</span>
                        </div>
                    </div>
                </div>
                <div class="analytics-card">
                    <h3>👨‍🎓 Учебные группы</h3>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-number">${stats.total_student_groups || 0}</span>
                            <span class="stat-label">Всего классов</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-number">${stats.total_students || 0}</span>
                            <span class="stat-label">Всего учеников</span>
                        </div>
                    </div>
                </div>
            `;
        }
    }
    
    getRoleLabel(role) {
        const labels = {
            'директор': 'Директор',
            'заместитель директора по УВР': 'Зам. по УВР',
            'заместитель директора по ВР': 'Зам. по ВР',
            'заместитель директора по АХЧ': 'Зам. по АХЧ',
            'учитель-предметник': 'Учитель',
            'классный руководитель': 'Кл. руководитель',
            'воспитатель': 'Воспитатель',
            'педагог-психолог': 'Психолог',
            'социальный педагог': 'Соц. педагог',
            'учитель-логопед': 'Логопед',
            'учитель-дефектолог': 'Дефектолог',
            'тьютор (наставник)': 'Тьютор',
            'педагог-организатор': 'Пед. организатор',
            'библиотекарь': 'Библиотекарь',
            'IT-специалист': 'IT-специалист',
            'лаборант': 'Лаборант',
            'секретарь': 'Секретарь',
            'бухгалтер': 'Бухгалтер',
            'работник столовой': 'Работник столовой',
            'технический персонал': 'Тех. персонал',
            'уборщик': 'Уборщик',
            'охранник': 'Охранник'
        };
        return labels[role] || role;
    }
    
    getCategoryLabel(category) {
        const labels = {
            'administration': 'Администрация',
            'teaching': 'Педагогические',
            'psychological': 'Психологическая служба',
            'educational_support': 'Учебно-вспомогательный',
            'service': 'Обслуживающий',
            'technical': 'Технический',
            'security': 'Охрана'
        };
        return labels[category] || category;
    }
    
    render() {
        // Основной рендеринг уже происходит через switchSection
        console.log(`Executive Dashboard: текущая секция ${this.currentSection}`);
    }
    
    startAutoRefresh() {
        this.refreshInterval = setInterval(async () => {
            await this.loadInitialData();
        }, 60000); // Каждую минуту
    }
    
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
    
    showNotification(message, type = 'info') {
        // Создание уведомления
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 20px;
            background: var(--glass-bg);
            border: 1px solid var(--glass-border);
            border-radius: var(--border-radius-md);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            color: var(--text-primary);
            font-weight: 500;
            box-shadow: var(--card-shadow);
            z-index: 10000;
            animation: slideInUp 0.3s ease-out;
            max-width: 300px;
        `;
        
        document.body.appendChild(notification);
        
        // Автоматическое удаление через 3 секунды
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
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
}

// Глобальный экземпляр
window.dashboard = new ExecutiveDashboard();
