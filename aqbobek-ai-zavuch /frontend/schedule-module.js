/**
 * Schedule Module - Advanced School Operations Scheduling System
 * Premium dashboard for comprehensive schedule management
 */

class ScheduleModule {
    constructor() {
        this.currentView = 'grid';
        this.viewType = 'class';
        this.currentDay = 'all';
        this.showConflicts = true;
        this.showHeatmap = false;
        this.scheduleData = {
            classes: [],
            teachers: [],
            rooms: [],
            staff: [],
            conflicts: [],
            freeStaff: []
        };
        this.refreshInterval = null;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupFilters();
        this.startRealTimeUpdates();
        await this.loadScheduleData();
        this.renderSchedule();
    }

    setupEventListeners() {
        // View type controls
        document.getElementById('viewType')?.addEventListener('change', (e) => {
            this.viewType = e.target.value;
            this.renderSchedule();
        });

        // Day filter
        document.getElementById('dayFilter')?.addEventListener('change', (e) => {
            this.currentDay = e.target.value;
            this.renderSchedule();
        });

        // Entity filter
        document.getElementById('entityFilter')?.addEventListener('input', (e) => {
            this.filterByEntity(e.target.value);
        });

        // Conflict toggle
        document.getElementById('conflictToggle')?.addEventListener('change', (e) => {
            this.showConflicts = e.target.checked;
            this.renderSchedule();
        });

        // Heatmap toggle
        document.getElementById('heatmapToggle')?.addEventListener('change', (e) => {
            this.showHeatmap = e.target.checked;
            this.toggleHeatmap();
        });

        // View controls
        document.querySelectorAll('.grid-view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.grid-view-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.currentView = e.currentTarget.dataset.view;
                this.renderSchedule();
            });
        });

        // Header actions
        document.getElementById('refreshSchedule')?.addEventListener('click', () => {
            this.refreshSchedule();
        });

        document.getElementById('exportSchedule')?.addEventListener('click', () => {
            this.exportSchedule();
        });

        document.getElementById('createSchedule')?.addEventListener('click', () => {
            this.showCreateModal();
        });

        // Detail controls
        document.getElementById('detailTimeSlot')?.addEventListener('change', () => {
            this.renderDetailedSchedule();
        });

        // Free staff finder
        document.getElementById('freeTimeSlot')?.addEventListener('change', () => {
            this.updateFreeStaff();
        });

        document.getElementById('freeDay')?.addEventListener('change', () => {
            this.updateFreeStaff();
        });

        // Modal controls
        document.getElementById('modalClose')?.addEventListener('click', () => {
            this.hideModal();
        });

        document.getElementById('modalCancel')?.addEventListener('click', () => {
            this.hideModal();
        });

        document.getElementById('modalSave')?.addEventListener('click', () => {
            this.saveScheduleEntry();
        });

        // Toast close
        document.getElementById('toastClose')?.addEventListener('click', () => {
            this.hideToast();
        });
    }

    setupFilters() {
        // Initialize filter states
        this.filters = {
            viewType: this.viewType,
            day: this.currentDay,
            entity: '',
            showConflicts: this.showConflicts,
            showHeatmap: this.showHeatmap
        };
    }

    async loadScheduleData() {
        this.showLoading();
        
        try {
            // Load schedule data from backend API
            const [
                scheduleResponse,
                staffResponse,
                conflictsResponse
            ] = await Promise.all([
                this.apiCall('/api/schedule'),
                this.apiCall('/api/school/staff'),
                this.apiCall('/api/schedule/conflicts')
            ]);

            this.scheduleData.schedule = scheduleResponse.ok ? scheduleResponse.data || {} : {};
            this.scheduleData.staff = staffResponse.ok ? staffResponse.staff || [] : [];
            this.scheduleData.conflicts = conflictsResponse.ok ? conflictsResponse.conflicts || [] : [];

            // Process schedule data
            this.processScheduleData();
            this.updateOverviewStats();
            this.renderSchedule();
            this.renderConflicts();
            this.updateFreeStaff();

        } catch (error) {
            console.error('Error loading schedule data:', error);
            this.showToast('Error loading schedule data', 'error');
        } finally {
            this.hideLoading();
        }
    }

    processScheduleData() {
        // Process schedule data into different views
        const schedule = this.scheduleData.schedule;
        
        // Extract classes, teachers, rooms from schedule
        this.scheduleData.classes = this.extractClassesFromSchedule(schedule);
        this.scheduleData.teachers = this.extractTeachersFromSchedule(schedule);
        this.scheduleData.rooms = this.extractRoomsFromSchedule(schedule);
        this.scheduleData.staffSchedule = this.extractStaffSchedule(schedule);
    }

    extractClassesFromSchedule(schedule) {
        const classes = [];
        
        if (schedule.group_schedules) {
            Object.entries(schedule.group_schedules).forEach(([className, classSchedule]) => {
                classes.push({
                    name: className,
                    schedule: classSchedule,
                    workload: classSchedule.length,
                    conflicts: this.detectConflicts(classSchedule)
                });
            });
        }
        
        return classes;
    }

    extractTeachersFromSchedule(schedule) {
        const teachers = [];
        
        if (schedule.teacher_schedules) {
            Object.entries(schedule.teacher_schedules).forEach(([teacherName, teacherSchedule]) => {
                teachers.push({
                    name: teacherName,
                    schedule: teacherSchedule,
                    workload: teacherSchedule.length,
                    subjects: this.extractSubjects(teacherSchedule),
                    rooms: this.extractRooms(teacherSchedule),
                    conflicts: this.detectConflicts(teacherSchedule)
                });
            });
        }
        
        return teachers;
    }

    extractRoomsFromSchedule(schedule) {
        const rooms = [];
        
        if (schedule.room_schedules) {
            Object.entries(schedule.room_schedules).forEach(([roomName, roomSchedule]) => {
                rooms.push({
                    name: roomName,
                    schedule: roomSchedule,
                    occupancy: roomSchedule.length,
                    conflicts: this.detectConflicts(roomSchedule)
                });
            });
        }
        
        return rooms;
    }

    extractStaffSchedule(schedule) {
        const staffSchedule = [];
        
        // Extract staff schedule from general schedule data
        if (schedule.staff_schedules) {
            Object.entries(schedule.staff_schedules).forEach(([staffName, staffSchedule]) => {
                staffSchedule.push({
                    name: staffName,
                    schedule: staffSchedule,
                    workload: staffSchedule.length,
                    conflicts: this.detectConflicts(staffSchedule)
                });
            });
        }
        
        return staffSchedule;
    }

    extractSubjects(schedule) {
        const subjects = new Set();
        schedule.forEach(item => {
            if (item.subject) subjects.add(item.subject);
        });
        return Array.from(subjects);
    }

    extractRooms(schedule) {
        const rooms = new Set();
        schedule.forEach(item => {
            if (item.room) rooms.add(item.room);
        });
        return Array.from(rooms);
    }

    detectConflicts(schedule) {
        const conflicts = [];
        const timeSlots = {};
        
        schedule.forEach(item => {
            const key = `${item.day}_${item.lesson}`;
            if (!timeSlots[key]) {
                timeSlots[key] = [];
            }
            timeSlots[key].push(item);
        });
        
        Object.values(timeSlots).forEach(slots => {
            if (slots.length > 1) {
                conflicts.push({
                    time: slots[0].day + ' Lesson ' + slots[0].lesson,
                    items: slots,
                    type: 'time_conflict'
                });
            }
        });
        
        return conflicts;
    }

    renderSchedule() {
        const container = document.getElementById('scheduleGrid');
        if (!container) return;

        let data = [];
        
        switch (this.viewType) {
            case 'class':
                data = this.scheduleData.classes;
                break;
            case 'teacher':
                data = this.scheduleData.teachers;
                break;
            case 'room':
                data = this.scheduleData.rooms;
                break;
            case 'day':
                data = this.getScheduleByDay();
                break;
            case 'employee':
                data = this.getScheduleByEmployeeType();
                break;
        }

        // Apply filters
        data = this.applyFilters(data);

        // Render based on current view
        switch (this.currentView) {
            case 'grid':
                this.renderGridView(container, data);
                break;
            case 'list':
                this.renderListView(container, data);
                break;
            case 'timeline':
                this.renderTimelineView(container, data);
                break;
        }

        this.renderDetailedSchedule();
    }

    renderGridView(container, data) {
        container.innerHTML = `
            <div class="schedule-grid-items">
                ${data.map(item => this.renderScheduleItem(item)).join('')}
            </div>
        `;
    }

    renderListView(container, data) {
        container.innerHTML = `
            <div class="schedule-list-items">
                ${data.map(item => this.renderScheduleListItem(item)).join('')}
            </div>
        `;
    }

    renderTimelineView(container, data) {
        container.innerHTML = `
            <div class="timeline-view">
                ${this.renderTimeline(data)}
            </div>
        `;
    }

    renderScheduleItem(item) {
        const hasConflicts = item.conflicts && item.conflicts.length > 0;
        const workloadClass = this.getWorkloadClass(item.workload);
        const heatmapClass = this.showHeatmap ? `heatmap-${workloadClass}` : '';
        
        return `
            <div class="schedule-item ${hasConflicts ? 'conflict' : ''} ${heatmapClass}">
                <div class="schedule-item-header">
                    <div class="schedule-entity">${item.name}</div>
                    <div class="schedule-type">${this.viewType}</div>
                </div>
                <div class="schedule-details">
                    <div class="schedule-detail">
                        <span class="detail-label">Workload:</span>
                        <span class="detail-value">${item.workload} lessons</span>
                    </div>
                    ${item.subjects ? `
                        <div class="schedule-detail">
                            <span class="detail-label">Subjects:</span>
                            <span class="detail-value">${item.subjects.slice(0, 3).join(', ')}</span>
                        </div>
                    ` : ''}
                    ${item.rooms ? `
                        <div class="schedule-detail">
                            <span class="detail-label">Rooms:</span>
                            <span class="detail-value">${item.rooms.slice(0, 3).join(', ')}</span>
                        </div>
                    ` : ''}
                    ${hasConflicts ? `
                        <div class="schedule-detail">
                            <span class="detail-label">Conflicts:</span>
                            <span class="detail-value conflict">${item.conflicts.length}</span>
                        </div>
                    ` : ''}
                </div>
                <div class="schedule-actions">
                    <button class="action-btn small" onclick="scheduleModule.viewDetails('${item.name}')">
                        View Details
                    </button>
                </div>
            </div>
        `;
    }

    renderScheduleListItem(item) {
        const hasConflicts = item.conflicts && item.conflicts.length > 0;
        
        return `
            <div class="schedule-list-item ${hasConflicts ? 'conflict' : ''}">
                <div class="list-item-header">
                    <div class="list-item-title">${item.name}</div>
                    <div class="list-item-meta">
                        <span class="workload-badge">${item.workload} lessons</span>
                        ${hasConflicts ? `<span class="conflict-badge">${item.conflicts.length} conflicts</span>` : ''}
                    </div>
                </div>
                <div class="list-item-content">
                    ${this.renderScheduleListContent(item)}
                </div>
            </div>
        `;
    }

    renderScheduleListContent(item) {
        if (item.schedule && item.schedule.length > 0) {
            return `
                <div class="schedule-list-details">
                    ${item.schedule.slice(0, 5).map(slot => `
                        <div class="schedule-slot">
                            <span class="slot-time">${slot.day} Lesson ${slot.lesson}</span>
                            <span class="slot-subject">${slot.subject || 'N/A'}</span>
                            <span class="slot-room">${slot.room || 'N/A'}</span>
                        </div>
                    `).join('')}
                    ${item.schedule.length > 5 ? '<div class="more-slots">... and more</div>' : ''}
                </div>
            `;
        }
        return '<div class="no-schedule">No schedule data available</div>';
    }

    renderTimeline(data) {
        const timeSlots = ['1', '2', '3', '4', '5', '6', '7'];
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
        
        return timeSlots.map(lesson => `
            <div class="timeline-slot">
                <div class="timeline-time">Lesson ${lesson}</div>
                <div class="timeline-items">
                    ${data.map(item => this.renderTimelineItem(item, lesson)).join('')}
                </div>
            </div>
        `).join('');
    }

    renderTimelineItem(item, lesson) {
        const schedule = item.schedule || [];
        const lessonSchedule = schedule.filter(slot => slot.lesson == lesson);
        
        if (lessonSchedule.length === 0) return '';
        
        return lessonSchedule.map(slot => `
            <div class="timeline-item ${slot.conflict ? 'conflict' : ''}">
                <div class="timeline-entity">${item.name}</div>
                <div class="timeline-details">
                    <span class="timeline-subject">${slot.subject || ''}</span>
                    <span class="timeline-room">${slot.room || ''}</span>
                </div>
            </div>
        `).join('');
    }

    renderDetailedSchedule() {
        const container = document.getElementById('scheduleDetails');
        if (!container) return;

        const timeSlot = document.getElementById('detailTimeSlot')?.value || 'all';
        
        let data = [];
        switch (this.viewType) {
            case 'class':
                data = this.scheduleData.classes;
                break;
            case 'teacher':
                data = this.scheduleData.teachers;
                break;
            case 'room':
                data = this.scheduleData.rooms;
                break;
        }

        container.innerHTML = `
            <div class="detailed-schedule-grid">
                ${data.map(item => this.renderDetailedScheduleItem(item, timeSlot)).join('')}
            </div>
        `;
    }

    renderDetailedScheduleItem(item, timeSlot) {
        let schedule = item.schedule || [];
        
        if (timeSlot !== 'all') {
            schedule = schedule.filter(slot => slot.lesson == timeSlot);
        }

        return `
            <div class="detailed-schedule-item">
                <div class="detailed-header">
                    <h4 class="detailed-title">${item.name}</h4>
                    <div class="detailed-meta">
                        <span class="meta-item">${schedule.length} lessons</span>
                        ${item.conflicts && item.conflicts.length > 0 ? 
                            `<span class="meta-item conflict">${item.conflicts.length} conflicts</span>` : ''}
                    </div>
                </div>
                <div class="detailed-content">
                    ${schedule.map(slot => this.renderScheduleSlot(slot)).join('')}
                </div>
            </div>
        `;
    }

    renderScheduleSlot(slot) {
        const roomInfo = slot.room ? `<span class="schedule-room">${slot.room}</span>` : '';
        const conflictClass = slot.conflict ? 'conflict' : '';
        
        return `
            <div class="schedule-slot-item ${conflictClass}">
                <div class="slot-header">
                    <span class="slot-day">${slot.day}</span>
                    <span class="slot-lesson">Lesson ${slot.lesson}</span>
                </div>
                <div class="slot-content">
                    <span class="slot-subject">${slot.subject || 'N/A'}</span>
                    ${roomInfo}
                </div>
            </div>
        `;
    }

    renderConflicts() {
        const container = document.getElementById('conflictGrid');
        const countElement = document.getElementById('totalConflicts');
        
        if (!container) return;

        const conflicts = this.scheduleData.conflicts || [];
        
        if (countElement) {
            countElement.textContent = conflicts.length;
        }

        container.innerHTML = conflicts.length > 0 ? 
            conflicts.map(conflict => this.renderConflictItem(conflict)).join('') :
            '<div class="no-conflicts">No conflicts detected</div>';
    }

    renderConflictItem(conflict) {
        return `
            <div class="conflict-item">
                <div class="conflict-header-item">
                    ${conflict.type === 'time_conflict' ? 'Time Conflict' : 'Resource Conflict'}
                </div>
                <div class="conflict-description">
                    ${conflict.time}: ${conflict.items.map(item => 
                        `${item.entity || 'Unknown'} (${item.subject || 'N/A'})`
                    ).join(', ')}
                </div>
                <div class="conflict-resolution">
                    Suggested: Check room availability and teacher assignments
                </div>
            </div>
        `;
    }

    updateFreeStaff() {
        const container = document.getElementById('freeStaffGrid');
        if (!container) return;

        const timeSlot = document.getElementById('freeTimeSlot')?.value || 'current';
        const day = document.getElementById('freeDay')?.value || 'today';
        
        const freeStaff = this.findFreeStaff(timeSlot, day);
        
        container.innerHTML = freeStaff.map(staff => this.renderFreeStaffItem(staff)).join('');
    }

    renderFreeStaffItem(staff) {
        return `
            <div class="free-staff-item">
                <div class="free-staff-name">${staff.name}</div>
                <div class="free-staff-role">${staff.role}</div>
                <div class="free-staff-availability">
                    <div class="availability-dot"></div>
                    Available
                </div>
            </div>
        `;
    }

    findFreeStaff(timeSlot, day) {
        const allStaff = this.scheduleData.staff || [];
        const busyStaff = new Set();
        
        // Find busy staff for the given time slot
        allStaff.forEach(staff => {
            if (staff.schedule) {
                staff.schedule.forEach(slot => {
                    if (this.isTimeSlotMatch(slot, timeSlot, day)) {
                        busyStaff.add(staff.name);
                    }
                });
            }
        });
        
        // Return free staff
        return allStaff.filter(staff => !busyStaff.has(staff.name));
    }

    isTimeSlotMatch(slot, timeSlot, day) {
        if (timeSlot === 'current') {
            // Current time logic would go here
            return true; // Simplified for demo
        }
        
        return slot.lesson == timeSlot && (day === 'today' || slot.day === day);
    }

    updateOverviewStats() {
        const occupiedElement = document.getElementById('occupiedRooms');
        const freeElement = document.getElementById('freeRooms');
        const conflictsElement = document.getElementById('conflictCount');
        const workloadElement = document.getElementById('avgWorkload');
        
        const rooms = this.scheduleData.rooms || [];
        const occupied = rooms.filter(room => room.occupancy > 0).length;
        const free = rooms.length - occupied;
        const conflicts = this.scheduleData.conflicts || [];
        
        if (occupiedElement) occupiedElement.textContent = occupied;
        if (freeElement) freeElement.textContent = free;
        if (conflictsElement) conflictsElement.textContent = conflicts.length;
        
        // Calculate average workload
        const allEntities = [...this.scheduleData.classes, ...this.scheduleData.teachers];
        const avgWorkload = allEntities.length > 0 ? 
            Math.round(allEntities.reduce((sum, item) => sum + (item.workload || 0), 0) / allEntities.length) : 0;
        
        if (workloadElement) workloadElement.textContent = avgWorkload;
    }

    applyFilters(data) {
        let filtered = data;
        
        // Day filter
        if (this.currentDay !== 'all') {
            filtered = filtered.filter(item => {
                if (item.schedule) {
                    return item.schedule.some(slot => slot.day === this.currentDay);
                }
                return false;
            });
        }
        
        // Entity filter
        const entityFilter = document.getElementById('entityFilter')?.value || '';
        if (entityFilter) {
            filtered = filtered.filter(item => 
                item.name.toLowerCase().includes(entityFilter.toLowerCase())
            );
        }
        
        // Conflict filter
        if (this.showConflicts) {
            filtered = filtered.filter(item => 
                item.conflicts && item.conflicts.length > 0
            );
        }
        
        return filtered;
    }

    filterByEntity(entity) {
        this.renderSchedule();
    }

    getWorkloadClass(workload) {
        if (workload >= 20) return 'high';
        if (workload >= 10) return 'medium';
        return 'low';
    }

    toggleHeatmap() {
        const container = document.getElementById('scheduleGrid');
        if (container) {
            if (this.showHeatmap) {
                container.classList.add('heatmap-enabled');
            } else {
                container.classList.remove('heatmap-enabled');
            }
            this.renderSchedule();
        }
    }

    getScheduleByDay() {
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
        const daySchedules = [];
        
        days.forEach(day => {
            const dayData = {
                name: day.charAt(0).toUpperCase() + day.slice(1),
                schedule: [],
                workload: 0,
                conflicts: []
            };
            
            // Collect all schedule items for this day
            [...this.scheduleData.classes, ...this.scheduleData.teachers, ...this.scheduleData.rooms].forEach(entity => {
                if (entity.schedule) {
                    entity.schedule.forEach(slot => {
                        if (slot.day === day) {
                            dayData.schedule.push({...slot, entity: entity.name});
                            dayData.workload++;
                        }
                    });
                }
            });
            
            daySchedules.push(dayData);
        });
        
        return daySchedules;
    }

    getScheduleByEmployeeType() {
        const staff = this.scheduleData.staff || [];
        const employeeTypes = {};
        
        staff.forEach(person => {
            const type = person.category || 'staff';
            if (!employeeTypes[type]) {
                employeeTypes[type] = {
                    name: type.charAt(0).toUpperCase() + type.slice(1),
                    schedule: [],
                    workload: 0,
                    conflicts: []
                };
            }
            
            if (person.schedule) {
                employeeTypes[type].schedule.push(...person.schedule);
                employeeTypes[type].workload += person.schedule.length;
            }
        });
        
        return Object.values(employeeTypes);
    }

    viewDetails(entityName) {
        this.showToast(`Viewing details for ${entityName}`, 'info');
        // In a real implementation, this would open a detailed view
    }

    showCreateModal() {
        const modal = document.getElementById('scheduleModal');
        if (modal) {
            modal.classList.add('active');
        }
    }

    hideModal() {
        const modal = document.getElementById('scheduleModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    async saveScheduleEntry() {
        const form = document.getElementById('scheduleForm');
        if (!form) return;

        const formData = {
            entityType: document.getElementById('entityType').value,
            entityName: document.getElementById('entityName').value,
            day: document.getElementById('scheduleDay').value,
            lesson: document.getElementById('scheduleLesson').value,
            subject: document.getElementById('scheduleSubject').value,
            room: document.getElementById('scheduleRoom').value,
            notes: document.getElementById('scheduleNotes').value
        };

        try {
            this.showLoading();
            
            const response = await this.apiCall('/api/schedule/create', {
                method: 'POST',
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                this.showToast('Schedule entry created successfully', 'success');
                this.hideModal();
                await this.loadScheduleData();
            } else {
                this.showToast('Error creating schedule entry', 'error');
            }
        } catch (error) {
            console.error('Error saving schedule entry:', error);
            this.showToast('Error saving schedule entry', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async refreshSchedule() {
        await this.loadScheduleData();
        this.showToast('Schedule refreshed', 'success');
    }

    exportSchedule() {
        this.showToast('Export feature coming soon', 'info');
    }

    startRealTimeUpdates() {
        // Update every 60 seconds
        this.refreshInterval = setInterval(() => {
            this.loadScheduleData();
        }, 60000);
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

    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }
}

// Initialize schedule module when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.scheduleModule = new ScheduleModule();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.scheduleModule) {
        window.scheduleModule.destroy();
    }
});
