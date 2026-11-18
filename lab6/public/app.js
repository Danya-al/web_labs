if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((error) => {
    console.error('Не удалось включить офлайн-режим:', error);
  });
}

const form = document.getElementById('task-form');
if (form) {
  initTasks(form);
}

function initTasks(form) {
  const titleInput = document.getElementById('title');
  const addButton = form.querySelector('button[type="submit"]');
  const formError = document.getElementById('form-error');
  const offlineNotice = document.getElementById('offline');
  const summary = document.getElementById('list-summary');
  const list = document.getElementById('task-list');
  const filters = document.querySelectorAll('[data-filter]');
  const snapshotKey = 'lab6-tasks-snapshot';

  let snapshot = readSnapshot();
  let onlyCompleted = false;
  let serverAvailable = true;
  let submitting = false;
  let listRequest;

  function readSnapshot() {
    try {
      const saved = JSON.parse(localStorage.getItem(snapshotKey));
      return Array.isArray(saved) ? saved : null;
    } catch {
      return null;
    }
  }

  function saveSnapshot(tasks) {
    snapshot = tasks;
    try {
      localStorage.setItem(snapshotKey, JSON.stringify(tasks));
    } catch {
      // Список остаётся доступным до закрытия страницы.
    }
  }

  function showFormError(message) {
    formError.textContent = message;
    formError.hidden = !message;
  }

  function updateAddButton() {
    addButton.disabled = submitting || !serverAvailable;
  }

  function selectFilter(completed) {
    onlyCompleted = completed;
    for (const button of filters) {
      const active = (button.dataset.filter === 'completed') === completed;
      button.setAttribute('aria-pressed', String(active));
    }
  }

  function renderTasks(tasks) {
    list.replaceChildren();

    if (tasks === null) {
      summary.textContent = 'Сохранённого списка пока нет.';
      return;
    }
    if (tasks.length === 0) {
      summary.textContent = onlyCompleted ? 'Завершённых задач пока нет.' : 'Список пока пуст.';
      return;
    }

    summary.textContent = `Показано задач: ${tasks.length}`;
    for (const task of tasks) {
      const item = document.createElement('li');
      const title = document.createElement('span');
      const status = document.createElement('span');

      title.className = 'task-title';
      title.textContent = task.title;
      status.className = 'task-status';
      status.classList.toggle('completed', task.completed);
      status.textContent = task.completed ? 'Завершена' : 'В работе';

      item.append(title, status);
      list.append(item);
    }
  }

  async function loadTasks() {
    listRequest?.abort();
    listRequest = new AbortController();
    const { signal } = listRequest;
    const url = onlyCompleted ? '/api/tasks?completed=true' : '/api/tasks';

    try {
      const response = await fetch(url, { signal, cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const tasks = await response.json();
      if (signal.aborted) return;

      if (!onlyCompleted) saveSnapshot(tasks);
      serverAvailable = true;
      offlineNotice.hidden = true;
      renderTasks(tasks);
    } catch {
      if (signal.aborted) return;

      serverAvailable = false;
      offlineNotice.textContent = snapshot
        ? 'Сервер недоступен. Показан сохранённый список. Добавление задач временно недоступно.'
        : 'Сервер недоступен. Подключитесь, чтобы загрузить список и добавить задачи.';
      offlineNotice.hidden = false;
      const tasks = onlyCompleted ? snapshot?.filter((task) => task.completed) ?? null : snapshot;
      renderTasks(tasks);
    }

    updateAddButton();
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting || !serverAvailable) return;

    showFormError('');
    const title = titleInput.value.trim();
    if (!title) {
      showFormError('Введите название задачи.');
      titleInput.focus();
      return;
    }

    submitting = true;
    updateAddButton();
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });

      if (!response.ok) {
        showFormError(response.status === 400 ? 'Введите название задачи.' : 'Не удалось добавить задачу.');
        return;
      }

      form.reset();
      selectFilter(false);
      await loadTasks();
      titleInput.focus();
    } catch {
      showFormError('Не удалось добавить задачу.');
      await loadTasks();
    } finally {
      submitting = false;
      updateAddButton();
    }
  });

  for (const button of filters) {
    button.addEventListener('click', () => {
      selectFilter(button.dataset.filter === 'completed');
      loadTasks();
    });
  }

  titleInput.addEventListener('input', () => showFormError(''));
  window.addEventListener('online', loadTasks);
  window.addEventListener('offline', loadTasks);
  loadTasks();
}
