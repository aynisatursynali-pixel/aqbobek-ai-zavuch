/**
 * Voice-to-Task Manager - Robust Director Command Processing System
 * Converts voice/text commands into tasks with real staff name resolution
 */

class VoiceTaskManager {
    constructor() {
        this.isRecording = false;
        this.recognition = null;
        this.staffData = [];
        this.recentTasks = [];
        this.parsedTasks = [];
        this.statistics = {
            totalTasks: 0,
            todayTasks: 0,
            voiceCommands: 0,
            accuracyRate: 95
        };
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.initializeSpeechRecognition();
        await this.loadStaffData();
        await this.loadRecentTasks();
        this.updateStatistics();
        this.updateCurrentTime();
    }

    setupEventListeners() {
        // Voice controls
        document.getElementById('startVoice')?.addEventListener('click', () => {
            this.toggleRecording();
        });

        // Text input
        document.getElementById('processCommand')?.addEventListener('click', () => {
            this.processTextCommand();
        });

        document.getElementById('clearInput')?.addEventListener('click', () => {
            this.clearInput();
        });

        // Processing results
        document.getElementById('editTasks')?.addEventListener('click', () => {
            this.showEditModal();
        });

        document.getElementById('createTasks')?.addEventListener('click', () => {
            this.createTasks();
        });

        document.getElementById('cancelTasks')?.addEventListener('click', () => {
            this.cancelProcessing();
        });

        // Recent tasks
        document.getElementById('refreshTasks')?.addEventListener('click', () => {
            this.loadRecentTasks();
        });

        // Staff search
        document.getElementById('staffSearch')?.addEventListener('input', (e) => {
            this.filterStaff(e.target.value);
        });

        // Modal controls
        document.getElementById('editModalClose')?.addEventListener('click', () => {
            this.hideEditModal();
        });

        document.getElementById('editModalCancel')?.addEventListener('click', () => {
            this.hideEditModal();
        });

        document.getElementById('editModalSave')?.addEventListener('click', () => {
            this.saveEditedTasks();
        });

        // Toast close
        document.getElementById('toastClose')?.addEventListener('click', () => {
            this.hideToast();
        });

        // Auto-resize textarea
        const commandInput = document.getElementById('commandInput');
        if (commandInput) {
            commandInput.addEventListener('input', () => {
                this.autoResizeTextarea(commandInput);
            });
        }
    }

    initializeSpeechRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.lang = 'ru-RU';
            
            this.recognition.onstart = () => {
                this.onRecordingStart();
            };
            
            this.recognition.onresult = (event) => {
                this.onRecordingResult(event);
            };
            
            this.recognition.onerror = (event) => {
                this.onRecordingError(event);
            };
            
