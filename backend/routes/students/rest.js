/**
 * 학생 휴원·복귀 라우트 등록.
 *
 * 각 기능은 500줄 제한과 단일 책임을 지키도록 별도 모듈에서 구현한다.
 */

const registerProcessRestRoute = require('./rest/processRest');
const registerResumeRoute = require('./rest/resume');

module.exports = function registerRestRoutes(router) {
    registerProcessRestRoute(router);
    registerResumeRoute(router);
};
