// --- Configuration ---
const TASK_STORAGE_KEY = 'todolyfy-tasks';

// --- Global State ---
let tasks = [];

// --- DOM Elements ---
const taskForm = document.getElementById('task-form');
const taskInput = document.getElementById('task-input');
const taskListEl = document.getElementById('task-list');

// --- State Management ---
function loadState() {
  try {
    const storedTasks = localStorage.getItem(TASK_STORAGE_KEY);
    if (storedTasks) {
      tasks = JSON.parse(storedTasks);
      tasks.forEach(task => {
          task.isGenerating = false;
          if (task.isOpen === undefined) task.isOpen = true;
          if (task.notes === undefined) task.notes = '';
      });
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
    taskListEl.appendChild(taskElement);
  });

  initSortable();
}

function createTaskElement(task) {
  const taskItem = document.createElement('article');
  taskItem.id = task.id;
  taskItem.className = 'task-item';
  taskItem.setAttribute('data-open', task.isOpen);
  taskItem.dataset.id = task.id;

  taskItem.innerHTML = `
    <div class="task-header">
        <div class="task-header-main">
            <h2>${task.text}</h2>
            <div class="task-due-date">${task.dueDate ? `Due: ${task.dueDate}` : ''}</div>
        </div>
        <button class="delete-btn" aria-label="Delete task">&times;</button>
    </div>
    <div class="task-body">
      ${task.isGenerating ? '<div class="loading-spinner"></div>' : createSubtasksHtml(task)}
    </div>
  `;
  
  taskItem.querySelector('.task-header').addEventListener('click', (e) => {
    if (!e.target.closest('button')) handleToggleAccordion(task.id);
  });
  taskItem.querySelector('.delete-btn').addEventListener('click', () => handleDeleteTask(task.id));
  taskItem.querySelector('.regenerate-btn')?.addEventListener('click', () => handleRegenerateSubtasks(task.id, task.text));
  taskItem.querySelector('.main-due-date')?.addEventListener('change', (e) => handleSetDueDate(task.id, e.target.value));
  taskItem.querySelector('.task-notes-textarea')?.addEventListener('change', (e) => handleSetNotes(task.id, e.target.value));
  
  // Add event listeners for subtask checkboxes
  taskItem.querySelectorAll('.subtask-item').forEach(subtaskEl => {
      const subtaskId = subtaskEl.dataset.subtaskId;
      if (!subtaskId) return;
      
      const checkbox = subtaskEl.querySelector('input[type="checkbox"]');
      if(checkbox) {
          checkbox.addEventListener('change', () => handleToggleSubtask(task.id, subtaskId));
      }
  });

  return taskItem;
}

function createSubtasksHtml(task) {
    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
    return `
    <div class="task-toolbar">
        <div class="due-date-picker">
            <label for="main-due-${task.id}">Set Task Due Date:</label>
            <input type="date" class="main-due-date" id="main-due-${task.id}" value="${task.dueDate || ''}">
        </div>
        ${hasSubtasks ? '<button class="regenerate-btn">Regenerate</button>' : ''}
    </div>
    ${hasSubtasks ? `
    <ul class="subtask-list" data-task-id="${task.id}">
      ${task.subtasks.map(subtask => `
        <li class="subtask-item ${subtask.completed ? 'completed' : ''}" data-subtask-id="${subtask.id}">
          <input type="checkbox" id="${subtask.id}" ${subtask.completed ? 'checked' : ''} />
          <span class="task-text">${subtask.text}</span>
        </li>
      `).join('')}
    </ul>` : ''}
    <div class="task-notes">
        <textarea class="task-notes-textarea" placeholder="Add notes...">${task.notes || ''}</textarea>
    </div>
  `;
}

// --- Drag and Drop ---
function initSortable() {
    if (taskListEl) {
        new Sortable(taskListEl, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag',
            onEnd: () => {
                const newTasks = Array.from(taskListEl.children).map(item => {
                    return tasks.find(t => t.id === item.dataset.id);
                }).filter(Boolean);
                tasks = newTasks;
                saveTasks();
            }
        });
    }
}

// --- Event Handlers & Logic ---
async function handleFormSubmit(e) {
  e.preventDefault();
  const taskText = taskInput.value.trim();
  if (!taskText) return;

  // CORRECTED: Find the button within the form, which is more reliable
  const addTaskBtn = taskForm.querySelector('button');
  taskInput.disabled = true;
  addTaskBtn.disabled = true;
  addTaskBtn.textContent = 'Generating...';

  const newTask = {
    id: `task-${Date.now()}`,
    text: taskText,
    subtasks: [],
    isGenerating: true,
    isOpen: true,
    dueDate: null,
    notes: '',
  };

  tasks.unshift(newTask);
  renderApp(); 

  try {
    const generatedSubtasks = await generateSubtasksForTask(taskText);
    const taskToUpdate = tasks.find(t => t.id === newTask.id);
    if (taskToUpdate) {
        taskToUpdate.subtasks = (generatedSubtasks || []).map((text, i) => ({
            id: `${newTask.id}-subtask-${Date.now()}-${i}`,
            text,
            completed: false
        }));
    }
  } catch(error) {
    console.error('Error generating subtasks:', error);
    alert(`An error occurred: ${error.message}`);
    tasks = tasks.filter(t => t.id !== newTask.id);
  } finally {
    const taskToUpdate = tasks.find(t => t.id === newTask.id);
    if (taskToUpdate) {
        taskToUpdate.isGenerating = false;
    }
    saveTasks();
    renderApp();

    taskInput.value = '';
    taskInput.disabled = false;
    addTaskBtn.disabled = false;
    addTaskBtn.textContent = 'Add Task';
    taskInput.focus();
  }
}

async function generateSubtasksForTask(taskText) {
    const response = await fetch('/api/generate-subtasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskText }),
    });

    const responseText = await response.text();
    if (!response.ok) {
        let errorMessage = 'The server returned an error.';
        try {
            const errorData = JSON.parse(responseText);
            if (errorData.error) errorMessage = errorData.error;
        } catch (e) {
            if (responseText) errorMessage = responseText;
        }
        throw new Error(errorMessage);
    }
    const { subtasks } = JSON.parse(responseText);
    return subtasks || [];
}

async function handleRegenerateSubtasks(taskId, taskText) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    task.isGenerating = true;
    renderApp();

    try {
        const regeneratedSubtasks = await generateSubtasksForTask(taskText);
        task.subtasks = (regeneratedSubtasks || []).map((text, i) => ({
            id: `${taskId}-subtask-${Date.now()}-${i}`,
            text,
            completed: false
        }));
    } catch(error) {
        console.error('Error regenerating subtasks:', error);
        alert(`Failed to regenerate subtasks: ${error.message}`);
    } finally {
        task.isGenerating = false;
        saveTasks();
        renderApp();
    }
}

function handleToggleAccordion(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        task.isOpen = !task.isOpen;
        saveTasks();
        renderApp();
    }
}

function handleSetDueDate(taskId, date) {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        task.dueDate = date;
        saveTasks();
        renderApp();
    }
}

function handleSetNotes(taskId, notes) {
    const task = tasks.find(t => t.id === taskId);
    if(task) {
        task.notes = notes;
        saveTasks();
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
    if(subtask) {
        subtask.completed = !subtask.completed;
        saveTasks();
        renderApp();
    }
}

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
  if (taskForm) taskForm.addEventListener('submit', handleFormSubmit);
  loadState();
  renderApp();
});
