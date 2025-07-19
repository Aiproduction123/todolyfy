// --- Configuration ---
const TASK_STORAGE_KEY = 'todolyfy-tasks';

// --- Global State ---
let tasks = [];
let currentView = 'active'; // 'active' or 'completed'

// --- DOM Elements ---
const taskForm = document.getElementById('task-form');
const taskInput = document.getElementById('task-input');
const taskListEl = document.getElementById('task-list');
const tabsContainer = document.querySelector('.task-tabs');

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
          if (task.completed === undefined) task.completed = false;
          // Add a new property to track editing state, default to false
          task.isEditingNotes = false; 
      });
    }
  } catch (error) {
    console.error("Failed to load tasks from localStorage", error);
    tasks = [];
  }
}

function saveTasks() {
  try {
    // Before saving, ensure all tasks are not in edit mode
    tasks.forEach(task => task.isEditingNotes = false);
    localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(tasks));
  } catch (error) {
    console.error("Failed to save tasks to localStorage", error);
  }
}

// --- Rendering ---
function renderApp() {
  if (!taskListEl) return;
  
  const tasksToRender = tasks.filter(task => {
      if (currentView === 'active') return !task.completed;
      if (currentView === 'completed') return task.completed;
      return true;
  });

  // Preserve focus and scroll position
  const activeElementId = document.activeElement?.id;
  const scrollPosition = window.scrollY;

  taskListEl.innerHTML = '';
  tasksToRender.forEach(task => {
    const taskElement = createTaskElement(task);
    taskListEl.appendChild(taskElement);
  });

  // Restore focus if possible
  if (activeElementId) {
      const elementToFocus = document.getElementById(activeElementId);
      if (elementToFocus && elementToFocus.tagName === 'TEXTAREA') {
          elementToFocus.focus();
          elementToFocus.select();
      }
  }
  window.scrollTo(0, scrollPosition);


  updateActiveTab();
  initSortable();
}

function createTaskElement(task) {
  const taskItem = document.createElement('article');
  taskItem.id = task.id;
  taskItem.className = `task-item ${task.completed ? 'completed' : ''}`;
  taskItem.setAttribute('data-open', task.isOpen);
  taskItem.dataset.id = task.id;

  taskItem.innerHTML = `
    <div class="task-header">
        <div class="task-header-main">
            <input type="checkbox" class="task-checkbox" id="task-${task.id}" ${task.completed ? 'checked' : ''} />
            <h2>${task.text}</h2>
        </div>
        <div class="task-actions">
            <button class="edit-btn" aria-label="Edit task">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
            </button>
            <button class="delete-btn" aria-label="Delete task">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
        </div>
    </div>
    <div class="task-body">
      ${task.isGenerating ? '<div class="loading-spinner"></div>' : createSubtasksHtml(task)}
    </div>
  `;
  
  taskItem.querySelector('.task-header').addEventListener('click', (e) => {
    if (e.target.closest('button') || e.target.matches('.task-checkbox')) return;
    handleToggleAccordion(task.id);
  });
  
  const taskActions = taskItem.querySelector('.task-header .task-actions');
  taskActions.querySelector('.delete-btn').addEventListener('click', () => handleDeleteTask(task.id));
  taskActions.querySelector('.edit-btn').addEventListener('click', (e) => handleEditTask(e.currentTarget, task.id));
  
  taskItem.querySelector('.task-header .task-checkbox').addEventListener('change', () => handleToggleTask(task.id));

  // --- NEW NOTES EVENT LISTENERS ---
  const notesContainer = taskItem.querySelector('.task-notes');
  if(notesContainer) {
      notesContainer.querySelector('.notes-display')?.addEventListener('click', () => handleEnterNotesEditMode(task.id));
      notesContainer.querySelector('.notes-editor .save-btn')?.addEventListener('click', () => handleSaveNotes(task.id));
      notesContainer.querySelector('.notes-editor .cancel-btn')?.addEventListener('click', () => handleCancelNotesEdit(task.id));
      const textarea = notesContainer.querySelector('textarea');
      if (textarea) {
          textarea.addEventListener('input', autoResizeTextarea);
          // Initial resize
          autoResizeTextarea({ target: textarea });
      }
  }
  
  taskItem.querySelectorAll('.subtask-item').forEach(subtaskEl => {
      const subtaskId = subtaskEl.dataset.subtaskId;
      if (!subtaskId) return;
      
      subtaskEl.querySelector('input[type="checkbox"]')?.addEventListener('change', () => handleToggleSubtask(task.id, subtaskId));
      subtaskEl.querySelector('.edit-btn')?.addEventListener('click', (e) => handleEditSubtask(e.currentTarget, task.id, subtaskId));
      subtaskEl.querySelector('.delete-btn')?.addEventListener('click', () => handleDeleteSubtask(task.id, subtaskId));
  });

  return taskItem;
}

