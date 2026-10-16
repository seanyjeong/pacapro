const { FIELDS, ENCRYPTED_FIELDS } = require('../constants/ilsanAdmissionExisting');

// Only null and whitespace are missing. A default or conflicting value is preserved.
const blank = value => value == null || (typeof value === 'string' && !value.trim());
function plan(profile, current) {
  const incoming = { ...profile };
  const primary = `${profile.primary_parent}_phone`;
  incoming.parent_phone = blank(current[primary]) ? profile[primary] : current[primary];
  const fields = Object.entries(FIELDS).map(([field,label]) => ({ field,label,
    current:current[field] ?? '', incoming:incoming[field] ?? '',
    action:blank(current[field]) && !blank(incoming[field]) ? 'fill' : 'keep' }));
  return { fields, additions:Object.fromEntries(fields.filter(f=>f.action==='fill').map(f=>[f.field,f.incoming])) };
}
module.exports = { plan, ENCRYPTED_FIELDS };
