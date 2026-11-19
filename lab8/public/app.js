import { cyrillic, fields, firstLetter, latin, phoneDigits, validateField } from './contact.js';

const byId = (id) => document.getElementById(id);
const form = byId('contact-form');
const fieldset = byId('contact-fields');
const editor = byId('editor');
const deleteDialog = byId('delete-dialog');
const confirmDelete = byId('confirm-delete');
const cancelDelete = byId('cancel-delete');
const search = byId('search');
const limit = byId('limit');
const index = byId('alphabet');
const list = byId('contact-list');
const template = byId('contact-template');
const previous = byId('previous');
const next = byId('next');
const theme = byId('theme');

let page = 1;
let letter = '';
let editingId = null;
let deletingId = null;
let activeListRequest;
let searchTimer;

function message(id, text = '') {
  const element = byId(id);
  element.textContent = text;
  element.hidden = !text;
}

async function api(path = '', options) {
  let response;
  try {
    response = await fetch(`/api/contacts${path}`, options);
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Не удалось подключиться к серверу. Проверьте подключение и попробуйте снова.');
  }

  if (response.status === 204) return;
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.error || 'Сервер вернул ошибку.');
  return data;
}

function buildAlphabet(container, letters) {
  for (const character of letters) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button letter';
    button.textContent = character;
    button.dataset.letter = character;
    button.setAttribute('aria-pressed', 'false');
    container.append(button);
  }
}

buildAlphabet(byId('cyrillic'), cyrillic);
buildAlphabet(byId('latin'), latin);
const letterButtons = [...index.querySelectorAll('[data-letter]')];

function selectLetter(value) {
  letter = value;
  for (const button of letterButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.letter === letter));
  }
}

function updateAvailableLetters(letters) {
  const available = new Set(letters);
  for (const button of letterButtons) {
    const value = button.dataset.letter;
    button.disabled = Boolean(value && value !== letter && !available.has(value));
  }
}

function openEditor(contact) {
  editingId = contact?.id ?? null;
  form.reset();
  for (const field of Object.keys(fields)) {
    const input = form.elements.namedItem(field);
    input.setCustomValidity('');
    input.value = contact?.[field] ?? '';
  }
  byId('editor-heading').textContent = contact ? 'Изменить контакт' : 'Новый контакт';
  byId('save').textContent = contact ? 'Сохранить' : 'Добавить';
  message('editor-error');
  message('activity');
  editor.showModal();
}

function openDelete(contact) {
  deletingId = contact.id;
  byId('delete-message').textContent = `«${contact.full_name}» будет удалён из адресной книги.`;
  message('delete-error');
  message('activity');
  deleteDialog.showModal();
}

function contactCard(contact) {
  const card = template.content.firstElementChild.cloneNode(true);
  card.dataset.contactId = contact.id;
  card.querySelector('h4').textContent = contact.full_name;

  const phone = card.querySelector('.contact-phone');
  phone.textContent = contact.phone;
  phone.href = `tel:${contact.phone.startsWith('+') ? '+' : ''}${phoneDigits(contact.phone)}`;

  const email = card.querySelector('.contact-email');
  email.textContent = contact.email;
  email.href = `mailto:${contact.email.split('@').map(encodeURIComponent).join('@')}`;

  const notes = card.querySelector('details');
  notes.hidden = !contact.notes;
  notes.querySelector('p').textContent = contact.notes;

  const [edit, remove] = card.querySelectorAll('button');
  edit.setAttribute('aria-label', `Изменить контакт ${contact.full_name}`);
  remove.setAttribute('aria-label', `Удалить контакт ${contact.full_name}`);
  edit.addEventListener('click', () => openEditor(contact));
  remove.addEventListener('click', () => openDelete(contact));
  return card;
}

function renderContacts(contacts) {
  const focused = document.activeElement;
  const focusedCard = focused?.closest('[data-contact-id]');
  const groups = new Map();
  for (const contact of contacts) {
    const initial = firstLetter(contact.full_name);
    if (!groups.has(initial)) groups.set(initial, []);
    groups.get(initial).push(contact);
  }

  const fragment = document.createDocumentFragment();
  for (const [initial, group] of groups) {
    const section = document.createElement('section');
    section.className = 'contact-group';
    const heading = document.createElement('h3');
    heading.className = 'group-heading';
    heading.id = `group-${initial.codePointAt(0)}`;
    heading.textContent = initial;
    section.setAttribute('aria-labelledby', heading.id);

    const grid = document.createElement('div');
    grid.className = 'card-grid';
    grid.append(...group.map(contactCard));
    section.append(heading, grid);
    fragment.append(section);
  }

  list.replaceChildren(fragment);
  if (focusedCard) {
    const sameCard = list.querySelector(`[data-contact-id="${focusedCard.dataset.contactId}"]`);
    const sameAction = focused.dataset.action && sameCard?.querySelector(`[data-action="${focused.dataset.action}"]`);
    (sameAction || byId('contacts-heading')).focus({ preventScroll: true });
  }
}

