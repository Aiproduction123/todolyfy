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
      // Initialize any missing properties on tasks loaded from localStorage
      tasks.forEach(task => {
          task.isGenerating = false;
          if (task.isOpen === undefined) task.isOpen = true;
          if (task.notes === undefined) task.notes = '';
          if (task.completed === undefined) task.completed = false;
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
    // Ensure editing mode is not saved
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

  // Persist focus and scroll position across re-renders
  const activeElementId = document.activeElement?.id;
  const scrollPosition = window.scrollY;

  taskListEl.innerHTML = '';
  tasksToRender.forEach(task => {
    const taskElement = createTaskElement(task);
    taskListEl.appendChild(taskElement);
  });

  // Restore focus if the active element was a textarea
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

  // --- Event Listeners for the task item ---
  taskItem.querySelector('.task-header').addEventListener('click', (e) => {
    if (e.target.closest('button') || e.target.matches('.task-checkbox')) return;
    handleToggleAccordion(task.id);
  });

  const taskActions = taskItem.querySelector('.task-header .task-actions');
  taskActions.querySelector('.delete-btn').addEventListener('click', () => handleDeleteTask(task.id));
  taskActions.querySelector('.edit-btn').addEventListener('click', (e) => handleEditTask(e.currentTarget, task.id));

  taskItem.querySelector('.task-header .task-checkbox').addEventListener('change', () => handleToggleTask(task.id));

  const notesContainer = taskItem.querySelector('.task-notes');
  if(notesContainer) {
      notesContainer.querySelector('.notes-display')?.addEventListener('click', () => handleEnterNotesEditMode(task.id));
      notesContainer.querySelector('.notes-editor .save-btn')?.addEventListener('click', () => handleSaveNotes(task.id));
      notesContainer.querySelector('.notes-editor .cancel-btn')?.addEventListener('click', () => handleCancelNotesEdit(task.id));
      const textarea = notesContainer.querySelector('textarea');
      if (textarea) {
          textarea.addEventListener('input', autoResizeTextarea);
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
            <button class="edit-btn" aria-label="Edit subtask"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg></button>
            <button class="delete-btn" aria-label="Delete subtask"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button>
          </div>
        </li>
      `).join('')}
    </ul>` : '<p class="no-subtasks-message">No subtasks were generated for this task.</p>'}
    
    <div class="task-notes ${task.isEditingNotes ? 'is-editing' : ''}">
        <div class="notes-display ${hasNotes ? '' : 'is-empty'}">
            <svg class="notes-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            <div class="notes-text">
                ${hasNotes ? task.notes.replace(/\n/g, '<br>') : 'Add a description...'}
            </div>
        </div>
        <div class="notes-editor">
            <textarea id="notes-textarea-${task.id}" placeholder="Add a description..." rows="1">${task.notes || ''}</textarea>
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
                const activeTasks = Array.from(taskListEl.children).map(item => tasks.find(t => t.id === item.dataset.id)).filter(Boolean);
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
    isEditingNotes: false,
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
    // Use a more user-friendly way to show errors than alert()
    showErrorNotification(error.message);
    tasks = tasks.filter(t => t.id !== newTask.id);
  } finally {
    const taskToUpdate = tasks.find(t => t.id === newTask.id);
    if (taskToUpdate) taskToUpdate.isGenerating = false;
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
    const response = await fetch('/.netlify/functions/generate-subtasks', {
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

function handleEnterNotesEditMode(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        task.isEditingNotes = true;
        renderApp();
    }
}

function handleSaveNotes(taskId) {
    const task = tasks.find(t => t.id === taskId);
    const taskElement = document.getElementById(taskId);
    if (task && taskElement) {
        const textarea = taskElement.querySelector(`#notes-textarea-${taskId}`);
        task.notes = textarea.value;
        task.isEditingNotes = false;
        saveTasks();
        renderApp();
    }
}

function handleCancelNotesEdit(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        task.isEditingNotes = false;
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
        if (task.subtasks.every(st => st.completed)) {
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
    if (task && newText) task.text = newText;
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
    if (subtask && newText) subtask.text = newText;
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

function showErrorNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'error-notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.remove();
    }, 5000);
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

  // Google Login Button Logic
  const loginBtn = document.getElementById('google-login-btn');
  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      window.location.href = '/.netlify/functions/auth-start';
    });
  }

  // Apple Login Button Logic
  const appleBtn = document.getElementById('apple-login-btn');
  if (appleBtn) {
    appleBtn.addEventListener('click', () => {
      window.location.href = '/.netlify/functions/apple-auth';
    });
  }

  // Handle login success display
  const userInfoDiv = document.getElementById('user-info');
  const params = new URLSearchParams(window.location.search);
  
  // Securely handle user info from localStorage if available
  try {
      const user = JSON.parse(localStorage.getItem('user-info'));
      if (user && userInfoDiv) {
          userInfoDiv.innerHTML = `
              <span>Welcome, ${user.name}</span>
              <img src="${user.picture}" alt="User Avatar" style="width:32px;height:32px;border-radius:50%;margin-left:8px;">
          `;
          if (loginBtn) loginBtn.style.display = 'none';
          if (appleBtn) appleBtn.style.display = 'none';
      }
  } catch(e) {
      // Could not parse user info
  }

  // If redirected back from Google/Apple, store user info and clean URL
  if ((params.has('name') && params.has('picture')) || params.has('apple_success')) {
      const user = {
          name: params.get('name') || 'User',
          picture: params.get('picture') || '' // Add a default avatar if none
      };
      localStorage.setItem('user-info', JSON.stringify(user));
      
      // Clean the URL
      window.history.replaceState({}, document.title, "/");
      
      // Re-render the user info section
      if (userInfoDiv) {
          userInfoDiv.innerHTML = `
              <span>Welcome, ${user.name}</span>
              <img src="${user.picture}" alt="User Avatar" style="width:32px;height:32px;border-radius:50%;margin-left:8px;">
          `;
          if (loginBtn) loginBtn.style.display = 'none';
          if (appleBtn) appleBtn.style.display = 'none';
      }
  }
});
