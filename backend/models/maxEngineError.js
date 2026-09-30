class LinkError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
function fail(status, code, message) { throw new LinkError(status, code, message); }
module.exports = { LinkError, fail };
