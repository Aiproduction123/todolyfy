// --- Configuration ---
const TASK_STORAGE_KEY = 'todolyfy-tasks';

// --- Global State ---
let tasks = [];

// --- DOM Elements ---
const taskForm = document.getElementById('task-form');
const taskInput = document.getElementById('task-input');
const taskListEl = document.getElementById('task-list');

// --- State Management ---
function loadTasks() {
  try {
    const storedTasks = localStorage.getItem(TASK_STORAGE_KEY);
    if (storedTasks) {
      tasks = JSON.parse(storedTasks);
      tasks.forEach(task => task.isGenerating = false);
    }
  } catch (error) {
    console.error("Failed to load tasks from localStorage", error);
    tasks = [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(tasks));
  } catch (error) {
    console.error("Failed to save tasks to localStorage", error);
  }
}

// --- Rendering ---
function renderApp() {
  if (!taskListEl) return;
  taskListEl.innerHTML = '';
  tasks.forEach(task => {
    const taskElement = createTaskElement(task);
    taskListEl.prepend(taskElement);
  });
}

function createTaskElement(task) {
  const taskItem = document.createElement('article');
  taskItem.id = task.id;
  taskItem.className = 'task-item';
  taskItem.setAttribute('aria-label', `Task: ${task.text}`);

  taskItem.innerHTML = `
    <div class="task-header">
      <h2>${task.text}</h2>
      <button class="delete-btn" aria-label="Delete task">&times;</button>
    </div>
    <div class="task-body">
      ${task.isGenerating ? '<div class="loading-spinner"></div>' : createSubtasksHtml(task)}
    </div>
  `;

  taskItem.querySelector('.delete-btn')?.addEventListener('click', () => handleDeleteTask(task.id));
  taskItem.querySelectorAll('.subtask-item').forEach((subtaskEl) => {
    const subtaskId = subtaskEl.dataset.subtaskId;
    if (!subtaskId) return;
    subtaskEl.querySelector('input[type="checkbox"]')?.addEventListener('change', () => handleToggleSubtask(task.id, subtaskId));
    subtaskEl.querySelector('.subtask-actions .delete-btn')?.addEventListener('click', () => handleDeleteSubtask(task.id, subtaskId));
    subtaskEl.querySelector('.subtask-actions .edit-btn')?.addEventListener('click', (e) => handleEditSubtask(e.currentTarget, task.id, subtaskId));
  });

  return taskItem;
}

function createSubtasksHtml(task) {
    if (!task.subtasks || task.subtasks.length === 0) {
        return '';
    }
    return `
    <ul class="subtask-list">
      ${task.subtasks.map(subtask => `
        <li class="subtask-item ${subtask.completed ? 'completed' : ''}" data-subtask-id="${subtask.id}">
          <div class="subtask-content">
            <input type="checkbox" id="${subtask.id}" ${subtask.completed ? 'checked' : ''} />
            <label for="${subtask.id}">${subtask.text}</label>
          </div>
          <div class="subtask-actions">
            <button class="edit-btn" aria-label="Edit subtask">✏️</button>
            <button class="delete-btn" aria-label="Delete subtask">🗑️</button>
          </div>
        </li>
      `).join('')}
    </ul>
  `;
}

// --- Event Handlers & Logic ---

