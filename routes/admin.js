const express = require('express');

const router = express.Router();

const facade = {
  name: 'Admin',
  home: '/admin',
  nav: [{ href: '/admin', label: 'Overview' }],
};

router.get('/', (req, res) => res.render('admin/index', { facade, title: 'Admin' }));

router.routes = [{ method: 'GET', path: '/', label: 'Admin index (placeholder)' }];

module.exports = router;
