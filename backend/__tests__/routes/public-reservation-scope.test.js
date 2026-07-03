const fs = require('fs');
const path = require('path');

function source(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('public reservation academy and contact guards', () => {
  const publicRoot = source('routes/public.js');
  const reservationRoutes = source('routes/public/reservation.js');

  test('reservation routes live in a focused sub-router', () => {
    expect(publicRoot).toContain("require('./public/reservation')");
    expect(publicRoot).not.toContain("router.get('/reservation/:reservationNumber'");
    expect(publicRoot).not.toContain("router.put('/reservation/:reservationNumber'");
  });

  test('canonical reservation routes require academy slug and contact verification', () => {
    expect(reservationRoutes).toContain("router.get('/consultation/:academySlug/reservation/:reservationNumber'");
    expect(reservationRoutes).toContain("router.put('/consultation/:academySlug/reservation/:reservationNumber'");
    expect(reservationRoutes).toContain('phoneLast4');
    expect(reservationRoutes).toContain('a.slug = ?');
    expect(reservationRoutes).toContain('verifyReservationContact');
  });

  test('legacy reservation number routes still require contact verification and academy-scoped updates', () => {
    expect(reservationRoutes).toContain("router.get('/reservation/:reservationNumber'");
    expect(reservationRoutes).toContain("router.put('/reservation/:reservationNumber'");
    expect(reservationRoutes).toContain('WHERE id = ? AND academy_id = ?');
    expect(reservationRoutes).not.toContain('WHERE id = ?`');
  });
});
