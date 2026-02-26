const express = require('express');
const router = express.Router();

require('./settings')(router);
require('./logs')(router);
require('./test')(router);
require('./send')(router);

module.exports = router;
