require('dotenv').config();

const path = require('path');
const express = require('express');
const mongoose = require('mongoose');

const publicRouter = require('./routes/public');
const adminRouter = require('./routes/admin');
const tasksRouter = require('./routes/tasks');

const PORT = process.env.PORT || 3001;
const DB_NAME = 'trifoldi';

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// Project cover photos (the homepage strip), served straight from their own folder in assets/ rather than copied into public/.
app.use('/project_public_covers', express.static(path.join(__dirname, 'assets', 'project_public_covers')));

// Iconify web component, served from the installed package instead of a CDN.
app.get('/vendor/iconify-icon.min.js', (req, res) =>
  res.sendFile(path.join(__dirname, 'node_modules', 'iconify-icon', 'dist', 'iconify-icon.min.js'))
);

// GSAP core and plugins (SplitText, ScrollTrigger, ...), served from the installed package.
app.use('/vendor/gsap', express.static(path.join(__dirname, 'node_modules', 'gsap', 'dist')));

const facades = [
  { name: 'Public', mount: '/', router: publicRouter },
  { name: 'Admin', mount: '/admin', router: adminRouter },
];

// Internal tooling, not one of the facades and not linked from any of them.
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
