import { fileURLToPath } from 'node:url';
import express from 'express';
import { alphabet, cleanField, fields, validateField } from '../public/contact.js';
import { createContact, deleteContact, getContact, listContacts, updateContact } from './db.js';

export const app = express();
const contacts = express.Router();
const maxContactId = 2147483647;

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function positiveInteger(value, field, max = Number.MAX_SAFE_INTEGER) {
  const number = typeof value === 'string' && /^[0-9]+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(number) || number < 1 || number > max) {
    throw httpError(400, `Параметр ${field} должен быть целым числом от 1 до ${max}.`);
  }
  return number;
}

function contactFromBody(body) {
  const contact = {};
  for (const field of Object.keys(fields)) {
    const value = field === 'notes' && body?.notes === undefined ? '' : body?.[field];
    const error = validateField(field, value);
    if (error) throw httpError(400, error);
    contact[field] = cleanField(field, value);
  }
  return contact;
}

contacts.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
contacts.use(express.json({ limit: '32kb' }));

contacts.get('/', async (req, res) => {
  const { q = '', letter = '', page: pageParam = '1', limit: limitParam = '10' } = req.query;
  if (typeof q !== 'string' || q.length > 254 || q.includes('\0')) {
    throw httpError(400, 'Запрос поиска должен содержать до 254 символов.');
  }
  const knownLetter = typeof letter === 'string' && letter.length === 1
    && (alphabet.includes(letter) || alphabet.toLowerCase().includes(letter));
  if (letter !== '' && !knownLetter) {
    throw httpError(400, 'Укажите одну букву русского или английского алфавита либо #.');
  }

  const page = positiveInteger(pageParam, 'page', maxContactId);
  const limit = positiveInteger(limitParam, 'limit', 50);
  const result = await listContacts({
    q: q.trim().normalize('NFC'),
    letter: letter.toUpperCase() || null,
    limit,
    offset: (page - 1) * limit,
  });
  res.json({ ...result, page, limit });
});

contacts.get('/:id', async (req, res) => {
  const id = positiveInteger(req.params.id, 'id', maxContactId);
  const contact = await getContact(id);
  if (!contact) throw httpError(404, 'Контакт не найден.');
  res.json(contact);
});

contacts.post('/', async (req, res) => {
  const contact = await createContact(contactFromBody(req.body));
  res.location(`/api/contacts/${contact.id}`).status(201).json(contact);
});

contacts.put('/:id', async (req, res) => {
  const id = positiveInteger(req.params.id, 'id', maxContactId);
  const contact = await updateContact(id, contactFromBody(req.body));
  if (!contact) throw httpError(404, 'Контакт не найден.');
  res.json(contact);
});

contacts.delete('/:id', async (req, res) => {
  const id = positiveInteger(req.params.id, 'id', maxContactId);
  if (!(await deleteContact(id))) throw httpError(404, 'Контакт не найден.');
  res.status(204).end();
});

app.disable('x-powered-by');
app.use('/api/contacts', contacts);
app.use(express.static(fileURLToPath(new URL('../public/', import.meta.url))));
app.use((_req, res) => res.status(404).json({ error: 'Маршрут не найден.' }));

app.use((err, _req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Некорректный JSON.' });
  if (err.status >= 400 && err.status < 500) return res.status(err.status).json({ error: err.message });

  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера.' });
});
