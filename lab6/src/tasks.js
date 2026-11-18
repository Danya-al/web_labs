import { Router } from 'express';

export const tasksRouter = Router();

const tasks = [
  { id: 1, title: 'Сделать лабораторную', completed: true },
  { id: 2, title: 'Поесть', completed: true },
  { id: 3, title: 'Лечь спать вовремя', completed: false },
];
let nextId = tasks.length + 1;

tasksRouter.get('/', (req, res) => {
  const { completed } = req.query;
  if (completed === 'true' || completed === 'false') {
    const isCompleted = completed === 'true';
    return res.json(tasks.filter((task) => task.completed === isCompleted));
  }

  res.json(tasks);
});

tasksRouter.get('/:id', (req, res) => {
  const task = tasks.find((task) => String(task.id) === req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json(task);
});

tasksRouter.post('/', (req, res) => {
  const title = req.body?.title;
  if (typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: 'title is required' });
  }

  const task = { id: nextId++, title: title.trim(), completed: false };
  tasks.push(task);
  res.status(201).json(task);
});
