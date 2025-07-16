document.addEventListener('DOMContentLoaded', () => {
    const taskForm = document.getElementById('task-form');
    const taskInput = document.getElementById('task-input');
    const taskList = document.getElementById('task-list');
    const addTaskBtn = document.getElementById('add-task-btn');
    const errorContainer = document.getElementById('error-container');

    // Load tasks from localStorage when the page opens
    loadTasks();

    // --- EVENT LISTENERS ---

    // Handle form submission to add a new main task
    taskForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const taskText = taskInput.value.trim();
        if (!taskText) return;

        setLoadingState(true);
        hideError();

        try {
            const response = await fetch('/api/generate-subtasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskText }),
            });

            if (!response.ok) {
                throw new Error('The server failed to generate subtasks.');
            }

            const subtasks = await response.json();
            createMainTask(taskText, subtasks);
            taskInput.value = '';
            saveTasks(); // Save after adding a new task

        } catch (error) {
            console.error('Error generating subtasks:', error);
            showError('An error occurred. Please check the function logs.');
        } finally {
            setLoadingState(false);
        }
    });

    // Use event delegation for all actions on the task list
    taskList.addEventListener('click', (event) => {
        const target = event.target;
        
        // Handle checkbox clicks
        if (target.matches('.task-checkbox')) {
            const taskElement = target.closest('.task-item, .subtask-item');
            taskElement.classList.toggle('done');
            saveTasks(); // Save after toggling done state
        }

        // Handle delete button clicks
        if (target.matches('.delete-btn, .delete-btn *')) {
            const taskElement = target.closest('.task-item, .subtask-item');
            taskElement.remove();
            saveTasks(); // Save after deleting
        }

        // Handle edit button clicks
        if (target.matches('.edit-btn, .edit-btn *')) {
            const taskElement = target.closest('.task-item, .subtask-item');
            toggleEditMode(taskElement);
        }
    });

    // --- UI CREATION FUNCTIONS ---

    // Creates a complete main task with its subtasks
    function createMainTask(mainTaskText, subtasks, isDone = false) {
        const li = document.createElement('li');
        li.className = 'task-item';
        if (isDone) li.classList.add('done');

        const mainTaskContent = createTaskContent(mainTaskText, isDone);
        li.appendChild(mainTaskContent);
        
        if (subtasks && subtasks.length > 0) {
            const subtaskList = document.createElement('ul');
            subtaskList.className = 'subtask-list';
            subtasks.forEach(subtask => {
                // --- FIX STARTS HERE ---
                // This handles both strings (from AI) and objects (from localStorage)
                const isSubtaskObject = typeof subtask === 'object' && subtask !== null;
                const subtaskText = isSubtaskObject ? subtask.text : subtask;
                const subtaskIsDone = isSubtaskObject ? subtask.isDone : false;

                const subtaskLi = document.createElement('li');
                subtaskLi.className = 'subtask-item';
                if (subtaskIsDone) subtaskLi.classList.add('done');

                const subtaskContent = createTaskContent(subtaskText, subtaskIsDone);
                subtaskLi.appendChild(subtaskContent);
                subtaskList.appendChild(subtaskLi);
                // --- FIX ENDS HERE ---
            });
            li.appendChild(subtaskList);
        }
        
        taskList.prepend(li);
    }

    // Creates the inner HTML for any task or subtask
    function createTaskContent(text, isChecked) {
        const fragment = document.createDocumentFragment();

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'task-checkbox';
        checkbox.checked = isChecked;
        fragment.appendChild(checkbox);

        const textSpan = document.createElement('span');
        textSpan.className = 'task-text';
        textSpan.textContent = text;
        fragment.appendChild(textSpan);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'task-actions';
        actionsDiv.innerHTML = `
            <button class="action-btn edit-btn" aria-label="Edit task">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="action-btn delete-btn" aria-label="Delete task">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
        `;
        fragment.appendChild(actionsDiv);

        return fragment;
    }

    // --- EDIT MODE LOGIC ---

    function toggleEditMode(taskElement) {
        const textSpan = taskElement.querySelector('.task-text');
        const currentText = textSpan.textContent;

        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.className = 'task-text'; // Reuse style
        
        textSpan.replaceWith(input);
        input.focus();

        const saveChanges = () => {
            const newText = input.value.trim();
            textSpan.textContent = newText || currentText;
            input.replaceWith(textSpan);
            saveTasks(); // Save after editing
        };
        
        input.addEventListener('blur', saveChanges);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                saveChanges();
            }
        });
    }

    // --- DATA PERSISTENCE FUNCTIONS ---
    function saveTasks() {
        const tasks = [];
        document.querySelectorAll('#task-list > .task-item').forEach(li => {
            const mainTaskText = li.querySelector('.task-text').textContent;
            const mainTaskDone = li.classList.contains('done');
            const subtasks = [];
            li.querySelectorAll('.subtask-item').forEach(subLi => {
                subtasks.push({
                    text: subLi.querySelector('.task-text').textContent,
                    isDone: subLi.classList.contains('done')
                });
            });
            tasks.push({ text: mainTaskText, isDone: mainTaskDone, subtasks });
        });
        localStorage.setItem('todolyfyTasks', JSON.stringify(tasks));
    }

    function loadTasks() {
        const tasksJSON = localStorage.getItem('todolyfyTasks');
        if (tasksJSON) {
            const tasks = JSON.parse(tasksJSON);
            taskList.innerHTML = '';
            // Load tasks in reverse so they appear in the correct order (newest first)
            tasks.reverse().forEach(task => {
                createMainTask(task.text, task.subtasks, task.isDone);
            });
        }
    }

    // --- UTILITY FUNCTIONS ---
    
    function setLoadingState(isLoading) {
        if (addTaskBtn) {
            addTaskBtn.disabled = isLoading;
            addTaskBtn.textContent = isLoading ? 'Generating...' : 'Add Task';
        }
    }

    function showError(message) {
        if(errorContainer) {
            errorContainer.textContent = message;
            errorContainer.style.display = 'block';
        }
    }

    function hideError() {
        if(errorContainer) {
            errorContainer.style.display = 'none';
        }
    }

    function escapeHTML(str) {
        const p = document.createElement('p');
        p.appendChild(document.createTextNode(str));
        return p.innerHTML;
    }
});
