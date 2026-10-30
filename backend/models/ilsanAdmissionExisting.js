const { FIELDS, ENCRYPTED_FIELDS } = require('../constants/ilsanAdmissionExisting');

// Only null and whitespace are missing. A blank applicant value never clears saved data.
const blank = value => value == null || (typeof value === 'string' && !value.trim());
// Phones differ only by digits, so 01012345678 and 010-1234-5678 are the same number.
const same = (field, a, b) => field.endsWith('phone')
  ? String(a).replace(/\D/g,'') === String(b).replace(/\D/g,'') : String(a).trim() === String(b).trim();
function plan(profile, current) {
  // The application is the latest information, so the notice number follows its chosen parent.
  const incoming = { ...profile, parent_phone: profile[`${profile.primary_parent}_phone`] };
  const fields = Object.entries(FIELDS).map(([field,label]) => ({ field,label,
    current:current[field] ?? '', incoming:incoming[field] ?? '',
    action:blank(incoming[field]) ? 'keep' : blank(current[field]) ? 'fill' : same(field,current[field],incoming[field]) ? 'keep' : 'replace' }));
  const pick = action => Object.fromEntries(fields.filter(f=>f.action===action).map(f=>[f.field,f.incoming]));
  return { fields, additions:pick('fill'), replacements:pick('replace') };
}
module.exports = { plan, ENCRYPTED_FIELDS };
