const axios = require('axios');
const jwt = require('jsonwebtoken');
const {
  getJungsiApiBase,
  getJungsiJwtSecret,
} = require('./_config');

function requireJungsiSecret() {
  const secret = getJungsiJwtSecret();
  if (!secret) {
    const error = new Error('JUNGSI_JWT_SECRET_MISSING');
    error.code = 'JUNGSI_JWT_SECRET_MISSING';
    throw error;
  }
  return secret;
}

function createServiceToken(branchName) {
  return jwt.sign(
    {
      userid: 'paca_service',
      branch: branchName,
      role: 'admin',
      service: 'paca',
    },
    requireJungsiSecret(),
    { expiresIn: '1h' }
  );
}

function verifyJungsiLoginToken(token) {
  return jwt.verify(token, requireJungsiSecret());
}

async function fetchJungsiStudents(branchName, year, exam) {
  const token = createServiceToken(branchName);
  const response = await axios.get(`${getJungsiApiBase()}/jungsi/students/list-by-branch`, {
    params: { year, exam },
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Internal-Service': 'paca',
    },
    timeout: 10000,
  });
  return response.data?.success ? response.data.students || [] : [];
}

async function checkJungsiHealth() {
  try {
    const response = await axios.get(`${getJungsiApiBase()}/jungsi/public/schools/2027`, {
      timeout: 5000,
    });
    return { healthy: response.status === 200, error: null };
  } catch (error) {
    return { healthy: false, error: error.message };
  }
}

module.exports = {
  checkJungsiHealth,
  createServiceToken,
  fetchJungsiStudents,
  verifyJungsiLoginToken,
};
