import { isDeepStrictEqual } from 'node:util';

export const RELEASE_METADATA_FILES = [
  'package.json',
  'package-lock.json',
  'src/constants/release.json',
];

function withoutReleaseMetadata(file, value) {
  const copy = structuredClone(value);
  delete copy.version;
  if (file === 'package-lock.json') delete copy.packages[''].version;
  else delete copy.lastUpdate;
  return copy;
}

export function validateReleaseMetadata(contents) {
  try {
    const pairs = RELEASE_METADATA_FILES.map((file) => ({
      file,
      before: JSON.parse(contents[file].before),
      after: JSON.parse(contents[file].after),
    }));
    const [pkg, lock, release] = pairs;
    const previous = pkg.before.version;
    const version = pkg.after.version;
    const parts = previous.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!parts || version !== `${parts[1]}.${parts[2]}.${Number(parts[3]) + 1}`) return false;

    if (!pairs.every(({ before, after }) => before.version === previous && after.version === version)) return false;
    if (lock.before.packages[''].version !== previous || lock.after.packages[''].version !== version) return false;
    const date = pkg.after.lastUpdate;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    if (new Date(date).toISOString().slice(0, 10) !== date || release.after.lastUpdate !== date) return false;
    if (date < pkg.before.lastUpdate || date < release.before.lastUpdate) return false;

    return pairs.every(({ file, before, after }) => isDeepStrictEqual(
      withoutReleaseMetadata(file, before),
      withoutReleaseMetadata(file, after),
    ));
  } catch {
    return false;
  }
}
