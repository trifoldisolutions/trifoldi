require('dotenv').config();

const path = require('path');
const express = require('express');
const mongoose = require('mongoose');

const publicRouter = require('./routes/public');
const appRouter = require('./routes/app');
const adminRouter = require('./routes/admin');
const tasksRouter = require('./routes/tasks');

const PORT = process.env.PORT || 3001;
const DB_NAME = 'trifoldi';

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

const facades = [
  { name: 'Public', mount: '/', router: publicRouter },
  { name: 'App', mount: '/app', router: appRouter },
  { name: 'Admin', mount: '/admin', router: adminRouter },
];

// Internal tooling, not one of the three facades and not linked from any of them.
const internal = [
  { name: 'Dev resources', mount: '/dev-resources/tasks', router: tasksRouter },
];

const mounts = [...facades, ...internal];
mounts.forEach(({ mount, router }) => app.use(mount, router));

app.use((req, res) => res.status(404).send('Not found'));

// dbName is passed explicitly: local Mongo URIs often omit the database from the path.
if (process.env.MONGO_URI) {
  mongoose
    .connect(process.env.MONGO_URI, { dbName: DB_NAME })
    .then(() => console.log(`MongoDB connected (db: ${DB_NAME})`))
    .catch((err) => console.error(`MongoDB connection failed: ${err.message}`));
} else {
  console.warn('MONGO_URI is not set: database features (e.g. the task board) will not persist.');
}

const fullPath = (mount, routePath) =>
  mount === '/' ? routePath : mount + (routePath === '/' ? '' : routePath);

app.listen(PORT, () => {
  const base = `http://localhost:${PORT}`;
  console.log(`\nServer listening on ${base}\n`);
  for (const { name, mount, router } of mounts) {
    console.log(`${name} (${mount})`);
    for (const { method, path: routePath, label } of router.routes || []) {
      console.log(`  ${method.padEnd(4)} ${base}${fullPath(mount, routePath)} — ${label}`);
    }
  }
  console.log('');
});
