/**
 * Staff Operations - Complete School Staff Management System
 * Comprehensive staff directory with availability, workload, and schedule lookup
 */

class StaffOperations {
    constructor() {
        this.currentView = 'cards';
        this.currentCategory = 'all';
        this.currentStatus = 'all';
        this.currentTimeSlot = 'current';
        this.showWorkload = true;
        this.staffData = {
            all: [],
            teaching: [],
            administration: [],
            service: [],
            support: []
        };
        this.refreshInterval = null;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupFilters();
        this.startRealTimeUpdates();
        await this.loadStaffData();
        this.renderStaff();
        this.updateOverviewStats();
    }

    setupEventListeners() {
        // Category filter
        document.getElementById('categoryFilter')?.addEventListener('change', (e) => {
            this.currentCategory = e.target.value;
            this.renderStaff();
        });

        // Status filter
        document.getElementById('statusFilter')?.addEventListener('change', (e) => {
            this.currentStatus = e.target.value;
            this.renderStaff();
        });

        // Department filter
        document.getElementById('departmentFilter')?.addEventListener('input', (e) => {
            this.filterByDepartment(e.target.value);
        });

        // Time slot filter
        document.getElementById('timeSlotFilter')?.addEventListener('change', (e) => {
            this.currentTimeSlot = e.target.value;
            this.renderStaff();
        });

        // Workload toggle
        document.getElementById('workloadToggle')?.addEventListener('change', (e) => {
            this.showWorkload = e.target.checked;
            this.renderStaff();
        });

        // View controls
        document.querySelectorAll('.grid-view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.grid-view-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.currentView = e.currentTarget.dataset.view;
                this.renderStaff();
            });
        });

        // Header actions
        document.getElementById('refreshStaff')?.addEventListener('click', () => {
            this.refreshStaff();
        });

        document.getElementById('exportStaff')?.addEventListener('click', () => {
            this.exportStaff();
        });

        document.getElementById('addStaff')?.addEventListener('click', () => {
            this.showAddStaffModal();
        });

        // Availability finder
        document.getElementById('findAvailable')?.addEventListener('click', () => {
            this.findAvailableStaff();
        });

        document.getElementById('availabilityCategory')?.addEventListener('change', () => {
            this.findAvailableStaff();
        });

        document.getElementById('availabilityTime')?.addEventListener('change', () => {
            this.findAvailableStaff();
        });

        // Workload analysis
        document.getElementById('workloadPeriod')?.addEventListener('change', () => {
            this.updateWorkloadAnalysis();
        });

        document.getElementById('workloadCategory')?.addEventListener('change', () => {
            this.updateWorkloadAnalysis();
        });

        // Schedule lookup
        document.getElementById('lookupSchedule')?.addEventListener('click', () => {
            this.lookupSchedule();
        });

        // Modal controls
        document.getElementById('modalClose')?.addEventListener('click', () => {
            this.hideModal();
        });

        document.getElementById('modalCancel')?.addEventListener('click', () => {
            this.hideModal();
        });

        // Toast close
        document.getElementById('toastClose')?.addEventListener('click', () => {
            this.hideToast();
        });
    }

    setupFilters() {
        this.filters = {
            category: this.currentCategory,
            status: this.currentStatus,
            department: '',
            timeSlot: this.currentTimeSlot,
            showWorkload: this.showWorkload
        };
    }

    async loadStaffData() {
        this.showLoading();
        
        try {
            // Load staff data from backend API
            const response = await this.apiCall('/api/school/staff');
            
            if (response.ok) {
                this.staffData.all = response.staff || [];
                this.categorizeStaff();
                this.calculateStaffStatus();
                this.calculateWorkload();
                this.populateEmployeeDropdown();
            } else {
                this.showToast('Error loading staff data', 'error');
            }
        } catch (error) {
            console.error('Error loading staff data:', error);
            this.showToast('Error loading staff data', 'error');
        } finally {
            this.hideLoading();
        }
    }

    categorizeStaff() {
        this.staffData.teaching = [];
        this.staffData.administration = [];
        this.staffData.service = [];
        this.staffData.support = [];

        this.staffData.all.forEach(staff => {
            const category = this.getStaffCategory(staff);
            staff.category = category;
            this.staffData[category].push(staff);
        });
    }

    getStaffCategory(staff) {
        const role = (staff.role || '').toLowerCase();
        const category = (staff.category || '').toLowerCase();
        
        // Teaching staff
        if (role.includes('teacher') || role.includes('teacher') || 
            category.includes('teaching') || category.includes('subject')) {
            return 'teaching';
        }
        
        // Administration
        if (role.includes('director') || role.includes('principal') || 
            role.includes('vice') || role.includes('deputy') ||
            role.includes('secretary') || role.includes('accountant') ||
            category.includes('administration') || category.includes('management')) {
            return 'administration';
        }
        
        // Support staff
        if (role.includes('psychologist') || role.includes('social') ||
            role.includes('speech') || role.includes('defectologist') ||
            role.includes('librarian') || role.includes('it') ||
            role.includes('lab') || category.includes('support')) {
            return 'support';
        }
        
        // Service staff (default)
        return 'service';
    }

    calculateStaffStatus() {
        this.staffData.all.forEach(staff => {
            staff.status = this.determineStaffStatus(staff);
        });
    }

    determineStaffStatus(staff) {
        // This would typically check current schedule, tasks, incidents
        // For demo purposes, we'll simulate status based on workload
        const workload = staff.workload || 0;
        
        if (workload >= 25) return 'overloaded';
        if (workload >= 15) return 'busy';
        if (workload <= 5) return 'free';
        
        // Randomly assign some staff to special statuses
        const random = Math.random();
        if (random < 0.05) return 'substitution';
        if (random < 0.02) return 'incident';
        
        return 'busy';
    }

    calculateWorkload() {
        this.staffData.all.forEach(staff => {
            // Calculate workload based on schedule, tasks, and other factors
            staff.workload = this.calculateIndividualWorkload(staff);
            staff.workloadLevel = this.getWorkloadLevel(staff.workload);
        });
    }

    calculateIndividualWorkload(staff) {
        // Base workload from schedule
        let workload = 0;
        
        // Add schedule load
        if (staff.schedule) {
            workload += staff.schedule.length * 2;
        }
        
        // Add task load
        if (staff.tasks) {
            workload += staff.tasks.length * 3;
        }
        
        // Add category-specific workload
        const category = staff.category;
        if (category === 'teaching') {
            workload += 10; // Base teaching load
        } else if (category === 'administration') {
            workload += 8; // Base admin load
        } else if (category === 'support') {
            workload += 6; // Base support load
        } else {
            workload += 4; // Base service load
        }
        
        return workload;
    }

    getWorkloadLevel(workload) {
        if (workload >= 25) return 'high';
        if (workload >= 15) return 'medium';
        return 'low';
    }

    populateEmployeeDropdown() {
        const dropdown = document.getElementById('lookupEmployee');
        if (!dropdown) return;

        dropdown.innerHTML = '<option value="">Select Employee</option>';
        
        this.staffData.all.forEach(staff => {
            const option = document.createElement('option');
            option.value = staff.id || staff.full_name;
            option.textContent = staff.full_name;
            dropdown.appendChild(option);
        });
    }

    renderStaff() {
        const container = document.getElementById('staffGrid');
        if (!container) return;

        let data = this.getFilteredStaff();
        
        // Render based on current view
        switch (this.currentView) {
            case 'cards':
                this.renderCardsView(container, data);
                break;
            case 'table':
                this.renderTableView(container, data);
                break;
            case 'matrix':
                this.renderMatrixView(container, data);
                break;
        }

        this.renderCategorySections();
        this.updateCategoryCounts();
    }

    getFilteredStaff() {
        let filtered = [...this.staffData.all];
        
        // Category filter
        if (this.currentCategory !== 'all') {
            filtered = filtered.filter(staff => staff.category === this.currentCategory);
        }
        
        // Status filter
        if (this.currentStatus !== 'all') {
            filtered = filtered.filter(staff => staff.status === this.currentStatus);
        }
        
        // Department filter
        const departmentFilter = document.getElementById('departmentFilter')?.value || '';
        if (departmentFilter) {
            filtered = filtered.filter(staff => 
                (staff.department || '').toLowerCase().includes(departmentFilter.toLowerCase()) ||
                (staff.role || '').toLowerCase().includes(departmentFilter.toLowerCase())
            );
        }
        
        // Time slot filter
        if (this.currentTimeSlot !== 'all') {
            filtered = filtered.filter(staff => 
                this.isStaffAvailableAtTimeSlot(staff, this.currentTimeSlot)
            );
        }
        
        return filtered;
    }

    isStaffAvailableAtTimeSlot(staff, timeSlot) {
        if (!staff.schedule) return true;
        
        // Check if staff has schedule at this time slot
        const hasSchedule = staff.schedule.some(slot => 
            slot.lesson == timeSlot || slot.time_slot == timeSlot
        );
        
        return !hasSchedule;
    }

    renderCardsView(container, data) {
        container.innerHTML = `
            <div class="staff-cards">
                ${data.map(staff => this.renderStaffCard(staff)).join('')}
            </div>
        `;
    }

    renderTableView(container, data) {
        container.innerHTML = `
            <div class="staff-table-container">
                <table class="staff-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Role</th>
                            <th>Department</th>
                            <th>Status</th>
                            <th>Workload</th>
                            <th>Category</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(staff => this.renderStaffTableRow(staff)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    renderMatrixView(container, data) {
        container.innerHTML = `
            <div class="staff-matrix">
                ${data.map(staff => this.renderStaffMatrixItem(staff)).join('')}
            </div>
        `;
    }

    renderStaffCard(staff) {
        const statusClass = staff.status || 'busy';
        const categoryClass = staff.category || 'service';
        const workloadPercent = Math.min((staff.workload || 0) / 30 * 100, 100);
        const workloadClass = staff.workloadLevel || 'medium';
        
        return `
            <div class="staff-card ${categoryClass}" onclick="staffOperations.showStaffDetails('${staff.id || staff.full_name}')">
                <div class="staff-card-header">
                    <div class="staff-info">
                        <div class="staff-name">${staff.full_name}</div>
                        <div class="staff-role">${staff.role}</div>
                        <div class="staff-department">${staff.department || 'General'}</div>
                    </div>
                    <div class="staff-status ${statusClass}">
                        ${this.formatStatus(staff.status)}
                    </div>
                </div>
                <div class="staff-card-details">
                    <div class="staff-detail">
                        <span class="detail-label">Category:</span>
                        <span class="detail-value">${this.formatCategory(staff.category)}</span>
                    </div>
                    <div class="staff-detail">
                        <span class="detail-label">Workload:</span>
                        <span class="detail-value">${staff.workload || 0} units</span>
                    </div>
                    ${staff.schedule ? `
                        <div class="staff-detail">
                            <span class="detail-label">Schedule:</span>
                            <span class="detail-value">${staff.schedule.length} lessons</span>
                        </div>
                    ` : ''}
                    ${staff.contact ? `
                        <div class="staff-detail">
                            <span class="detail-label">Contact:</span>
                            <span class="detail-value">${staff.contact}</span>
                        </div>
                    ` : ''}
                </div>
                ${this.showWorkload ? `
                    <div class="workload-bar">
                        <div class="workload-fill ${workloadClass}" style="width: ${workloadPercent}%"></div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderStaffTableRow(staff) {
        const statusClass = staff.status || 'busy';
        
        return `
            <tr onclick="staffOperations.showStaffDetails('${staff.id || staff.full_name}')">
                <td>${staff.full_name}</td>
                <td>${staff.role}</td>
                <td>${staff.department || 'General'}</td>
                <td>
                    <span class="staff-status ${statusClass}">
                        ${this.formatStatus(staff.status)}
                    </span>
                </td>
                <td>${staff.workload || 0}</td>
                <td>${this.formatCategory(staff.category)}</td>
            </tr>
        `;
    }

    renderStaffMatrixItem(staff) {
        const statusClass = staff.status || 'busy';
        
        return `
            <div class="matrix-item ${staff.category}" onclick="staffOperations.showStaffDetails('${staff.id || staff.full_name}')">
                <div class="matrix-name">${staff.full_name}</div>
                <div class="matrix-role">${staff.role}</div>
                <div class="matrix-status ${statusClass}">
                    ${this.formatStatus(staff.status)}
                </div>
            </div>
        `;
    }

    renderCategorySections() {
        this.renderCategorySection('teaching', 'teachingGrid');
        this.renderCategorySection('administration', 'administrationGrid');
        this.renderCategorySection('service', 'serviceGrid');
        this.renderCategorySection('support', 'supportGrid');
    }

    renderCategorySection(category, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const staff = this.staffData[category] || [];
        
        container.innerHTML = `
            <div class="category-grid">
                ${staff.map(person => this.renderStaffCard(person)).join('')}
            </div>
        `;
    }

    updateCategoryCounts() {
        document.getElementById('teachingCount').textContent = this.staffData.teaching.length;
        document.getElementById('administrationCount').textContent = this.staffData.administration.length;
        document.getElementById('serviceCount').textContent = this.staffData.service.length;
        document.getElementById('supportCount').textContent = this.staffData.support.length;
    }

    updateOverviewStats() {
        const total = this.staffData.all.length;
        const teaching = this.staffData.teaching.length;
        const administration = this.staffData.administration.length;
        const service = this.staffData.service.length;
        
        const free = this.staffData.all.filter(s => s.status === 'free').length;
        const busy = this.staffData.all.filter(s => s.status === 'busy').length;
        const overloaded = this.staffData.all.filter(s => s.status === 'overloaded').length;
        const substitution = this.staffData.all.filter(s => s.status === 'substitution').length;
        
        document.getElementById('totalStaff').textContent = total;
        document.getElementById('teachingStaff').textContent = teaching;
        document.getElementById('administrationStaff').textContent = administration;
        document.getElementById('serviceStaff').textContent = service;
        document.getElementById('freeStaff').textContent = free;
        document.getElementById('busyStaff').textContent = busy;
        document.getElementById('overloadedStaff').textContent = overloaded;
        document.getElementById('substitutionStaff').textContent = substitution;
    }

    findAvailableStaff() {
        const category = document.getElementById('availabilityCategory')?.value || 'all';
        const time = document.getElementById('availabilityTime')?.value || 'current';
        
        const available = this.staffData.all.filter(staff => {
            if (category !== 'all' && staff.category !== category) return false;
            return staff.status === 'free' || this.isStaffAvailableAtTimeSlot(staff, time);
        });
        
        this.renderAvailableStaff(available);
    }

    renderAvailableStaff(available) {
        const container = document.getElementById('availabilityResults');
        if (!container) return;

        container.innerHTML = `
            <div class="available-staff-grid">
                ${available.map(staff => this.renderAvailableStaffItem(staff)).join('')}
            </div>
        `;
    }

    renderAvailableStaffItem(staff) {
        return `
            <div class="available-staff-item" onclick="staffOperations.showStaffDetails('${staff.id || staff.full_name}')">
                <div class="available-staff-name">${staff.full_name}</div>
                <div class="available-staff-role">${staff.role}</div>
                <div class="available-staff-time">
                    <div class="availability-dot"></div>
                    Available now
                </div>
            </div>
        `;
    }

    updateWorkloadAnalysis() {
        const period = document.getElementById('workloadPeriod')?.value || 'today';
        const category = document.getElementById('workloadCategory')?.value || 'all';
        
        let staff = this.staffData.all;
        if (category !== 'all') {
            staff = staff.filter(s => s.category === category);
        }
        
        // Sort by workload
        staff.sort((a, b) => (b.workload || 0) - (a.workload || 0));
        
        this.renderWorkloadAnalysis(staff.slice(0, 10));
    }

    renderWorkloadAnalysis(staff) {
        const container = document.getElementById('workloadGrid');
        if (!container) return;

        container.innerHTML = `
            <div class="workload-grid">
                ${staff.map(person => this.renderWorkloadItem(person)).join('')}
            </div>
        `;
    }

    renderWorkloadItem(staff) {
        const workloadLevel = staff.workloadLevel || 'medium';
        
        return `
            <div class="workload-item" onclick="staffOperations.showStaffDetails('${staff.id || staff.full_name}')">
                <div class="workload-header">
                    <div class="workload-name">${staff.full_name}</div>
                    <div class="workload-value ${workloadLevel}">${staff.workload || 0}</div>
                </div>
                <div class="workload-details">
                    <div class="workload-detail">
                        <span class="workload-label">Role:</span>
                        <span class="workload-number">${staff.role}</span>
                    </div>
                    <div class="workload-detail">
                        <span class="workload-label">Category:</span>
                        <span class="workload-number">${this.formatCategory(staff.category)}</span>
                    </div>
                    <div class="workload-detail">
                        <span class="workload-label">Status:</span>
                        <span class="workload-number">${this.formatStatus(staff.status)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    lookupSchedule() {
        const employeeId = document.getElementById('lookupEmployee')?.value;
        const day = document.getElementById('lookupDay')?.value || 'today';
        
        if (!employeeId) {
            this.showToast('Please select an employee', 'error');
            return;
        }
        
        const staff = this.staffData.all.find(s => 
            (s.id === employeeId) || (s.full_name === employeeId)
        );
        
        if (!staff) {
            this.showToast('Employee not found', 'error');
            return;
        }
        
        this.renderScheduleLookup(staff, day);
    }

    renderScheduleLookup(staff, day) {
        const container = document.getElementById('lookupResults');
        if (!container) return;

        const schedule = staff.schedule || [];
        
        container.innerHTML = `
            <div class="schedule-lookup-header">
                <h3>${staff.full_name} - ${staff.role}</h3>
                <p class="schedule-day">${day}</p>
            </div>
            <div class="schedule-timeline">
                ${this.renderScheduleTimeline(schedule, day)}
            </div>
        `;
    }

    renderScheduleTimeline(schedule, day) {
        if (!schedule || schedule.length === 0) {
            return '<div class="no-schedule">No schedule available</div>';
        }
        
        // Group by day
        const daySchedule = schedule.filter(slot => 
            day === 'today' || slot.day === day
        );
        
        if (daySchedule.length === 0) {
            return '<div class="no-schedule">No schedule for this day</div>';
        }
        
        // Sort by lesson
        daySchedule.sort((a, b) => (a.lesson || 0) - (b.lesson || 0));
        
        return daySchedule.map(slot => `
            <div class="schedule-slot">
                <span class="slot-time">Lesson ${slot.lesson}</span>
                <span class="slot-subject">${slot.subject || 'N/A'}</span>
                <span class="slot-room">${slot.room || 'N/A'}</span>
            </div>
        `).join('');
    }

    showStaffDetails(staffId) {
        const staff = this.staffData.all.find(s => 
            (s.id === staffId) || (s.full_name === staffId)
        );
        
        if (!staff) return;
        
        this.renderStaffDetails(staff);
        this.showModal();
    }

    renderStaffDetails(staff) {
        const container = document.getElementById('staffDetails');
        if (!container) return;

        container.innerHTML = `
            <div class="detail-section">
                <div class="detail-section-title">Basic Information</div>
                <div class="detail-section-content">
                    <div class="detail-item">
                        <span class="detail-item-label">Name:</span>
                        <span class="detail-item-value">${staff.full_name}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-item-label">Role:</span>
                        <span class="detail-item-value">${staff.role}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-item-label">Department:</span>
                        <span class="detail-item-value">${staff.department || 'General'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-item-label">Category:</span>
                        <span class="detail-item-value">${this.formatCategory(staff.category)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-item-label">Status:</span>
                        <span class="detail-item-value">${this.formatStatus(staff.status)}</span>
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <div class="detail-section-title">Workload</div>
                <div class="detail-section-content">
                    <div class="detail-item">
                        <span class="detail-item-label">Current Workload:</span>
                        <span class="detail-item-value">${staff.workload || 0} units</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-item-label">Workload Level:</span>
                        <span class="detail-item-value">${staff.workloadLevel || 'medium'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-item-label">Schedule Load:</span>
                        <span class="detail-item-value">${staff.schedule ? staff.schedule.length : 0} lessons</span>
                    </div>
                </div>
            </div>
            
            ${staff.contact ? `
                <div class="detail-section">
                    <div class="detail-section-title">Contact Information</div>
                    <div class="detail-section-content">
                        <div class="detail-item">
                            <span class="detail-item-label">Contact:</span>
                            <span class="detail-item-value">${staff.contact}</span>
                        </div>
                    </div>
                </div>
            ` : ''}
            
            ${staff.schedule ? `
                <div class="detail-section">
                    <div class="detail-section-title">Schedule Summary</div>
                    <div class="detail-section-content">
                        <div class="detail-item">
                            <span class="detail-item-label">Total Lessons:</span>
                            <span class="detail-item-value">${staff.schedule.length}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-item-label">Subjects:</span>
                            <span class="detail-item-value">${this.extractSubjects(staff.schedule).join(', ')}</span>
                        </div>
                    </div>
                </div>
            ` : ''}
        `;
    }

    extractSubjects(schedule) {
        const subjects = new Set();
        schedule.forEach(slot => {
            if (slot.subject) subjects.add(slot.subject);
        });
        return Array.from(subjects);
    }

    formatStatus(status) {
        if (!status) return 'Unknown';
        
        const statusMap = {
            'free': 'Free',
            'busy': 'Busy',
            'overloaded': 'Overloaded',
            'substitution': 'On Substitution',
            'incident': 'Incident Response'
        };
        
        return statusMap[status] || status.charAt(0).toUpperCase() + status.slice(1);
    }

    formatCategory(category) {
        if (!category) return 'Unknown';
        
        const categoryMap = {
            'teaching': 'Teaching Staff',
            'administration': 'Administration',
            'service': 'Service Staff',
            'support': 'Support Staff'
        };
        
        return categoryMap[category] || category.charAt(0).toUpperCase() + category.slice(1);
    }

    filterByDepartment(department) {
        this.renderStaff();
    }

    showAddStaffModal() {
        this.showToast('Add staff feature coming soon', 'info');
    }

    showModal() {
        const modal = document.getElementById('staffModal');
        if (modal) {
            modal.classList.add('active');
        }
    }

    hideModal() {
        const modal = document.getElementById('staffModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    async refreshStaff() {
        await this.loadStaffData();
        this.renderStaff();
        this.updateOverviewStats();
        this.showToast('Staff data refreshed', 'success');
    }

    exportStaff() {
        this.showToast('Export feature coming soon', 'info');
    }

    startRealTimeUpdates() {
        // Update every 60 seconds
        this.refreshInterval = setInterval(() => {
            this.loadStaffData();
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

// Initialize staff operations when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.staffOperations = new StaffOperations();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.staffOperations) {
        window.staffOperations.destroy();
    }
});
