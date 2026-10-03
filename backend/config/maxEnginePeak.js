function pacaSchema() {
  const name = process.env.DB_NAME || 'paca';
  if (!/^[a-zA-Z0-9_]+$/.test(name)) throw new Error('Invalid PACA database identifier');
  return '`' + name + '`';
}
module.exports = { pacaSchema };
