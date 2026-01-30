// File: routes/checkin.js
const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const STATUS = {
  CHECKED_IN: 'checked_in',
  CHECKED_OUT: 'checked_out',
};

// Haversine formula to calculate distance (in kilometers)
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isValidLatitude(v) {
  return Number.isFinite(v) && v >= -90 && v <= 90;
}

function isValidLongitude(v) {
  return Number.isFinite(v) && v >= -180 && v <= 180;
}

/**
 * Helper: get the most recent active checkin for an employee
 * Returns an array (rows) or empty array.
 */
async function getMostRecentActiveCheckin(employeeId) {
  const [rows] = await pool.execute(
    'SELECT * FROM checkins WHERE employee_id = ? AND status = ? ORDER BY checkin_time DESC LIMIT 1',
    [employeeId, STATUS.CHECKED_IN]
  );
  return rows;
}

/**
 * GET /clients
 * return clients assigned to the authenticated employee
 */
router.get('/clients', authenticateToken, async (req, res) => {
  try {
    const [clients] = await pool.execute(
      `SELECT c.* FROM clients c
       INNER JOIN employee_clients ec ON c.id = ec.client_id
       WHERE ec.employee_id = ?`,
      [req.user.id]
    );
    return res.json({ success: true, data: clients });
  } catch (err) {
    console.error('Get clients error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch clients' });
  }
});

/**
 * POST /
 * Create a new check-in
 * Body: { client_id, latitude, longitude, notes }
 */