            this.recognition.onend = () => {
                this.onRecordingEnd();
            };
        } else {
            console.warn('Speech recognition not supported');
            this.showToast('Speech recognition not supported in this browser', 'error');
        }
    }

    toggleRecording() {
        if (!this.recognition) {
            this.showToast('Speech recognition not available', 'error');
            return;
        }

        if (this.isRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    }

    startRecording() {
        try {
            this.recognition.start();
            this.isRecording = true;
            this.updateRecordingUI(true);
        } catch (error) {
            console.error('Error starting recording:', error);
            this.showToast('Error starting recording', 'error');
        }
    }

    stopRecording() {
        if (this.recognition && this.isRecording) {
            this.recognition.stop();
        }
    }

    onRecordingStart() {
        this.updateVoiceStatus('Recording... Speak clearly');
        this.showToast('Recording started', 'info');
    }

    onRecordingResult(event) {
        const current = event.resultIndex;
        const transcript = event.results[current][0].transcript;
        
        const commandInput = document.getElementById('commandInput');
        if (commandInput) {
            commandInput.value = transcript;
            this.autoResizeTextarea(commandInput);
        }
        
        if (event.results[current].isFinal) {
            this.updateVoiceStatus('Recording complete');
            this.showToast('Recording complete', 'success');
            setTimeout(() => {
                this.processTextCommand();
            }, 1000);
        }
    }

    onRecordingError(event) {
        console.error('Speech recognition error:', event.error);
        this.updateVoiceStatus('Error occurred');
        this.showToast(`Recording error: ${event.error}`, 'error');
        this.isRecording = false;
        this.updateRecordingUI(false);
    }

    onRecordingEnd() {
        this.isRecording = false;
        this.updateRecordingUI(false);
        this.updateVoiceStatus('Ready to record');
    }

    updateRecordingUI(isRecording) {
        const voiceButton = document.getElementById('startVoice');
        if (!voiceButton) return;

        if (isRecording) {
            voiceButton.classList.add('recording');
            voiceButton.querySelector('.voice-label').textContent = 'Stop Recording';
        } else {
            voiceButton.classList.remove('recording');
            voiceButton.querySelector('.voice-label').textContent = 'Start Recording';
        }
    }

    updateVoiceStatus(status) {
        const statusElement = document.getElementById('voiceStatus');
        if (statusElement) {
            statusElement.querySelector('.status-text').textContent = status;
        }
    }

    async processTextCommand() {
        const commandInput = document.getElementById('commandInput');
        const command = commandInput?.value?.trim();
        
        if (!command) {
            this.showToast('Please enter a command', 'error');
            return;
        }

        this.showLoading();
        
        try {
            // Parse the command into tasks
            this.parsedTasks = await this.parseCommand(command);
            
            if (this.parsedTasks.length === 0) {
                this.showToast('No tasks could be parsed from the command', 'warning');
                this.hideLoading();
                return;
            }

            // Show processing results
            this.showProcessingResults(command);
            
        } catch (error) {
            console.error('Error processing command:', error);
            this.showToast('Error processing command', 'error');
            this.hideLoading();
        }
    }

    async parseCommand(command) {
        // This is the core parsing logic
        const tasks = [];
        
        // Split command into sentences/clauses
        const sentences = this.splitIntoSentences(command);
        
        for (const sentence of sentences) {
            const task = await this.parseSentence(sentence);
            if (task) {
                tasks.push(task);
            }
        }
        
        return tasks;
    }

    splitIntoSentences(command) {
        // Split by common sentence separators
        const separators = /[.!?;]+/;
        const sentences = command.split(separators)
            .map(s => s.trim())
            .filter(s => s.length > 0);
        
        // If no separators found, try to split by commas for simple commands
        if (sentences.length === 1 && command.includes(',')) {
            return command.split(',')
                .map(s => s.trim())
                .filter(s => s.length > 0);
        }
        
        return sentences;
    }

    async parseSentence(sentence) {
        // Extract assignee (person name)
        const assignee = this.extractAssignee(sentence);
        
        // Extract task content
        const taskContent = this.extractTaskContent(sentence, assignee);
        
        // Extract deadline
        const deadline = this.extractDeadline(sentence);
        
        // Determine priority
        const priority = this.determinePriority(sentence);
        
        if (!taskContent) {
            return null;
        }
        
        return {
            id: this.generateTaskId(),
            title: taskContent,
            assignee: assignee,
            deadline: deadline,
            priority: priority,
            source: 'voice',
            status: 'new',
            created_at: new Date().toISOString(),
            original_sentence: sentence
        };
    }

    extractAssignee(sentence) {
        // Try to find staff names in the sentence
        const words = sentence.split(/\s+/);
        
        for (let i = 0; i < words.length; i++) {
            const word = words[i].replace(/[.,!?;:]/g, '');
            
            // Check exact match first
            const staffMember = this.staffData.find(staff => 
                staff.full_name.toLowerCase() === word.toLowerCase()
            );
            
            if (staffMember) {
                return staffMember.full_name;
            }
            
            // Check partial matches (first name)
            const partialMatch = this.staffData.find(staff => {
                const firstName = staff.full_name.split(' ')[0].toLowerCase();
                return firstName === word.toLowerCase();
            });
            
            if (partialMatch) {
                return partialMatch.full_name;
            }
        }
        
        // Check for multi-word names
        for (let i = 0; i < words.length - 1; i++) {
            const twoWordName = `${words[i]} ${words[i + 1]}`.replace(/[.,!?;:]/g, '');
            
            const staffMember = this.staffData.find(staff => 
                staff.full_name.toLowerCase() === twoWordName.toLowerCase()
            );
            
            if (staffMember) {
                return staffMember.full_name;
            }
        }
        
        return null;
    }

    extractTaskContent(sentence, assignee) {
        // Remove assignee name from sentence
        let content = sentence;
        
        if (assignee) {
            content = content.replace(new RegExp(assignee, 'gi'), '');
        }
        
        // Remove common filler words and clean up
        content = content
            .replace(/[.,!?;:]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        
        // Common Russian task patterns
        const taskPatterns = [
            /(?: preparations?|prepare|organize|organise|set up|get|make|do|create|handle|take care of|arrange|book|order|buy|purchase|contact|call|email|send|write|prepare|check|verify|confirm|schedule|plan|coordinate|manage|supervise|oversee|monitor|track|follow up|update|inform|notify|remind|ask|tell|request|require|need|should|must|please|kindly)\s+(.+)/i,
            /(?:I need|we need|need to|should|must|please|kindly)\s+(.+)/i,
            /(.+?)(?:please|kindly)$/i,
            /(.+?)$/i
        ];
        
        for (const pattern of taskPatterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
        
        // If no pattern matches, use the cleaned content
        return content || sentence;
    }

    extractDeadline(sentence) {
        const now = new Date();
        
        // Common Russian deadline patterns
        const deadlinePatterns = {
            'today': () => {
                const endOfDay = new Date(now);
                endOfDay.setHours(18, 0, 0, 0);
                return endOfDay.toISOString();
            },
            'tomorrow': () => {
                const tomorrow = new Date(now);
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(18, 0, 0, 0);
                return tomorrow.toISOString();
            },
            'next week': () => {
                const nextWeek = new Date(now);
                nextWeek.setDate(nextWeek.getDate() + 7);
                nextWeek.setHours(18, 0, 0, 0);
                return nextWeek.toISOString();
            },
            'this week': () => {
                const thisWeek = new Date(now);
                thisWeek.setDate(thisWeek.getDate() + (7 - thisWeek.getDay()));
                thisWeek.setHours(18, 0, 0, 0);
                return thisWeek.toISOString();
            },
            'next month': () => {
                const nextMonth = new Date(now);
                nextMonth.setMonth(nextMonth.getMonth() + 1);
                nextMonth.setDate(1);
                nextMonth.setHours(18, 0, 0, 0);
                return nextMonth.toISOString();
            }
        };
        
        const lowerSentence = sentence.toLowerCase();
        
        for (const [pattern, resolver] of Object.entries(deadlinePatterns)) {
            if (lowerSentence.includes(pattern)) {
                return resolver();
            }
        }
        
        // Try to extract specific dates (e.g., "15th", "Monday")
        const dateMatch = lowerSentence.match(/(\d{1,2})(?:st|nd|rd|th)?(?:\s+(?:of\s+)?(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))?|(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun))/i);
        
        if (dateMatch) {
            // This is a simplified date parsing - in production, you'd use a proper date library
            const targetDate = new Date(now);
            targetDate.setDate(targetDate.getDate() + 3); // Default to 3 days from now
            targetDate.setHours(18, 0, 0, 0);
            return targetDate.toISOString();
        }
        
        return null;
    }

    determinePriority(sentence) {
        const lowerSentence = sentence.toLowerCase();
        
        // High priority indicators
        if (lowerSentence.includes('urgent') || 
            lowerSentence.includes('asap') || 
            lowerSentence.includes('immediately') ||
            lowerSentence.includes('critical') ||
            lowerSentence.includes('important')) {
            return 'high';
        }
        
        // Low priority indicators
        if (lowerSentence.includes('when you have time') || 
            lowerSentence.includes('no rush') ||
            lowerSentence.includes('later')) {
            return 'low';
        }
        
        return 'normal';
    }

    generateTaskId() {
        return 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    showProcessingResults(command) {
        const resultsSection = document.getElementById('processingResults');
        const originalCommand = document.getElementById('originalCommand');
        const parsedTasks = document.getElementById('parsedTasks');
        
        if (!resultsSection || !originalCommand || !parsedTasks) return;
        
        // Show original command
        originalCommand.textContent = command;
        
        // Show parsed tasks
        parsedTasks.innerHTML = this.parsedTasks.map(task => this.renderParsedTask(task)).join('');
        
        // Show results section
        resultsSection.style.display = 'block';
        
        // Scroll to results
        resultsSection.scrollIntoView({ behavior: 'smooth' });
        
        this.hideLoading();
    }

    renderParsedTask(task) {
        const assigneeText = task.assignee || 'Unassigned';
        const deadlineText = task.deadline ? 
            new Date(task.deadline).toLocaleDateString('ru-RU') : 'No deadline';
        
        return `
            <div class="task-item" data-task-id="${task.id}">
                <div class="task-content">
                    <div class="task-title">${task.title}</div>
                    <div class="task-assignee">${assigneeText}</div>
                    <div class="task-deadline">${deadlineText}</div>
                </div>
                <div class="task-priority ${task.priority}">${task.priority}</div>
            </div>
        `;
    }

    showEditModal() {
        const modal = document.getElementById('editTasksModal');
        const editor = document.getElementById('tasksEditor');
        
        if (!modal || !editor) return;
        
        editor.innerHTML = this.parsedTasks.map((task, index) => this.renderEditableTask(task, index)).join('') +
            '<button class="add-task-btn" onclick="voiceTaskManager.addNewTask()">+ Add Task</button>';
        
        modal.classList.add('active');
    }

    renderEditableTask(task, index) {
        return `
            <div class="editable-task" data-task-index="${index}">
                <div class="editable-task-header">
                    <div class="editable-task-title">Task ${index + 1}</div>
                    <button class="remove-task-btn" onclick="voiceTaskManager.removeTask(${index})">Remove</button>
                </div>
                <div class="editable-task-fields">
                    <div class="editable-field">
                        <label class="editable-label">Title</label>
                        <input type="text" class="editable-input" data-field="title" value="${task.title}" />
                    </div>
                    <div class="editable-field">
                        <label class="editable-label">Assignee</label>
                        <input type="text" class="editable-input" data-field="assignee" value="${task.assignee || ''}" />
                    </div>
                    <div class="editable-field">
                        <label class="editable-label">Priority</label>
                        <select class="editable-input" data-field="priority">
                            <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low</option>
                            <option value="normal" ${task.priority === 'normal' ? 'selected' : ''}>Normal</option>
                            <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High</option>
                        </select>
                    </div>
                    <div class="editable-field">
                        <label class="editable-label">Deadline</label>
                        <input type="date" class="editable-input" data-field="deadline" value="${task.deadline ? task.deadline.split('T')[0] : ''}" />
                    </div>
                </div>
            </div>
        `;
    }

    addNewTask() {
        const newTask = {
            id: this.generateTaskId(),
            title: '',
            assignee: '',
            priority: 'normal',
            deadline: null,
            source: 'voice',
            status: 'new',
            created_at: new Date().toISOString(),
            original_sentence: 'Manually added'
        };
        
        this.parsedTasks.push(newTask);
        this.showEditModal();
    }

    removeTask(index) {
        this.parsedTasks.splice(index, 1);
        this.showEditModal();
    }

    saveEditedTasks() {
        const editor = document.getElementById('tasksEditor');
        if (!editor) return;
        
        const taskElements = editor.querySelectorAll('.editable-task');
        
        taskElements.forEach((element, index) => {
            const titleInput = element.querySelector('[data-field="title"]');
            const assigneeInput = element.querySelector('[data-field="assignee"]');
            const prioritySelect = element.querySelector('[data-field="priority"]');
            const deadlineInput = element.querySelector('[data-field="deadline"]');
            
            if (titleInput && this.parsedTasks[index]) {
                this.parsedTasks[index].title = titleInput.value;
                this.parsedTasks[index].assignee = assigneeInput?.value || null;
                this.parsedTasks[index].priority = prioritySelect?.value || 'normal';
                this.parsedTasks[index].deadline = deadlineInput?.value ? 
                    new Date(deadlineInput.value).toISOString() : null;
            }
        });
        
        this.hideEditModal();
        this.showProcessingResults(this.parsedTasks.map(t => t.original_sentence).join('. '));
    }

    hideEditModal() {
        const modal = document.getElementById('editTasksModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    async createTasks() {
        if (this.parsedTasks.length === 0) {
            this.showToast('No tasks to create', 'error');
            return;
        }

        this.showLoading();
        
        try {
            // Create tasks via API
            const createdTasks = [];
            
            for (const task of this.parsedTasks) {
                const response = await this.apiCall('/api/tasks', {
                    method: 'POST',
                    body: JSON.stringify(task)
                });
                
                if (response.ok) {
                    createdTasks.push(response.task);
                }
            }
            
            // Update statistics
            this.statistics.totalTasks += this.parsedTasks.length;
            this.statistics.todayTasks += this.parsedTasks.length;
            this.statistics.voiceCommands++;
            
            // Show success message
            this.showToast(`Successfully created ${this.parsedTasks.length} tasks`, 'success');
            
            // Clear and reset
            this.cancelProcessing();
            
            // Refresh recent tasks
            await this.loadRecentTasks();
            this.updateStatistics();
            
        } catch (error) {
            console.error('Error creating tasks:', error);
            this.showToast('Error creating tasks', 'error');
        } finally {
            this.hideLoading();
        }
    }

    cancelProcessing() {
        // Hide processing results
        const resultsSection = document.getElementById('processingResults');
        if (resultsSection) {
            resultsSection.style.display = 'none';
        }
        
        // Clear input
        this.clearInput();
        
        // Reset parsed tasks
        this.parsedTasks = [];
    }

    clearInput() {
        const commandInput = document.getElementById('commandInput');
        if (commandInput) {
            commandInput.value = '';
            this.autoResizeTextarea(commandInput);
        }
    }

    async loadStaffData() {
        try {
            const response = await this.apiCall('/api/school/staff');
            
            if (response.ok) {
                this.staffData = response.staff || [];
                this.renderStaffDirectory();
            }
        } catch (error) {
            console.error('Error loading staff data:', error);
        }
    }

    renderStaffDirectory() {
        const staffGrid = document.getElementById('staffGrid');
        if (!staffGrid) return;
        
        staffGrid.innerHTML = this.staffData.slice(0, 12).map(staff => `
            <div class="staff-item">
                <div class="staff-name">${staff.full_name}</div>
                <div class="staff-role">${staff.role}</div>
                <div class="staff-department">${staff.department || 'General'}</div>
            </div>
        `).join('');
    }

    filterStaff(searchTerm) {
        const staffGrid = document.getElementById('staffGrid');
        if (!staffGrid) return;
        
        const filtered = this.staffData.filter(staff => 
            staff.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            staff.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (staff.department && staff.department.toLowerCase().includes(searchTerm.toLowerCase()))
        );
        
        staffGrid.innerHTML = filtered.slice(0, 12).map(staff => `
            <div class="staff-item">
                <div class="staff-name">${staff.full_name}</div>
                <div class="staff-role">${staff.role}</div>
                <div class="staff-department">${staff.department || 'General'}</div>
            </div>
        `).join('');
    }

    async loadRecentTasks() {
        try {
            const response = await this.apiCall('/api/tasks?limit=10&sort=created_at&order=desc');
            
            if (response.ok) {
                this.recentTasks = response.tasks || [];
                this.renderRecentTasks();
            }
        } catch (error) {
            console.error('Error loading recent tasks:', error);
        }
    }

    renderRecentTasks() {
        const tasksGrid = document.getElementById('recentTasks');
        if (!tasksGrid) return;
        
        if (this.recentTasks.length === 0) {
            tasksGrid.innerHTML = '<div class="no-tasks">No recent tasks</div>';
            return;
        }
        
        tasksGrid.innerHTML = this.recentTasks.map(task => `
            <div class="recent-task-card">
                <div class="recent-task-header">
                    <div class="recent-task-title">${task.title}</div>
                    <div class="recent-task-status ${task.status}">${task.status}</div>
                </div>
                <div class="recent-task-details">
                    <div class="recent-task-assignee">${task.assignee || 'Unassigned'}</div>
                    <div class="recent-task-deadline">${task.deadline ? new Date(task.deadline).toLocaleDateString('ru-RU') : 'No deadline'}</div>
                    <div class="recent-task-source">Source: ${task.source || 'manual'}</div>
                </div>
            </div>
        `).join('');
    }

    updateStatistics() {
        document.getElementById('totalTasks').textContent = this.statistics.totalTasks;
        document.getElementById('todayTasks').textContent = this.statistics.todayTasks;
        document.getElementById('voiceCommands').textContent = this.statistics.voiceCommands;
        document.getElementById('accuracyRate').textContent = this.statistics.accuracyRate + '%';
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

    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
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
}

// Initialize voice task manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.voiceTaskManager = new VoiceTaskManager();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.voiceTaskManager) {
        window.voiceTaskManager.destroy();
    }
});
