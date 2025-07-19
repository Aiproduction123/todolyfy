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
      // Ensure backward compatibility
      tasks.forEach(task => {
          task.isGenerating = false;
          if (task.isOpen === undefined) task.isOpen = true;
          if (task.notes === undefined) task.notes = ''; // Add notes field if missing
      });
    }
  } catch (error) {
    console.error("Failed to load state from localStorage", error);
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
  
  taskListEl.innerHTML = ''; // Clear and re-render
  tasks.forEach(task => {
    const taskElement = createTaskElement(task);
    taskListEl.appendChild(taskElement); // Use appendChild to maintain order
  });

  initSortable(); // Initialize drag-and-drop on the new elements
}


function createTaskElement(task) {
  const taskItem = document.createElement('article');
  taskItem.id = task.id;
  taskItem.className = 'task-item';
  taskItem.setAttribute('data-open', task.isOpen);
  taskItem.dataset.id = task.id; // For SortableJS

  taskItem.innerHTML = `
    <div class="task-header">
        <div class="task-header-main">
            <h2>${task.text}</h2>
            <div class="task-due-date">${task.dueDate ? `Due: ${task.dueDate}` : ''}</div>
        </div>
        <div class="task-controls">
            <button class="delete-btn" aria-label="Delete task">&times;</button>
        </div>
    </div>
    <div class="task-body">
      ${task.isGenerating ? '<div class="loading-spinner"></div>' : createSubtasksHtml(task)}
    </div>
  `;
  
  // Event Listeners
  taskItem.querySelector('.task-header').addEventListener('click', (e) => {
    if (!e.target.closest('button')) handleToggleAccordion(task.id);
  });
  taskItem.querySelector('.delete-btn').addEventListener('click', () => handleDeleteTask(task.id));
  taskItem.querySelector('.regenerate-btn')?.addEventListener('click', () => handleRegenerateSubtasks(task.id, task.text));
  taskItem.querySelector('.main-due-date').addEventListener('change', (e) => handleSetDueDate(task.id, null, e.target.value));
  taskItem.querySelector('.task-notes-textarea')?.addEventListener('change', (e) => handleSetNotes(task.id, e.target.value));
  
  taskItem.querySelectorAll('.subtask-item').forEach((subtaskEl) => {
    const subtaskId = subtaskEl.dataset.subtaskId;
    subtaskEl.querySelector('input[type="checkbox"]').addEventListener('change', () => handleToggleSubtask(task.id, subtaskId));
    subtaskEl.querySelector('.subtask-actions .delete-btn').addEventListener('click', () => handleDeleteSubtask(task.id, subtaskId));
    subtaskEl.querySelector('.subtask-actions .edit-btn').addEventListener('click', (e) => handleEditSubtask(e.currentTarget, task.id, subtaskId));
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
    </ul>` : 'No subtasks yet.'}
    <div class="task-notes">
        <textarea class="task-notes-textarea" placeholder="Add notes...">${task.notes || ''}</textarea>
    </div>
  `;
}

// --- Drag and Drop ---
function initSortable() {
    // Main task list sorting
    if (taskListEl) {
        new Sortable(taskListEl, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag',
            onEnd: (evt) => {
                const newTasks = [];
                taskListEl.querySelectorAll('.task-item').forEach(item => {
                    const task = tasks.find(t => t.id === item.dataset.id);
                    if (task) newTasks.push(task);
                });
                tasks = newTasks;
                saveTasks();
            }
        });
    }

    // Subtask list sorting
    document.querySelectorAll('.subtask-list').forEach(list => {
        new Sortable(list, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag',
            onEnd: (evt) => {
                const parentTaskId = evt.target.dataset.taskId;
                const parentTask = tasks.find(t => t.id === parentTaskId);
                if (!parentTask) return;

                const newSubtasks = [];
                evt.target.querySelectorAll('.subtask-item').forEach(item => {
                    const subtask = parentTask.subtasks.find(st => st.id === item.dataset.subtaskId);
                    if (subtask) newSubtasks.push(subtask);
                });
                parentTask.subtasks = newSubtasks;
                saveTasks();
            }
        });
    });
}


// --- Event Handlers & Logic ---

async function handleFormSubmit(e) {
  e.preventDefault();
  const taskText = taskInput.value.trim();
  if (!taskText) return;

  // Disable form to prevent multiple submissions
  taskInput.disabled = true;
  taskForm.querySelector('button').disabled = true;

  const newTask = {
    id: `task-${Date.now()}`,
    text: taskText,
    subtasks: [],
    isGenerating: true,
    isOpen: true,
    dueDate: null,
    notes: '',
  };

  // Add task to the start of the list and render immediately
  tasks.unshift(newTask);
  renderApp(); 

  try {
    const generatedSubtasks = await generateSubtasksForTask(taskText);
    
    // Find the task by ID and update it with the new subtasks
    const taskToUpdate = tasks.find(t => t.id === newTask.id);
    if (taskToUpdate) {
        taskToUpdate.subtasks = (generatedSubtasks || []).map((text, i) => ({
            id: `${newTask.id}-subtask-${Date.now()}-${i}`,
            text,
            completed: false
        }));
        if (!generatedSubtasks || generatedSubtasks.length === 0) {
            alert("The AI couldn't generate subtasks for this item. Please try a different task.");
        }
    }
  } catch(error) {
    console.error('Error generating subtasks:', error);
    alert(`An error occurred: ${error.message}`);
    // If there was an error, remove the task from the list
    tasks = tasks.filter(t => t.id !== newTask.id);
  } finally {
    // Find the task again to turn off the spinner, then re-render and save
    const taskToUpdate = tasks.find(t => t.id === newTask.id);
    if (taskToUpdate) {
        taskToUpdate.isGenerating = false;
    }
    saveTasks();
    renderApp();

    // Re-enable the form
    taskInput.value = '';
    taskInput.disabled = false;
    taskForm.querySelector('button').disabled = false;
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
            if (errorData && errorData.error) errorMessage = errorData.error;
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

function handleSetDueDate(taskId, subtaskId, date) {
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
  loadState();
  renderApp();
});