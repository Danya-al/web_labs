import { fileURLToPath } from 'node:url';
import express from 'express';
import { createContact, deleteContact, listContacts, updateContact } from './db.js';

export const app = express();
const contacts = express.Router();
const maxContactId = 2147483647;

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function positiveInteger(value, field, max = Number.MAX_SAFE_INTEGER) {
  const number = typeof value === 'string' && /^[0-9]+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(number) || number < 1 || number > max) {
    throw httpError(400, `Параметр ${field} должен быть положительным целым числом.`);
  }
  return number;
}

function contactFromBody(body) {
  const contact = {};
  for (const field of ['name', 'phone', 'email']) {
    const value = body?.[field];
    if (typeof value !== 'string' || !value.trim() || value.includes('\0')) {
      throw httpError(400, `Поле ${field} должно быть непустой строкой.`);
    }
    contact[field] = value.trim();
  }
  return contact;
}

contacts.get('/', async (req, res) => {
  const { q = '', page: pageParam = '1', limit: limitParam = '10' } = req.query;
  if (typeof q !== 'string' || q.includes('\0')) {
    throw httpError(400, 'Параметр q должен быть строкой.');
  }

  const page = positiveInteger(pageParam, 'page');
  const limit = positiveInteger(limitParam, 'limit');
  const offset = (page - 1) * limit;
  if (!Number.isSafeInteger(offset)) {
    throw httpError(400, 'Слишком большое смещение страницы.');
  }

  const result = await listContacts(q.trim(), limit, offset);
  res.json({ ...result, page, limit });
});

contacts.post('/', async (req, res) => {
  const contact = await createContact(contactFromBody(req.body));
  res.status(201).json(contact);
});

contacts.put('/:id', async (req, res) => {
  const id = positiveInteger(req.params.id, 'id', maxContactId);
  const contact = await updateContact(id, contactFromBody(req.body));
  if (!contact) {
    throw httpError(404, 'Контакт не найден.');
  }
  res.json(contact);
});

contacts.delete('/:id', async (req, res) => {
  const id = positiveInteger(req.params.id, 'id', maxContactId);
  if (!(await deleteContact(id))) {
    throw httpError(404, 'Контакт не найден.');
  }
  res.status(204).end();
});

app.use(express.json());
app.use('/api/contacts', contacts);
app.use(express.static(fileURLToPath(new URL('../public/', import.meta.url))));
app.use((_req, res) => res.status(404).json({ error: 'Маршрут не найден.' }));

app.use((err, _req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Некорректный JSON.' });
  }
  if (err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }

  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера.' });
});
