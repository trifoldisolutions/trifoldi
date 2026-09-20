const express = require('express');

const router = express.Router();

const facade = {
  name: 'App',
  home: '/app',
  nav: [
    { href: '/app', label: 'Dashboard' },
    { href: '/app/items', label: 'Items' },
    { href: '/app/auth', label: 'Log in / Sign up' },
  ],
};

// Placeholder shells: "items" stands in for the core entities until real requirements exist.
router.get('/', (req, res) => res.render('app/index', { facade, title: 'Dashboard' }));
router.get('/auth', (req, res) => res.render('app/auth', { facade, title: 'Log in / Sign up' }));
router.get('/items', (req, res) => res.render('app/items', { facade, title: 'Items' }));
router.get('/items/:id', (req, res) =>
  res.render('app/item', { facade, title: 'Item', id: req.params.id })
);

router.routes = [
  { method: 'GET', path: '/', label: 'App index' },
  { method: 'GET', path: '/auth', label: 'Combined login / sign-up (placeholder)' },
  { method: 'GET', path: '/items', label: 'Items list (placeholder)' },
  { method: 'GET', path: '/items/:id', label: 'Item detail (placeholder)' },
];

module.exports = router;
