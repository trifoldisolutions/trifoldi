const path = require('path');
const express = require('express');

const router = express.Router();

const facade = {
  name: 'Public',
  home: '/',
  nav: [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About' },
  ],
};

const brand = {
  name: 'Trifoldi Solutions',
  tagline: 'Where ideas meet expectations',
};

// The landing page's photo strip, in order. Each cover is a file in public/img/project_public_covers, served from
// /project_public_covers (server.js); name and category are its caption and what the info under the strip shows.
const projects = [
  { cover: 'ppc001.jpg', name: 'youquoteit', category: 'Backend Dev' },
  { cover: 'ppc002.jpg', name: 'My Shuttler', category: 'Brand Strategy, UI/UX Concept' },
  { cover: 'ppc003.jpg', name: 'Jarumiri Studios', category: 'Full Stack Dev' },
  { cover: 'ppc004.jpg', name: 'blurraface.com', category: 'AI Integration, UI/UX Design' },
];

router.get('/', (req, res) =>
  res.render('public/index', {
    facade,
    title: 'Welcome',
    documentTitle: `${brand.name} - ${brand.tagline}`,
    brand,
    projects,
  })
);
router.get('/about', (req, res) => res.render('public/about', { facade, title: 'About' }));

// Iconify web component, served from the installed package instead of a CDN.
router.get('/vendor/iconify-icon.min.js', (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'node_modules', 'iconify-icon', 'dist', 'iconify-icon.min.js'))
);

router.routes = [
  { method: 'GET', path: '/', label: 'Landing page' },
  { method: 'GET', path: '/about', label: 'About page' },
  { method: 'GET', path: '/vendor/iconify-icon.min.js', label: 'Iconify web component' },
];

module.exports = router;
