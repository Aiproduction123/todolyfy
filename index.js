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
  
  const openTasks = new Set(tasks.filter(t => t.isOpen).map(t => t.id));
  
  taskListEl.innerHTML = '';
  tasks.forEach(task => {
    if (openTasks.has(task.id)) task.isOpen = true;
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
  taskItem.querySelector('.task-notes-textarea')?.addEventListener('change', (e) => handleSetNotes(task.id, e.target.value));
  
  taskItem.querySelectorAll('.subtask-item').forEach(subtaskEl => {
      const subtaskId = subtaskEl.dataset.subtaskId;
      if (!subtaskId) return;
      
      subtaskEl.querySelector('input[type="checkbox"]')?.addEventListener('change', () => handleToggleSubtask(task.id, subtaskId));
      subtaskEl.querySelector('.edit-btn')?.addEventListener('click', (e) => handleEditSubtask(e.currentTarget, task.id, subtaskId));
      subtaskEl.querySelector('.delete-btn')?.addEventListener('click', () => handleDeleteSubtask(task.id, subtaskId));
  });

  return taskItem;
}

function createSubtasksHtml(task) {
    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
    
    // REMOVED: Regenerate button and toolbar. Updated empty message.
    return `
    ${hasSubtasks ? `
    <ul class="subtask-list" data-task-id="${task.id}">
      ${task.subtasks.map(subtask => `
        <li class="subtask-item ${subtask.completed ? 'completed' : ''}" data-subtask-id="${subtask.id}">
          <div class="subtask-content">
            <input type="checkbox" id="${subtask.id}" ${subtask.completed ? 'checked' : ''} />
            <span class="task-text">${subtask.text}</span>
          </div>
          <div class="subtask-actions">
            <button class="edit-btn" aria-label="Edit subtask">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
            </button>
            <button class="delete-btn" aria-label="Delete subtask">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          </div>
        </li>
      `).join('')}
    </ul>` : '<p class="no-subtasks-message">No subtasks were generated for this task.</p>'}
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
    
    try {
        const { subtasks } = JSON.parse(responseText);
        return subtasks || [];
    } catch (e) {
        console.error("Failed to parse successful AI response as JSON:", responseText);
        return [];
    }
}

// REMOVED: handleRegenerateSubtasks function is no longer needed

function handleToggleAccordion(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        task.isOpen = !task.isOpen;
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
  const contentDiv = subtaskItem.querySelector('.subtask-content');
  const isEditing = editBtn.getAttribute('aria-label') === 'Save subtask';

  if (isEditing) {
    const editInput = contentDiv.querySelector('.edit-input');
    const newText = editInput.value.trim();
    const task = tasks.find(t => t.id === taskId);
    const subtask = task?.subtasks.find(st => st.id === subtaskId);
    if (subtask && newText) {
      subtask.text = newText;
    }
    saveTasks();
    renderApp();
  } else {
    editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`;
    editBtn.setAttribute('aria-label', 'Save subtask');
    const textSpan = contentDiv.querySelector('.task-text');
    const currentText = textSpan.textContent || '';
    
    const editInput = document.createElement('input');
    editInput.type = 'text';
    editInput.value = currentText;
    editInput.className = 'edit-input';
    
    contentDiv.replaceChild(editInput, textSpan);
    
    editInput.focus();
    editInput.select();

    const saveOnEnter = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            editBtn.click();
        } else if (e.key === 'Escape') {
            renderApp();
        }
    };
    editInput.addEventListener('keydown', saveOnEnter);
  }
}

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
  if (taskForm) taskForm.addEventListener('submit', handleFormSubmit);
  loadState();
  renderApp();
});
