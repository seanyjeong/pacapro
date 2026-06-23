const express = require('express');
const router = express.Router();

require('./academyLink')(router);
require('./status')(router);
require('./scores')(router);
require('./matchPreview')(router);
require('./studentLink')(router);

module.exports = router;
