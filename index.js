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
        hideError(); // Hide previous errors on a new submission

        try {
            // Call the Netlify function
            const response = await fetch('/api/generate-subtasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskText }),
            });

            if (!response.ok) {
                // Handle server errors (like 500)
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

    // Function to add a task and its subtasks to the UI
    function addTask(mainTask, subtasks) {
        const li = document.createElement('li');
        li.className = 'task-item';

        const header = document.createElement('div');
        header.className = 'task-item-header';
        header.innerHTML = `<h3>${escapeHTML(mainTask)}</h3>`;
        li.appendChild(header);

        // This is the key logic: handle empty subtask arrays gracefully
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
             // Display a helpful message instead of an error
             const noSubtaskMessage = document.createElement('p');
             noSubtaskMessage.textContent = "This task seems simple enough and doesn't need to be broken down.";
             noSubtaskMessage.style.color = '#6c757d';
             noSubtaskMessage.style.marginTop = '0.5rem';
             li.appendChild(noSubtaskMessage);
        }
        
        taskList.prepend(li);
    }
    
    // Utility to manage the loading state of the button
    function setLoadingState(isLoading) {
        addTaskBtn.disabled = isLoading;
        addTaskBtn.textContent = isLoading ? 'Generating...' : 'Add Task';
    }

    // Utility to show an error message
    function showError(message) {
        errorContainer.textContent = message;
        errorContainer.style.display = 'block';
    }

    // Utility to hide the error message
    function hideError() {
        errorContainer.style.display = 'none';
    }

    // Utility to prevent XSS attacks by escaping HTML
    function escapeHTML(str) {
        const p = document.createElement('p');
        p.appendChild(document.createTextNode(str));
        return p.innerHTML;
    }
});
