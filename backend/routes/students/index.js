const express = require('express');
const router = express.Router();

// Registration order matters: fixed paths must be registered before /:id wildcards
// Original students.js route order preserved via delegation pattern

require('./enrollment')(router);   // GET /rest-ended, POST /grade-upgrade, POST /auto-promote (fixed paths first)
require('./classDays')(router);    // GET /class-days, PUT /class-days/bulk (fixed paths)
require('./crud')(router);         // GET /, GET /:id, POST /, PUT /:id, DELETE /:id, GET /search
require('./rest')(router);         // POST /:id/process-rest, POST /:id/resume
require('./credits')(router);      // GET /:id/rest-credits, POST /:id/manual-credit, GET /:id/credits, ...
require('./attendance')(router);   // GET /:id/attendance

module.exports = router;
