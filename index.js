document.addEventListener('DOMContentLoaded', () => {
    const taskForm = document.getElementById('task-form');
    const taskInput = document.getElementById('task-input');
    const taskList = document.getElementById('task-list');
    const addTaskBtn = document.getElementById('add-task-btn');
    const errorContainer = document.getElementById('error-container');

    // Handle form submission
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
            addTask(taskText, subtasks);
            taskInput.value = '';

        } catch (error) {
            console.error('Error generating subtasks:', error);
            showError('An error occurred. Please check the function logs in your Netlify dashboard.');
        } finally {
            setLoadingState(false);
        }
    });

    function addTask(mainTask, subtasks) {
        const li = document.createElement('li');
        li.className = 'task-item';

        const header = document.createElement('div');
        header.className = 'task-item-header';
        header.innerHTML = `<h3>${escapeHTML(mainTask)}</h3>`;
        li.appendChild(header);

        if (subtasks && subtasks.length > 0) {
            const subtaskList = document.createElement('ul');
            subtaskList.className = 'subtask-list';
            subtasks.forEach(subtask => {
                const subtaskLi = document.createElement('li');
                subtaskLi.className = 'subtask-item';
                subtaskLi.textContent = subtask;
                subtaskList.appendChild(subtaskLi);
            });
            li.appendChild(subtaskList);
        } else {
             const noSubtaskMessage = document.createElement('p');
             noSubtaskMessage.textContent = "This task seems simple enough and doesn't need to be broken down.";
             noSubtaskMessage.style.color = '#6c757d';
             noSubtaskMessage.style.marginTop = '0.5rem';
             li.appendChild(noSubtaskMessage);
        }
        
        taskList.prepend(li);
    }
    
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
