class TaskManager {
    constructor() {
        this.tasks = [];
        this.currentFilter = 'all';
        this.currentSort = 'created';
        this.editingTaskId = null;
        this.reminderIntervals = new Map();
        
        this.initializeElements();
        this.attachEventListeners();
        this.loadTasks();
        this.updateStats();
        this.startReminderCheck();
    }

    initializeElements() {
        this.taskForm = document.getElementById('taskForm');
        this.taskTitle = document.getElementById('taskTitle');
        this.taskDescription = document.getElementById('taskDescription');
        this.taskDeadline = document.getElementById('taskDeadline');
        this.taskPriority = document.getElementById('taskPriority');
        this.taskReminder = document.getElementById('taskReminder');
        this.taskCategory = document.getElementById('taskCategory');
        this.addTaskBtn = document.getElementById('addTaskBtn');
        this.cancelEditBtn = document.getElementById('cancelEditBtn');
        this.tasksList = document.getElementById('tasksList');
        this.noTasks = document.getElementById('noTasks');
        this.sortTasks = document.getElementById('sortTasks');
        this.modal = document.getElementById('taskModal');
        this.modalTitle = document.getElementById('modalTitle');
        this.modalContent = document.getElementById('modalContent');
        this.notificationsContainer = document.getElementById('notifications');
        
        // Stats elements
        this.totalTasksEl = document.getElementById('totalTasks');
        this.pendingTasksEl = document.getElementById('pendingTasks');
        this.completedTasksEl = document.getElementById('completedTasks');
        this.overdueTasksEl = document.getElementById('overdueTasks');
    }

