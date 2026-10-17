// Supertest repeatedly opens ephemeral listeners. Do not reuse a pooled socket
// after its listener has closed and the OS has reassigned the same port.
require('node:http').globalAgent.keepAlive = false;
require('node:https').globalAgent.keepAlive = false;
