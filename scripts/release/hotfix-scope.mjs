const MAX_CHANGED_FILE_LINES = 500;

const ALLOWED_EXACT_PATHS = new Set([
  'API-SPEC.md',
  'DEPLOYMENT.md',
  'README.md',
]);

const ALLOWED_PATH_PREFIXES = [
  'backend/__tests__/',
  'backend/routes/',
  'backend/services/',
  'backend/utils/',
  'docs/',
  'scripts/release/',
  'scripts/smoke/',
  'src/',
];

const SENSITIVE_EXACT_PATHS = new Set([
  'Caddyfile',
  'backend/paca.js',
  'backend/package-lock.json',
  'backend/package.json',
  'backend/routes/notifications/send/_utils.js',
  'backend/utils/env-validator.js',
  'docker-compose.yml',
  'next.config.js',
  'package-lock.json',
  'package.json',
  'src/lib/api/base-url.ts',
  'vercel.json',
]);

const SENSITIVE_PATH_PREFIXES = [
  '.env',
  '.github/',
  'backend/config/',
  'backend/middleware/',
  'backend/migrations/',
  'backend/routes/auth',
  'backend/scheduler/',
  'infra/',
  'migrations/',
];

const RUNTIME_PATH_PREFIXES = [
  'backend/routes/',
  'backend/services/',
  'backend/utils/',
  'src/',
];

const CHECK_WEIGHTS = {
  changed_files: 10,
  runtime_change: 20,
  sensitive_paths: 30,
  allowed_paths: 20,
  file_size_limit: 20,
};

function normalizePath(file) {
  return String(file).trim().replaceAll('\\', '/').replace(/^\.\//, '');
}

function uniquePaths(files) {
  const seen = new Set();
  const paths = [];
  for (const file of files) {
    const normalized = normalizePath(file);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      paths.push(normalized);
    }
  }
  return paths;
}

function hasPrefix(file, prefixes) {
  return prefixes.some((prefix) => file.startsWith(prefix));
}

function isSensitivePath(file) {
  return SENSITIVE_EXACT_PATHS.has(file)
    || hasPrefix(file, SENSITIVE_PATH_PREFIXES);
}

function isAllowedPath(file) {
  return ALLOWED_EXACT_PATHS.has(file)
    || hasPrefix(file, ALLOWED_PATH_PREFIXES);
}

function isRuntimePath(file) {
  return hasPrefix(file, RUNTIME_PATH_PREFIXES);
}

function buildCheck(name, passed) {
  const maxPoints = CHECK_WEIGHTS[name];
  return {
    name,
    passed,
    points: passed ? maxPoints : 0,
    maxPoints,
  };
}

export function evaluateHotfixScope(files, lineCounts = {}) {
  const changedFiles = uniquePaths(files);
  const sensitiveFiles = changedFiles.filter(isSensitivePath);
  const disallowedFiles = changedFiles.filter((file) => !isAllowedPath(file));
  const oversizedFiles = changedFiles.filter(
    (file) => Number(lineCounts[file] ?? 0) > MAX_CHANGED_FILE_LINES,
  );
  const hasRuntimeChange = changedFiles.some(isRuntimePath);
  const checks = [
    buildCheck('changed_files', changedFiles.length > 0),
    buildCheck('runtime_change', hasRuntimeChange),
    buildCheck('sensitive_paths', sensitiveFiles.length === 0),
    buildCheck('allowed_paths', disallowedFiles.length === 0),
    buildCheck('file_size_limit', oversizedFiles.length === 0),
  ];
  const score = checks.reduce((total, check) => total + check.points, 0);
  const blockers = checks
    .filter((check) => !check.passed)
    .map((check) => check.name);

  return {
    ready: score === 100,
    score,
    targetScore: 100,
    checks,
    blockers,
    changedFiles,
    sensitiveFiles,
    disallowedFiles,
    oversizedFiles,
  };
}