async function handleFormSubmit(e) {
  e.preventDefault();
  const taskText = taskInput.value.trim();
  if (!taskText) return;

  const newTask = {
    id: `task-${Date.now()}`,
    text: taskText,
    subtasks: [],
    isGenerating: true,
  };

  tasks.push(newTask);
  saveTasks();
  renderApp(); 

  const originalTaskText = taskInput.value;
  taskInput.value = '';
  taskInput.disabled = true;
  taskForm.querySelector('button').disabled = true;

  try {
    const response = await fetch('/api/generate-subtasks', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ taskText: originalTaskText }),
    });

    // First, get the raw response text. This avoids parsing errors.
    const responseText = await response.text();

    if (!response.ok) {
        // If we have an error, try to parse the text as JSON, 
        // but fall back to the raw text if parsing fails.
        let errorMessage = 'The server returned an error.';
        try {
            const errorData = JSON.parse(responseText);
            if (errorData && errorData.error) {
                errorMessage = errorData.error;
            }
        } catch (e) {
            // Parsing failed, use the raw text as the error, if available.
            if (responseText) {
                errorMessage = responseText;
            }
        }
        throw new Error(errorMessage);
    }
    
    // If the response was successful, parse the text we already fetched.
    const { subtasks: generatedSubtasks } = JSON.parse(responseText);
    
    const taskIndex = tasks.findIndex(t => t.id === newTask.id);
    if (taskIndex > -1) {
      if (generatedSubtasks && generatedSubtasks.length > 0) {
        tasks[taskIndex].subtasks = generatedSubtasks.map((text, i) => ({
          id: `${newTask.id}-subtask-${i}`, text, completed: false
        }));
      } else {
         tasks.splice(taskIndex, 1);
         alert("The AI couldn't generate subtasks for this item. Please try a different task.");
      }
    }
  } catch (error) {
    console.error('Error generating subtasks:', error);
    // Now the alert will show a more useful message from the server.
    alert(`An error occurred: ${error.message}`);
    const taskIndex = tasks.findIndex(t => t.id === newTask.id);
    if (taskIndex > -1) {
      tasks.splice(taskIndex, 1);
    }
    taskInput.value = originalTaskText;
  } finally {
    const taskIndex = tasks.findIndex(t => t.id === newTask.id);
    if (taskIndex > -1) {
      tasks[taskIndex].isGenerating = false;
    }
    saveTasks();
    renderApp();
    taskInput.disabled = false;
    taskForm.querySelector('button').disabled = false;
    taskInput.focus();
  }
}

function handleDeleteTask(taskId) {
  tasks = tasks.filter(task => task.id !== taskId);
  saveTasks();
  renderApp();
}

function handleToggleSubtask(taskId, subtaskId) {
  const task = tasks.find(t => t.id === taskId);
  const subtask = task?.subtasks.find(st => st.id === subtaskId);
  if (subtask) {
    subtask.completed = !subtask.completed;
    saveTasks();
    renderApp();
  }
}

function handleDeleteSubtask(taskId, subtaskId) {
  const task = tasks.find(t => t.id === taskId);
  if (task) {
    task.subtasks = task.subtasks.filter(st => st.id !== subtaskId);
    saveTasks();
    renderApp();
  }
}

function handleEditSubtask(editBtn, taskId, subtaskId) {
  const subtaskItem = editBtn.closest('.subtask-item');
  const label = subtaskItem.querySelector('label');
  const isEditing = editBtn.getAttribute('aria-label') === 'Save subtask';

  if (isEditing) {
    const editInput = subtaskItem.querySelector('.edit-input');
    const newText = editInput.value.trim();
    const task = tasks.find(t => t.id === taskId);
    const subtask = task?.subtasks.find(st => st.id === subtaskId);
    if (subtask && newText) {
      subtask.text = newText;
    }
    saveTasks();
    renderApp();
  } else {
    editBtn.innerHTML = '💾';
    editBtn.setAttribute('aria-label', 'Save subtask');
    const currentText = label.textContent || '';
    label.style.display = 'none';
    const editInput = document.createElement('input');
    editInput.type = 'text';
    editInput.value = currentText;
    editInput.className = 'edit-input';
    editInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); editBtn.click(); }
      else if (e.key === 'Escape') { renderApp(); }
    });
    label.parentElement.appendChild(editInput);
    editInput.focus();
    editInput.select();
  }
}

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
  if (taskForm) taskForm.addEventListener('submit', handleFormSubmit);
  loadTasks();
  renderApp();
});