async function loadContacts(requestedPage = page) {
  clearTimeout(searchTimer);
  activeListRequest?.abort();
  const controller = new AbortController();
  activeListRequest = controller;
  const q = search.value.trim();
  const params = new URLSearchParams({ q, letter, page: requestedPage, limit: limit.value });
  list.setAttribute('aria-busy', 'true');
  previous.disabled = true;
  next.disabled = true;
  message('summary', 'Загружаем контакты…');

  try {
    const data = await api(`?${params}`, { signal: controller.signal });
    if (controller.signal.aborted) return;
    const lastPage = Math.max(1, Math.ceil(data.total / data.limit));
    if (requestedPage > lastPage) return loadContacts(lastPage);

    page = data.page;
    renderContacts(data.contacts);
    updateAvailableLetters(data.letters);
    if (document.activeElement === byId('retry')) byId('contacts-heading').focus();
    byId('list-error').hidden = true;

    const filtered = Boolean(q || letter);
    message('summary', `${filtered ? 'Найдено' : 'Всего'} контактов — ${data.total}`);
    byId('empty').hidden = data.total > 0;
    byId('empty-title').textContent = filtered ? 'Контакты не найдены' : 'Пока нет контактов';
    byId('empty-hint').hidden = filtered;
    byId('clear-filters').hidden = !filtered;

    byId('pagination').hidden = lastPage < 2;
    byId('page-number').textContent = `Страница ${page} из ${lastPage}`;
    previous.disabled = page === 1;
    next.disabled = page === lastPage;
  } catch (error) {
    if (controller.signal.aborted) return;
    page = requestedPage;
    renderContacts([]);
    message('summary');
    byId('empty').hidden = true;
    byId('pagination').hidden = true;
    message('list-error-message', error.message);
    byId('list-error').hidden = false;
  } finally {
    if (activeListRequest === controller && !controller.signal.aborted) {
      list.setAttribute('aria-busy', 'false');
    }
  }
}

form.addEventListener('input', (event) => {
  event.target.setCustomValidity('');
  message('editor-error');
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const contact = Object.fromEntries(new FormData(form));
  for (const [field, value] of Object.entries(contact)) {
    const error = validateField(field, value);
    if (error) {
      const input = form.elements.namedItem(field);
      input.setCustomValidity(error);
      input.reportValidity();
      message('editor-error', error);
      return;
    }
  }

  const id = editingId;
  fieldset.disabled = true;
  message('editor-error');
  try {
    await api(id === null ? '' : `/${id}`, {
      method: id === null ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contact),
    });
    editor.close();
    message('activity', id === null ? 'Контакт добавлен.' : 'Контакт обновлён.');
    void loadContacts();
  } catch (error) {
    message('editor-error', error.message);
  } finally {
    fieldset.disabled = false;
    if (editor.open) byId('save').focus();
  }
});

byId('add-contact').addEventListener('click', () => openEditor());
byId('cancel-edit').addEventListener('click', () => editor.close());
editor.addEventListener('cancel', (event) => {
  if (fieldset.disabled) event.preventDefault();
});

byId('delete-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  confirmDelete.disabled = true;
  cancelDelete.disabled = true;
  message('delete-error');
  try {
    await api(`/${deletingId}`, { method: 'DELETE' });
    deleteDialog.close();
    message('activity', 'Контакт удалён.');
    void loadContacts();
  } catch (error) {
    message('delete-error', error.message);
  } finally {
    confirmDelete.disabled = false;
    cancelDelete.disabled = false;
    if (deleteDialog.open) confirmDelete.focus();
  }
});

cancelDelete.addEventListener('click', () => deleteDialog.close());
deleteDialog.addEventListener('cancel', (event) => {
  if (confirmDelete.disabled) event.preventDefault();
});

index.addEventListener('click', (event) => {
  const button = event.target.closest('[data-letter]');
  if (!button || button.dataset.letter === letter) return;
  selectLetter(button.dataset.letter);
  void loadContacts(1);
});

search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  activeListRequest?.abort();
  searchTimer = setTimeout(() => loadContacts(1), 200);
});

byId('clear-filters').addEventListener('click', () => {
  search.value = '';
  search.focus();
  selectLetter('');
  void loadContacts(1);
});

limit.addEventListener('change', () => loadContacts(1));
previous.addEventListener('click', () => loadContacts(page - 1));
next.addEventListener('click', () => loadContacts(page + 1));
byId('retry').addEventListener('click', () => loadContacts());
window.addEventListener('online', () => loadContacts());

function applyTheme(dark) {
  document.documentElement.classList.toggle('dark', dark);
  theme.setAttribute('aria-pressed', String(dark));
  document.querySelector('meta[name="theme-color"]').content = dark ? '#241d18' : '#f5efe1';
}

const themeKey = 'lab8-theme';
try {
  applyTheme(localStorage.getItem(themeKey) === 'dark');
} catch {
  applyTheme(false);
}

theme.addEventListener('click', () => {
  const dark = !document.documentElement.classList.contains('dark');
  applyTheme(dark);
  try {
    localStorage.setItem(themeKey, dark ? 'dark' : 'light');
  } catch {
    // Тема остаётся доступной в текущей вкладке.
  }
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((error) => console.warn('Service Worker:', error.message));
}

void loadContacts();
