const byId = (id) => document.getElementById(id);
const form = byId('contact-form');
const fields = byId('contact-fields');
const nameField = byId('name');
const search = byId('search');
const limit = byId('limit');
const list = byId('contact-list');
const dialog = byId('delete-dialog');
const confirmDelete = byId('confirm-delete');
const previous = byId('previous');
const next = byId('next');

let page = 1;
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
    throw new Error('Не удалось подключиться к серверу.');
  }
  if (response.status === 204) return;
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.error || 'Сервер вернул ошибку.');
  return data;
}

function editContact(contact) {
  if (fields.disabled) return;
  editingId = contact.id;
  for (const field of ['name', 'phone', 'email']) {
    form.elements.namedItem(field).value = contact[field];
  }
  byId('form-heading').textContent = 'Изменить контакт';
  byId('save').textContent = 'Сохранить';
  byId('cancel-edit').hidden = false;
  message('form-error');
  message('activity');
  nameField.focus();
}

function resetForm() {
  editingId = null;
  form.reset();
  byId('form-heading').textContent = 'Новый контакт';
  byId('save').textContent = 'Добавить';
  byId('cancel-edit').hidden = true;
  message('form-error');
}

function openDelete(contact) {
  if (fields.disabled) return;
  deletingId = contact.id;
  byId('delete-message').textContent = `«${contact.name}» будет удалён из адресной книги.`;
  message('delete-error');
  dialog.showModal();
}

function contactRow(contact) {
  const row = document.createElement('li');
  row.className = 'contact-row';
  row.innerHTML = `<div class="contact-details">
    <p class="contact-name"></p><p class="contact-meta"><span></span><span></span></p>
  </div><div class="contact-actions">
    <button class="secondary" type="button">Изменить</button>
    <button class="danger" type="button">Удалить</button>
  </div>`;
  row.querySelector('.contact-name').textContent = contact.name;
  const [phone, email] = row.querySelectorAll('.contact-meta span');
  phone.textContent = contact.phone;
  email.textContent = contact.email;
  const [edit, remove] = row.querySelectorAll('button');
  edit.setAttribute('aria-label', `Изменить контакт ${contact.name}`);
  remove.setAttribute('aria-label', `Удалить контакт ${contact.name}`);
  edit.addEventListener('click', () => editContact(contact));
  remove.addEventListener('click', () => openDelete(contact));
  return row;
}

async function loadContacts(requestedPage = page) {
  clearTimeout(searchTimer);
  activeListRequest?.abort();
  const controller = new AbortController();
  activeListRequest = controller;
  const q = search.value.trim();
  const params = new URLSearchParams({ q, page: requestedPage, limit: limit.value });
  list.replaceChildren();
  byId('empty').hidden = true;
  byId('pagination').hidden = true;
  byId('list-error').hidden = true;
  message('summary', 'Загружаем контакты…');

  try {
    const data = await api(`?${params}`, { signal: controller.signal });
    if (controller.signal.aborted) return;
    const lastPage = Math.max(1, Math.ceil(data.total / data.limit));
    if (requestedPage > lastPage) return loadContacts(lastPage);

    page = data.page;
    list.replaceChildren(...data.contacts.map(contactRow));
    message('summary', q ? `Найдено контактов: ${data.total}` : `Всего контактов: ${data.total}`);
    byId('empty').hidden = data.contacts.length > 0;
    byId('empty-title').textContent = q ? 'Контакты не найдены' : 'Пока нет контактов';
    byId('empty-hint').textContent = q ? 'Попробуйте другой запрос.' : 'Добавьте первый контакт через форму выше.';
    byId('pagination').hidden = lastPage < 2;
    byId('page-number').textContent = `Страница ${page} из ${lastPage}`;
    previous.disabled = page === 1;
    next.disabled = page === lastPage;
  } catch (error) {
    if (controller.signal.aborted) return;
    page = requestedPage;
    message('summary');
    message('list-error-message', error.message);
    byId('list-error').hidden = false;
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = editingId;
  const contact = Object.fromEntries(new FormData(form));
  fields.disabled = true;
  message('form-error');
  message('activity');
  try {
    await api(id === null ? '' : `/${id}`, {
      method: id === null ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contact),
    });
    resetForm();
    message('activity', id === null ? 'Контакт добавлен.' : 'Контакт обновлён.');
    void loadContacts();
  } catch (error) {
    message('form-error', error.message);
  } finally {
    fields.disabled = false;
    nameField.focus();
  }
});

byId('cancel-edit').addEventListener('click', () => {
  resetForm();
  nameField.focus();
});

byId('delete-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = deletingId;
  confirmDelete.disabled = true;
  byId('cancel-delete').disabled = true;
  message('delete-error');
  try {
    await api(`/${id}`, { method: 'DELETE' });
    if (editingId === id) resetForm();
    dialog.close();
    message('activity', 'Контакт удалён.');
    search.focus();
    void loadContacts();
  } catch (error) {
    message('delete-error', error.message);
  } finally {
    confirmDelete.disabled = false;
    byId('cancel-delete').disabled = false;
  }
});

byId('cancel-delete').addEventListener('click', () => dialog.close());
dialog.addEventListener('cancel', (event) => {
  if (confirmDelete.disabled) event.preventDefault();
});

search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  activeListRequest?.abort();
  page = 1;
  searchTimer = setTimeout(() => loadContacts(), 180);
});
limit.addEventListener('change', () => loadContacts(1));
previous.addEventListener('click', () => loadContacts(page - 1));
next.addEventListener('click', () => loadContacts(page + 1));
byId('retry').addEventListener('click', () => loadContacts());

void loadContacts();