router.post('/', authenticateToken, async (req, res) => {
  const employeeId = req.user.id;
  const { client_id, latitude, longitude, notes } = req.body;

  // Basic validation
  if (!client_id) {
    return res.status(400).json({ success: false, message: 'client_id is required' });
  }

  // parse coordinates if present
  const lat = latitude !== undefined ? parseFloat(latitude) : null;
  const lng = longitude !== undefined ? parseFloat(longitude) : null;

  if ((latitude !== undefined || longitude !== undefined) && (lat === null || lng === null)) {
    return res.status(400).json({ success: false, message: 'latitude and longitude must be valid numbers' });
  }

  if (lat !== null && !isValidLatitude(lat)) {
    return res.status(400).json({ success: false, message: 'latitude out of range (-90 to 90)' });
  }
  if (lng !== null && !isValidLongitude(lng)) {
    return res.status(400).json({ success: false, message: 'longitude out of range (-180 to 180)' });
  }

  // clamp notes length
  const safeNotes = typeof notes === 'string' ? notes.slice(0, 2000) : null;

  // Use a transaction to avoid races when checking for active check-ins
  try {
    await pool.execute('BEGIN IMMEDIATE');

    // Ensure employee is assigned to client
    const [assignments] = await pool.execute(
      'SELECT 1 FROM employee_clients WHERE employee_id = ? AND client_id = ? LIMIT 1',
      [employeeId, client_id]
    );
    if (assignments.length === 0) {
      await pool.execute('ROLLBACK');
      return res.status(403).json({ success: false, message: 'You are not assigned to this client' });
    }

    // Ensure there is no active check-in
    const active = await getMostRecentActiveCheckin(employeeId);
    if (active.length > 0) {
      await pool.execute('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'You already have an active check-in. Please checkout first.',
      });
    }

    // Get client coordinates (if stored) to calculate distance
    const [clients] = await pool.execute('SELECT latitude, longitude FROM clients WHERE id = ?', [client_id]);
    let distanceFromClient = null;
    let distanceWarning = null;

    if (clients.length > 0 && lat !== null && lng !== null) {
      const client = clients[0];
      if (client.latitude != null && client.longitude != null) {
        const clientLat = parseFloat(client.latitude);
        const clientLng = parseFloat(client.longitude);
        if (Number.isFinite(clientLat) && Number.isFinite(clientLng)) {
          const distKm = calculateDistanceKm(lat, lng, clientLat, clientLng);
          distanceFromClient = Math.round(distKm * 100) / 100; // 2 decimal km
          if (distanceFromClient > 0.5) {
            distanceWarning = 'You are far from the client location';
          }
        }
      }
    }

    // Insert the checkin, set checkin_time via SQLite datetime('now') (UTC)
    const [insertRes] = await pool.execute(
      `INSERT INTO checkins
        (employee_id, client_id, latitude, longitude, distance_from_client, notes, status, checkin_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [employeeId, client_id, lat, lng, distanceFromClient, safeNotes, STATUS.CHECKED_IN]
    );

    const newId = insertRes.insertId;

    // fetch and return inserted record with client name (optional)
    const [rows] = await pool.execute(
      `SELECT ch.*, c.name as client_name, c.address as client_address
       FROM checkins ch
       LEFT JOIN clients c ON ch.client_id = c.id
       WHERE ch.id = ? LIMIT 1`,
      [newId]
    );

    await pool.execute('COMMIT');

    return res.status(201).json({
      success: true,
      data: rows.length > 0 ? rows[0] : { id: newId },
      message: 'Checked in successfully',
      distance_warning: distanceWarning || null,
    });
  } catch (err) {
    console.error('Check-in transaction error:', err);
    try {
      await pool.execute('ROLLBACK');
    } catch (rbErr) {
      console.error('Rollback failed:', rbErr);
    }
    return res.status(500).json({ success: false, message: 'Check-in failed' });
  }
});

/**
 * PUT /checkout
 * Checkout from most recent active check-in
 */
router.put('/checkout', authenticateToken, async (req, res) => {
  const employeeId = req.user.id;

  try {
    await pool.execute('BEGIN IMMEDIATE');

    const active = await getMostRecentActiveCheckin(employeeId);
    if (active.length === 0) {
      await pool.execute('ROLLBACK');
      return res.status(404).json({ success: false, message: 'No active check-in found' });
    }

    const checkin = active[0];

    // Update checkout_time and status only if currently checked_in
    await pool.execute(
      "UPDATE checkins SET checkout_time = datetime('now'), status = ? WHERE id = ? AND status = ?",
      [STATUS.CHECKED_OUT, checkin.id, STATUS.CHECKED_IN]
    );

    // Fetch updated record
    const [rows] = await pool.execute(
      `SELECT ch.*, c.name as client_name, c.address as client_address
       FROM checkins ch
       LEFT JOIN clients c ON ch.client_id = c.id
       WHERE ch.id = ? LIMIT 1`,
      [checkin.id]
    );

    await pool.execute('COMMIT');

    return res.json({
      success: true,
      data: rows.length > 0 ? rows[0] : { id: checkin.id },
      message: 'Checked out successfully',
    });
  } catch (err) {
    console.error('Checkout transaction error:', err);
    try {
      await pool.execute('ROLLBACK');
    } catch (rbErr) {
      console.error('Rollback failed:', rbErr);
    }
    return res.status(500).json({ success: false, message: 'Checkout failed' });
  }
});

/**
 * GET /history
 * Query params: start_date (YYYY-MM-DD), end_date (YYYY-MM-DD)
 */
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let query = `
      SELECT ch.*, c.name as client_name, c.address as client_address
      FROM checkins ch
      LEFT JOIN clients c ON ch.client_id = c.id
      WHERE ch.employee_id = ?
    `;
    const params = [req.user.id];

    if (start_date) {
      query += ' AND DATE(ch.checkin_time) >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND DATE(ch.checkin_time) <= ?';
      params.push(end_date);
    }

    query += ' ORDER BY ch.checkin_time DESC';

    const [rows] = await pool.execute(query, params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('History error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch history' });
  }
});

/**
 * GET /active
 * Return the current active checkin (if any)
 */
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT ch.*, c.name as client_name
       FROM checkins ch
       LEFT JOIN clients c ON ch.client_id = c.id
       WHERE ch.employee_id = ? AND ch.status = ?
       ORDER BY ch.checkin_time DESC LIMIT 1`,
      [req.user.id, STATUS.CHECKED_IN]
    );
    return res.json({ success: true, data: rows.length > 0 ? rows[0] : null });
  } catch (err) {
    console.error('Active checkin error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch active check-in' });
  }
});

module.exports = router;
