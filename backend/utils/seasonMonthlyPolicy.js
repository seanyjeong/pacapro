const DEFAULT_SEASON_MONTHLY_POLICY = 'season_replaces_monthly';
const SEASON_MONTHLY_POLICIES = new Set([
    DEFAULT_SEASON_MONTHLY_POLICY,
    'season_plus_monthly',
]);

function parseSettings(settings) {
    if (!settings) return {};
    if (typeof settings === 'object') return settings;
    try {
        return JSON.parse(settings);
    } catch {
        return {};
    }
}

function isSeasonMonthlyPolicy(value) {
    return SEASON_MONTHLY_POLICIES.has(value);
}

function getSeasonMonthlyPolicy(settings) {
    const parsed = parseSettings(settings);
    return isSeasonMonthlyPolicy(parsed.season_monthly_policy)
        ? parsed.season_monthly_policy
        : DEFAULT_SEASON_MONTHLY_POLICY;
}

module.exports = {
    DEFAULT_SEASON_MONTHLY_POLICY,
    getSeasonMonthlyPolicy,
    isSeasonMonthlyPolicy,
    parseSettings,
};
