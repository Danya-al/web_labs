import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tasksRouter } from './tasks.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

export const app = express();

app.use((req, res, next) => {
  res.on('finish', () => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl} -> ${res.statusCode}`);
  });
  next();
});

app.use(express.json());

app.get('/', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.get('/about', (req, res) => res.sendFile(path.join(publicDir, 'about.html')));

app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/tasks', tasksRouter);
app.use(express.static(publicDir));

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  if (err.status === 413) {
    return res.status(413).json({ error: 'Request body is too large' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});
