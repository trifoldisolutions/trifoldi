const express = require('express');

const router = express.Router();

const facade = {
  name: 'Public',
  home: '/',
  nav: [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About' },
    { href: '/app', label: 'Open app' },
  ],
};

router.get('/', (req, res) => res.render('public/index', { facade, title: 'Welcome' }));
router.get('/about', (req, res) => res.render('public/about', { facade, title: 'About' }));

router.routes = [
  { method: 'GET', path: '/', label: 'Landing page' },
  { method: 'GET', path: '/about', label: 'About page' },
];

module.exports = router;
