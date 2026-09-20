const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const Task = require('../models/Task');

const router = express.Router();

const BASE = '/dev-resources/tasks';
// The view lives in dev_resources/ (outside views/), so it is rendered by absolute path.
const VIEW = path.join(__dirname, '..', 'dev_resources', 'tasks');

const facade = {
  name: 'Dev resources',
  home: BASE,
  nav: [{ href: BASE, label: 'Tasks' }],
};

const isConnected = () => mongoose.connection.readyState === 1;

// Form fields are coerced rather than trusted, so bad input can't reach Mongoose casting/enum errors.
function parseForm(body) {
  return {
    title: String(body.title ?? '').trim(),
    description: String(body.description ?? '').trim(),
    status: Task.STATUSES.includes(body.status) ? body.status : 'todo',
  };
}

// Without a DB connection Mongoose buffers for 10s before failing; skip writes and let GET show the banner.
router.use((req, res, next) => {
  if (req.method !== 'GET' && !isConnected()) return res.redirect(BASE);
  next();
});

router.param('id', (req, res, next, id) => {
  if (!mongoose.isValidObjectId(id)) return res.status(404).send('Not found');
  next();
});

router.get('/', async (req, res) => {
  const connected = isConnected();
  const tasks = connected ? await Task.find().sort({ createdAt: -1 }).lean() : [];
  res.render(VIEW, { facade, title: 'Task board', tasks, statuses: Task.STATUSES, connected, base: BASE });
});

router.post('/', async (req, res) => {
  const data = parseForm(req.body);
  if (data.title) await Task.create(data);
  res.redirect(BASE);
});

router.post('/:id/update', async (req, res) => {
  const data = parseForm(req.body);
  if (data.title) await Task.findByIdAndUpdate(req.params.id, data);
  res.redirect(BASE);
});

router.post('/:id/delete', async (req, res) => {
  await Task.findByIdAndDelete(req.params.id);
  res.redirect(BASE);
});

router.routes = [
  { method: 'GET', path: '/', label: 'Task board' },
  { method: 'POST', path: '/', label: 'Create task' },
  { method: 'POST', path: '/:id/update', label: 'Update task' },
  { method: 'POST', path: '/:id/delete', label: 'Delete task' },
];

module.exports = router;
