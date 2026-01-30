// routes/dashboard.js
const express = require('express');
const path = require('path');
const pool = require('../config/database');
const { authenticateToken, requireManager } = require('../middleware/auth');

const router = express.Router();

/**
 * Protected UI: serve the manager-dashboard.html only to authenticated managers.
 * URL: GET /dashboard/ui
 *
 * NOTE: __dirname points to routes/, so the public file path is ../public/manager-dashboard.html
 * Make sure the HTML file exists at that location.
 */
router.get('/ui', authenticateToken, requireManager, (req, res) => {
  const filePath = path.join(__dirname, '..', 'public', 'manager-dashboard.html');
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error sending manager-dashboard.html:', err);
      // If headers already sent, let Express handle it; otherwise send JSON
      if (!res.headersSent) {
        res.status(err.status || 500).json({ success: false, message: 'Failed to load UI' });
      }
    }
  });
});

/**
 * Lightweight health-check
 * URL: GET /dashboard/health
 */
router.get('/health', (req, res) => {
  res.json({ success: true, now: new Date().toISOString() });
});

// existing /stats route (kept, slightly cleaned)
router.get('/stats', authenticateToken, requireManager, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Get team members
    const [teamMembers] = await pool.execute(
      'SELECT id, name, email FROM users WHERE manager_id = ?',
      [req.user.id]
    );

    // Get today's check-ins for the team
    const [todayCheckins] = await pool.execute(
      `SELECT ch.*, u.name as employee_name, c.name as client_name
       FROM checkins ch
       INNER JOIN users u ON ch.employee_id = u.id
       INNER JOIN clients c ON ch.client_id = c.id
       WHERE u.manager_id = ? AND DATE(ch.checkin_time) = ?
       ORDER BY ch.checkin_time DESC`,
      [req.user.id, today]
    );

    // Get active check-ins count
    const [activeCount] = await pool.execute(
      `SELECT COUNT(*) as count FROM checkins ch
       INNER JOIN users u ON ch.employee_id = u.id
       WHERE u.manager_id = ? AND ch.status = ?`,
      [req.user.id, 'checked_in']
    );

    res.json({
      success: true,
      data: {
        team_size: teamMembers.length,
        team_members: teamMembers,
        today_checkins: todayCheckins,
        active_checkins: activeCount[0].count
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard stats' });
  }
});

/**
 * /stats/charts
 * Returns aggregated data used by client-side charts:
 *  - checkins_last_7_days: [{ date: 'YYYY-MM-DD', count: Number }, ...]
 *  - checkins_per_member_last_7_days: [{ id, name, count }, ...]
 *  - active_checkins_per_member: [{ id, name, active_count }, ...]
 *
 * Requires manager role.
 */
router.get('/stats/charts', authenticateToken, requireManager, async (req, res) => {
  try {
    const managerId = req.user.id;

    // 1) Checkins per day last 7 days (include dates with zero by generating on client if missing)
    const [daily] = await pool.execute(
      `SELECT DATE(ch.checkin_time) AS date, COUNT(*) AS count
       FROM checkins ch
       INNER JOIN users u ON ch.employee_id = u.id
       WHERE u.manager_id = ? AND ch.checkin_time >= datetime('now', '-6 days')
       GROUP BY DATE(ch.checkin_time)
       ORDER BY DATE(ch.checkin_time) ASC`,
      [managerId]
    );

    // 2) Checkins per team member in last 7 days
    const [perMember] = await pool.execute(
      `SELECT u.id, u.name, COUNT(ch.id) AS count
       FROM users u
       LEFT JOIN checkins ch ON ch.employee_id = u.id AND ch.checkin_time >= datetime('now', '-7 days')
       WHERE u.manager_id = ?
       GROUP BY u.id
       ORDER BY count DESC, u.name ASC`,
      [managerId]
    );

    // 3) Active (checked_in) count per member (usually 0 or 1 per member)
    const [activePerMember] = await pool.execute(
      `SELECT u.id, u.name, COUNT(ch.id) AS active_count
       FROM users u
       LEFT JOIN checkins ch ON ch.employee_id = u.id AND ch.status = ?
       WHERE u.manager_id = ?
       GROUP BY u.id
       ORDER BY active_count DESC, u.name ASC`,
      ['checked_in', managerId]
    );

    // Cache short-lived: charts are lightweight and updating frequently; caching helps performance
    res.set('Cache-Control', 'public, max-age=60');

    res.json({
      success: true,
      data: {
        checkins_last_7_days: daily,
        checkins_per_member_last_7_days: perMember,
        active_checkins_per_member: activePerMember
      }
    });
  } catch (err) {
    // Helpful debug logging in non-production
    if (process.env.NODE_ENV !== 'production') {
      console.error('Chart data error (managerId=' + (req.user && req.user.id) + '):', err);
    } else {
      console.error('Chart data error:', err.message || err);
    }
    res.status(500).json({ success: false, message: 'Failed to fetch chart data' });
  }
});

// employee and other routes remain unchanged below
router.get('/employee', authenticateToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [todayCheckins] = await pool.execute(
      `SELECT ch.*, c.name as client_name
       FROM checkins ch
       INNER JOIN clients c ON ch.client_id = c.id
       WHERE ch.employee_id = ? AND DATE(ch.checkin_time) = ?
       ORDER BY ch.checkin_time DESC`,
      [req.user.id, today]
    );

    const [clients] = await pool.execute(
      `SELECT c.* FROM clients c
       INNER JOIN employee_clients ec ON c.id = ec.client_id
       WHERE ec.employee_id = ?`,
      [req.user.id]
    );

    const [weekStats] = await pool.execute(
      `SELECT COUNT(*) as total_checkins,
              COUNT(DISTINCT client_id) as unique_clients
       FROM checkins
       WHERE employee_id = ? AND checkin_time >= datetime('now', '-7 days')`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: {
        today_checkins: todayCheckins,
        assigned_clients: clients,
        week_stats: weekStats[0]
      }
    });
  } catch (error) {
    console.error('Employee dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard' });
  }
});

module.exports = router;