    attachEventListeners() {
        // Form submission
        this.taskForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
        
        // Cancel edit
        this.cancelEditBtn.addEventListener('click', () => this.cancelEdit());
        
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.setFilter(e.target.dataset.filter));
        });
        
        // Sort dropdown
        this.sortTasks.addEventListener('change', (e) => this.setSortOrder(e.target.value));
        
        // Modal close
        document.querySelector('.close-modal').addEventListener('click', () => this.closeModal());
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closeModal();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    }

    handleFormSubmit(e) {
        e.preventDefault();
        
        const taskData = {
            title: this.taskTitle.value.trim(),
            description: this.taskDescription.value.trim(),
            deadline: this.taskDeadline.value,
            priority: this.taskPriority.value,
            reminder: this.taskReminder.value,
            category: this.taskCategory.value,
            completed: false,
            createdAt: new Date().toISOString()
        };

        if (!taskData.title) {
            this.showNotification('Please enter a task title', 'error');
            return;
        }

        if (this.editingTaskId) {
            this.updateTask(this.editingTaskId, taskData);
        } else {
            this.addTask(taskData);
        }
        
        this.resetForm();
    }

    addTask(taskData) {
        const task = {
            id: Date.now().toString(),
            ...taskData
        };
        
        this.tasks.push(task);
        this.saveTasks();
        this.renderTasks();
        this.updateStats();
        this.showNotification('Task added successfully!', 'success');
        
        // Set up reminder if provided
        if (task.reminder) {
            this.setReminder(task);
        }
    }

    updateTask(taskId, taskData) {
        const taskIndex = this.tasks.findIndex(task => task.id === taskId);
        if (taskIndex === -1) return;
        
        // Clear existing reminder
        if (this.reminderIntervals.has(taskId)) {
            clearTimeout(this.reminderIntervals.get(taskId));
            this.reminderIntervals.delete(taskId);
        }
        
        this.tasks[taskIndex] = { ...this.tasks[taskIndex], ...taskData };
        this.saveTasks();
        this.renderTasks();
        this.updateStats();
        this.showNotification('Task updated successfully!', 'success');
        
        // Set up new reminder if provided
        if (taskData.reminder) {
            this.setReminder(this.tasks[taskIndex]);
        }
        
        this.cancelEdit();
    }

    deleteTask(taskId) {
        if (!confirm('Are you sure you want to delete this task?')) return;
        
        // Clear reminder
        if (this.reminderIntervals.has(taskId)) {
            clearTimeout(this.reminderIntervals.get(taskId));
            this.reminderIntervals.delete(taskId);
        }
        
        this.tasks = this.tasks.filter(task => task.id !== taskId);
        this.saveTasks();
        this.renderTasks();
        this.updateStats();
        this.showNotification('Task deleted successfully!', 'success');
    }

    toggleTaskComplete(taskId) {
        const task = this.tasks.find(task => task.id === taskId);
        if (!task) return;
        
        task.completed = !task.completed;
        task.completedAt = task.completed ? new Date().toISOString() : null;
        
        // Clear reminder when task is completed
        if (task.completed && this.reminderIntervals.has(taskId)) {
            clearTimeout(this.reminderIntervals.get(taskId));
            this.reminderIntervals.delete(taskId);
        }
        
        this.saveTasks();
        this.renderTasks();
        this.updateStats();
        
        const message = task.completed ? 'Task completed!' : 'Task marked as pending';
        this.showNotification(message, 'success');
    }

    editTask(taskId) {
        const task = this.tasks.find(task => task.id === taskId);
        if (!task) return;
        
        this.editingTaskId = taskId;
        
        // Fill form with task data
        this.taskTitle.value = task.title;
        this.taskDescription.value = task.description || '';
        this.taskDeadline.value = task.deadline || '';
        this.taskPriority.value = task.priority;
        this.taskReminder.value = task.reminder || '';
        this.taskCategory.value = task.category;
        
        // Update UI
        this.addTaskBtn.innerHTML = '<span class="btn-icon">💾</span> Update Task';
        this.cancelEditBtn.style.display = 'block';
        
        // Scroll to form
        this.taskForm.scrollIntoView({ behavior: 'smooth' });
        this.taskTitle.focus();
    }

    cancelEdit() {
        this.editingTaskId = null;
        this.resetForm();
        this.addTaskBtn.innerHTML = '<span class="btn-icon">+</span> Add Task';
        this.cancelEditBtn.style.display = 'none';
    }

    resetForm() {
        this.taskForm.reset();
        this.taskPriority.value = 'medium';
        this.taskCategory.value = 'work';
    }

    setFilter(filter) {
        this.currentFilter = filter;
        
        // Update filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        
        this.renderTasks();
    }

    setSortOrder(sortOrder) {
        this.currentSort = sortOrder;
        this.renderTasks();
    }

    getFilteredTasks() {
        let filteredTasks = [...this.tasks];
        
        // Apply filter
        switch (this.currentFilter) {
            case 'pending':
                filteredTasks = filteredTasks.filter(task => !task.completed);
                break;
            case 'completed':
                filteredTasks = filteredTasks.filter(task => task.completed);
                break;
            case 'overdue':
                filteredTasks = filteredTasks.filter(task => 
                    !task.completed && task.deadline && new Date(task.deadline) < new Date()
                );
                break;
        }
        
        // Apply sort
        filteredTasks.sort((a, b) => {
            switch (this.currentSort) {
                case 'deadline':
                    if (!a.deadline && !b.deadline) return 0;
                    if (!a.deadline) return 1;
                    if (!b.deadline) return -1;
                    return new Date(a.deadline) - new Date(b.deadline);
                case 'priority':
                    const priorityOrder = { high: 3, medium: 2, low: 1 };
                    return priorityOrder[b.priority] - priorityOrder[a.priority];
                case 'title':
                    return a.title.localeCompare(b.title);
                case 'created':
                default:
                    return new Date(b.createdAt) - new Date(a.createdAt);
            }
        });
        
        return filteredTasks;
    }

    renderTasks() {
        const filteredTasks = this.getFilteredTasks();
        
        if (filteredTasks.length === 0) {
            this.tasksList.innerHTML = `
                <div class="no-tasks">
                    <div class="no-tasks-icon">📝</div>
                    <h3>No tasks found</h3>
                    <p>Try adjusting your filters or add a new task!</p>
                </div>
            `;
            return;
        }
        
        this.tasksList.innerHTML = filteredTasks.map(task => this.renderTaskCard(task)).join('');
        
        // Add event listeners to task action buttons
        this.attachTaskEventListeners();
    }

    renderTaskCard(task) {
        const isOverdue = !task.completed && task.deadline && new Date(task.deadline) < new Date();
        const deadlineText = task.deadline ? this.formatDate(task.deadline) : 'No deadline';
        const reminderText = task.reminder ? this.formatDate(task.reminder) : 'No reminder';
        
        return `
            <div class="task-card ${task.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}" data-task-id="${task.id}">
                <div class="task-priority ${task.priority}"></div>
                
                <div class="task-header">
                    <div>
                        <div class="task-title">${this.escapeHtml(task.title)}</div>
                        <div class="task-category">${task.category}</div>
                    </div>
                </div>
                
                ${task.description ? `<div class="task-description">${this.escapeHtml(task.description)}</div>` : ''}
                
                <div class="task-meta">
                    <div>
                        <strong>Deadline:</strong> ${deadlineText}<br>
                        <strong>Reminder:</strong> ${reminderText}
                    </div>
                    <div>
                        <strong>Priority:</strong> ${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}<br>
                        <strong>Created:</strong> ${this.formatDate(task.createdAt)}
                    </div>
                </div>
                
                <div class="task-actions">
                    <button class="task-action-btn btn-complete" onclick="taskManager.toggleTaskComplete('${task.id}')">
                        ${task.completed ? '↩️ Undo' : '✅ Complete'}
                    </button>
                    <button class="task-action-btn btn-edit" onclick="taskManager.editTask('${task.id}')">
                        ✏️ Edit
                    </button>
                    <button class="task-action-btn btn-view" onclick="taskManager.viewTask('${task.id}')">
                        👁️ View
                    </button>
                    <button class="task-action-btn btn-delete" onclick="taskManager.deleteTask('${task.id}')">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `;
    }

    attachTaskEventListeners() {
        // Event listeners are handled via onclick attributes in the HTML for simplicity
    }

    viewTask(taskId) {
        const task = this.tasks.find(task => task.id === taskId);
        if (!task) return;

        const isOverdue = !task.completed && task.deadline && new Date(task.deadline) < new Date();
        
        this.modalTitle.textContent = 'Task Details';
        this.modalContent.innerHTML = `
            <div class="task-detail-view">
                <div class="task-detail-header">
                    <h2>${this.escapeHtml(task.title)}</h2>
                    <span class="task-category" style="background: #667eea; color: white; padding: 5px 15px; border-radius: 15px; font-size: 0.9rem;">
                        ${task.category}
                    </span>
                </div>
                
                ${task.description ? `
                    <div class="task-detail-section">
                        <h4>Description</h4>
                        <p>${this.escapeHtml(task.description)}</p>
                    </div>
                ` : ''}
                
                <div class="task-detail-grid">
                    <div class="task-detail-section">
                        <h4>Priority</h4>
                        <span class="priority-badge priority-${task.priority}">
                            ${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                        </span>
                    </div>
                    
                    <div class="task-detail-section">
                        <h4>Status</h4>
                        <span class="status-badge ${task.completed ? 'completed' : isOverdue ? 'overdue' : 'pending'}">
                            ${task.completed ? 'Completed' : isOverdue ? 'Overdue' : 'Pending'}
                        </span>
                    </div>
                    
                    <div class="task-detail-section">
                        <h4>Deadline</h4>
                        <p>${task.deadline ? this.formatDate(task.deadline) : 'No deadline set'}</p>
                    </div>
                    
                    <div class="task-detail-section">
                        <h4>Reminder</h4>
                        <p>${task.reminder ? this.formatDate(task.reminder) : 'No reminder set'}</p>
                    </div>
                    
                    <div class="task-detail-section">
                        <h4>Created</h4>
                        <p>${this.formatDate(task.createdAt)}</p>
                    </div>
                    
                    ${task.completedAt ? `
                        <div class="task-detail-section">
                            <h4>Completed</h4>
                            <p>${this.formatDate(task.completedAt)}</p>
                        </div>
                    ` : ''}
                </div>
                
                <div class="modal-actions" style="margin-top: 20px; display: flex; gap: 10px; justify-content: center;">
                    <button class="btn btn-primary" onclick="taskManager.editTask('${task.id}'); taskManager.closeModal();">
                        Edit Task
                    </button>
                    ${!task.completed ? `
                        <button class="btn btn-secondary" onclick="taskManager.toggleTaskComplete('${task.id}'); taskManager.closeModal();">
                            Mark Complete
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
        
        // Add styles for the modal content
        const style = document.createElement('style');
        style.textContent = `
            .task-detail-view { line-height: 1.6; }
            .task-detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
            .task-detail-section { margin-bottom: 15px; }
            .task-detail-section h4 { margin-bottom: 5px; color: #333; font-weight: 600; }
            .task-detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
            .priority-badge { padding: 4px 12px; border-radius: 15px; font-size: 0.85rem; font-weight: 500; }
            .priority-high { background: #dc3545; color: white; }
            .priority-medium { background: #ffc107; color: #333; }
            .priority-low { background: #28a745; color: white; }
            .status-badge { padding: 4px 12px; border-radius: 15px; font-size: 0.85rem; font-weight: 500; }
            .status-completed { background: #28a745; color: white; }
            .status-overdue { background: #dc3545; color: white; }
            .status-pending { background: #17a2b8; color: white; }
        `;
        document.head.appendChild(style);
        
        this.openModal();
    }

    openModal() {
        this.modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        this.modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    setReminder(task) {
        if (!task.reminder) return;

        const reminderTime = new Date(task.reminder).getTime();
        const now = new Date().getTime();
        const timeDiff = reminderTime - now;

        if (timeDiff > 0) {
            const timeoutId = setTimeout(() => {
                if (!task.completed) {
                    this.showNotification(`Reminder: ${task.title}`, 'warning', 10000);
                    
                    // Browser notification if permission granted
                    if ('Notification' in window && Notification.permission === 'granted') {
                        new Notification('Task Reminder', {
                            body: task.title,
                            icon: '📝'
                        });
                    }
                }
                this.reminderIntervals.delete(task.id);
            }, timeDiff);

            this.reminderIntervals.set(task.id, timeoutId);
        }
    }

    startReminderCheck() {
        // Check for reminders every minute
        setInterval(() => {
            this.checkReminders();
        }, 60000);
        
        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    checkReminders() {
        const now = new Date();
        this.tasks.forEach(task => {
            if (!task.completed && task.reminder && !this.reminderIntervals.has(task.id)) {
                const reminderTime = new Date(task.reminder);
                if (reminderTime <= now) {
                    this.showNotification(`Overdue Reminder: ${task.title}`, 'warning', 10000);
                }
            }
        });
    }

    updateStats() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(task => task.completed).length;
        const pending = this.tasks.filter(task => !task.completed).length;
        const overdue = this.tasks.filter(task => 
            !task.completed && task.deadline && new Date(task.deadline) < new Date()
        ).length;

        this.totalTasksEl.textContent = total;
        this.pendingTasksEl.textContent = pending;
        this.completedTasksEl.textContent = completed;
        this.overdueTasksEl.textContent = overdue;
    }

    showNotification(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div>${message}</div>
            <button class="notification-close">&times;</button>
        `;

        this.notificationsContainer.appendChild(notification);

        // Auto remove
        const autoRemove = setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, duration);

        // Manual close
        notification.querySelector('.notification-close').addEventListener('click', () => {
            clearTimeout(autoRemove);
            notification.remove();
        });
    }

    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + Enter to submit form
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            if (this.taskTitle.value.trim()) {
                this.taskForm.dispatchEvent(new Event('submit'));
            }
        }
        
        // Escape to cancel edit or close modal
        if (e.key === 'Escape') {
            if (this.modal.style.display === 'block') {
                this.closeModal();
            } else if (this.editingTaskId) {
                this.cancelEdit();
            }
        }
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const options = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return date.toLocaleDateString('en-US', options);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    saveTasks() {
        // Note: localStorage is not supported in Claude.ai artifacts
        // In a real implementation, you would use:
        // localStorage.setItem('tasks', JSON.stringify(this.tasks));
        console.log('Tasks saved (localStorage not available in this environment)');
    }

    loadTasks() {
        // Note: localStorage is not supported in Claude.ai artifacts
        // In a real implementation, you would use:
        // const savedTasks = localStorage.getItem('tasks');
        // if (savedTasks) {
        //     this.tasks = JSON.parse(savedTasks);
        //     this.tasks.forEach(task => {
        //         if (task.reminder) {
        //             this.setReminder(task);
        //         }
        //     });
        // }
        
        // Demo data for testing
        this.tasks = [
            {
                id: '1',
                title: 'Complete project proposal',
                description: 'Finish the quarterly project proposal and submit to management',
                deadline: new Date(Date.now() + 86400000 * 3).toISOString(), // 3 days from now
                priority: 'high',
                reminder: new Date(Date.now() + 86400000 * 2).toISOString(), // 2 days from now
                category: 'work',
                completed: false,
                createdAt: new Date(Date.now() - 86400000).toISOString() // 1 day ago
            },
            {
                id: '2',
                title: 'Buy groceries',
                description: 'Milk, bread, eggs, vegetables',
                deadline: '',
                priority: 'medium',
                reminder: '',
                category: 'personal',
                completed: false,
                createdAt: new Date(Date.now() - 86400000 * 2).toISOString() // 2 days ago
            },
            {
                id: '3',
                title: 'Review quarterly reports',
                description: '',
                deadline: new Date(Date.now() - 86400000).toISOString(), // Yesterday (overdue)
                priority: 'high',
                reminder: '',
                category: 'work',
                completed: false,
                createdAt: new Date(Date.now() - 86400000 * 3).toISOString() // 3 days ago
            }
        ];
        
        this.renderTasks();
        
        // Set up reminders for demo tasks
        this.tasks.forEach(task => {
            if (task.reminder) {
                this.setReminder(task);
            }
        });
    }
}

// Initialize the task manager when the page loads
let taskManager;
document.addEventListener('DOMContentLoaded', () => {
    taskManager = new TaskManager();
});