const DEFAULT_ALLOWED_ORIGINS = [
    'https://pacapro.vercel.app',
    'https://chejump.com',
    'https://dev.sean8320.dedyn.io',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3109',
];

function parseOriginList(value) {
    if (!value) return [];
    return value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
}

function buildAllowedOrigins(env = process.env) {
    return [
        ...DEFAULT_ALLOWED_ORIGINS,
        ...parseOriginList(env.CORS_ORIGIN),
        ...parseOriginList(env.CORS_ORIGINS),
    ].filter((origin, index, origins) => origins.indexOf(origin) === index);
}

function createCorsOptions({ env = process.env, logger } = {}) {
    const isDev = env.NODE_ENV === 'development';
    const allowedOrigins = buildAllowedOrigins(env);

    return {
        origin: isDev ? '*' : (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
                return;
            }
            logger?.warn?.(`[CORS] 차단된 origin: ${origin}`);
            callback(null, false);
        },
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
        optionsSuccessStatus: 200,
    };
}

module.exports = {
    DEFAULT_ALLOWED_ORIGINS,
    buildAllowedOrigins,
    createCorsOptions,
    parseOriginList,
};