// --- COMPLETELY REWRITTEN createSubtasksHtml FUNCTION ---
function createSubtasksHtml(task) {
    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
    const hasNotes = task.notes && task.notes.trim() !== '';

    return `
    ${hasSubtasks ? `
    <ul class="subtask-list" data-task-id="${task.id}">
      ${task.subtasks.map(subtask => `
        <li class="subtask-item ${subtask.completed ? 'completed' : ''}" data-subtask-id="${subtask.id}">
          <div class="subtask-content">
            <input type="checkbox" class="task-checkbox" id="${subtask.id}" ${subtask.completed ? 'checked' : ''} />
            <span class="task-text">${subtask.text}</span>
          </div>
          <div class="task-actions">
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
    
    <!-- NEW TRELLO-STYLE NOTES STRUCTURE -->
    <div class="task-notes ${task.isEditingNotes ? 'is-editing' : ''}">
        <!-- View Mode -->
        <div class="notes-display ${hasNotes ? '' : 'is-empty'}">
            ${hasNotes ? task.notes : 'Add a more detailed description...'}
        </div>

        <!-- Edit Mode -->
        <div class="notes-editor">
            <textarea id="notes-textarea-${task.id}" placeholder="Add notes..." rows="1">${task.notes || ''}</textarea>
            <div class="notes-editor-actions">
                <button class="save-btn">Save</button>
                <button class="cancel-btn">Cancel</button>
            </div>
        </div>
    </div>
  `;
}

// --- Drag and Drop ---
function initSortable() {
    if (taskListEl && currentView === 'active') {
        new Sortable(taskListEl, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag',
            onEnd: () => {
                const activeTasks = Array.from(taskListEl.children).map(item => {
                    return tasks.find(t => t.id === item.dataset.id);
                }).filter(Boolean);
                const completedTasks = tasks.filter(t => t.completed);
                tasks = [...activeTasks, ...completedTasks];
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
    completed: false,
    subtasks: [],
    isGenerating: true,
    isOpen: true,
    notes: '',
    isEditingNotes: false, // Default state
  };

  tasks.unshift(newTask);
  currentView = 'active';
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

function handleToggleAccordion(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        task.isOpen = !task.isOpen;
        saveTasks();
        renderApp();
    }
}

// --- NEW NOTES HANDLER FUNCTIONS ---
function handleEnterNotesEditMode(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        task.isEditingNotes = true;
        renderApp(); // Re-render to show the editor
    }
}

function handleSaveNotes(taskId) {
    const task = tasks.find(t => t.id === taskId);
    const taskElement = document.getElementById(taskId);
    if (task && taskElement) {
        const textarea = taskElement.querySelector(`#notes-textarea-${taskId}`);
        task.notes = textarea.value;
        task.isEditingNotes = false; // Exit edit mode
        saveTasks();
        renderApp();
    }
}

function handleCancelNotesEdit(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        task.isEditingNotes = false; // Just exit edit mode, don't save
        renderApp();
    }
}


function handleDeleteTask(taskId) {
  tasks = tasks.filter(task => task.id !== taskId);
  saveTasks();
  renderApp();
}

function handleToggleTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if(task) {
        task.completed = !task.completed;
        if (task.completed) {
            task.subtasks.forEach(subtask => subtask.completed = true);
        }
        saveTasks();
        renderApp();
    }
}

function handleToggleSubtask(taskId, subtaskId) {
    const task = tasks.find(t => t.id === taskId);
    const subtask = task?.subtasks.find(st => st.id === subtaskId);
    if(subtask) {
        subtask.completed = !subtask.completed;
        if (task.subtasks.length > 0 && task.subtasks.every(st => st.completed)) {
            task.completed = true;
        } else {
            task.completed = false;
        }
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

function handleEditTask(editBtn, taskId) {
  const taskHeader = editBtn.closest('.task-header');
  const headerMain = taskHeader.querySelector('.task-header-main');
  const isEditing = editBtn.getAttribute('aria-label') === 'Save task';

  if (isEditing) {
    const editInput = headerMain.querySelector('.edit-input');
    const newText = editInput.value.trim();
    const task = tasks.find(t => t.id === taskId);
    if (task && newText) {
      task.text = newText;
    }
    saveTasks();
    renderApp();
  } else {
    editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`;
    editBtn.setAttribute('aria-label', 'Save task');
    const h2 = headerMain.querySelector('h2');
    const currentText = h2.textContent || '';
    
    const editInput = document.createElement('input');
    editInput.type = 'text';
    editInput.value = currentText;
    editInput.className = 'edit-input main-task-edit';
    
    headerMain.replaceChild(editInput, h2);
    
    editInput.focus();
    editInput.select();

    const saveOnKey = (e) => {
        if (e.key === 'Enter' || e.key === 'Escape') {
            e.preventDefault();
            editBtn.click();
        }
    };
    editInput.addEventListener('keydown', saveOnKey);
    editInput.addEventListener('blur', () => editBtn.click());
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

    const saveOnKey = (e) => {
        if (e.key === 'Enter' || e.key === 'Escape') {
            e.preventDefault();
            editBtn.click();
        }
    };
    editInput.addEventListener('keydown', saveOnKey);
    editInput.addEventListener('blur', () => editBtn.click());
  }
}

function autoResizeTextarea(event) {
    const textarea = event.target;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}

function updateActiveTab() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === currentView);
    });
}

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
  if (taskForm) taskForm.addEventListener('submit', handleFormSubmit);
  
  if (tabsContainer) {
      tabsContainer.addEventListener('click', (e) => {
          if (e.target.matches('.tab-btn')) {
              currentView = e.target.dataset.view;
              renderApp();
          }
      });
  }

  loadState();
  renderApp();
});