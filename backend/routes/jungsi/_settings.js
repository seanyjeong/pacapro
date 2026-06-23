function parseSettings(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function getAcademySettings(db, academyId) {
  const [rows] = await db.query(
    'SELECT settings FROM academy_settings WHERE academy_id = ?',
    [academyId]
  );
  return parseSettings(rows[0]?.settings);
}

async function saveAcademySettings(db, academyId, settings) {
  const serialized = JSON.stringify(settings || {});
  const [existing] = await db.query(
    'SELECT id FROM academy_settings WHERE academy_id = ?',
    [academyId]
  );

  if (existing.length > 0) {
    await db.query(
      'UPDATE academy_settings SET settings = ? WHERE academy_id = ?',
      [serialized, academyId]
    );
    return;
  }

  await db.query(
    'INSERT INTO academy_settings (academy_id, settings) VALUES (?, ?)',
    [academyId, serialized]
  );
}

function getJungsiLinkFromSettings(settings) {
  const link = settings?.jungsiLink || {};
  return {
    branchName: link.branchName || null,
    jungsiUserId: link.jungsiUserId || null,
    linkedAt: link.linkedAt || null,
    linkedByUserId: link.linkedByUserId || null,
    pending: link.pending || null,
  };
}

async function getJungsiLink(db, academyId) {
  const settings = await getAcademySettings(db, academyId);
  return getJungsiLinkFromSettings(settings);
}

async function savePendingJungsiLink(db, academyId, pending) {
  const settings = await getAcademySettings(db, academyId);
  const current = settings.jungsiLink || {};
  settings.jungsiLink = {
    ...current,
    pending,
  };
  await saveAcademySettings(db, academyId, settings);
}

async function saveJungsiLink(db, academyId, link) {
  const settings = await getAcademySettings(db, academyId);
  const current = settings.jungsiLink || {};
  settings.jungsiLink = {
    ...current,
    branchName: link.branchName,
    jungsiUserId: link.jungsiUserId || null,
    linkedAt: link.linkedAt,
    linkedByUserId: link.linkedByUserId || current.pending?.createdByUserId || null,
  };
  delete settings.jungsiLink.pending;
  await saveAcademySettings(db, academyId, settings);
  return settings.jungsiLink;
}

async function clearJungsiLink(db, academyId) {
  const settings = await getAcademySettings(db, academyId);
  delete settings.jungsiLink;
  await saveAcademySettings(db, academyId, settings);
}

module.exports = {
  clearJungsiLink,
  getAcademySettings,
  getJungsiLink,
  getJungsiLinkFromSettings,
  saveJungsiLink,
  savePendingJungsiLink,
};
