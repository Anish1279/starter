const express = require('express');
const pool = require('../config/database');
const { authenticateToken, requireManager } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/reports/daily-summary
 * Get daily summary report for manager's team
 * 
 * Query Parameters:
 * - date (required): Date in YYYY-MM-DD format
 * - employee_id (optional): Filter by specific employee ID
 * 
 * Response: {
 *   success: boolean,
 *   data: {
 *     date: string,
 *     team_summary: {
 *       total_employees: number,
 *       employees_with_checkins: number,
 *       total_checkins: number,
 *       total_hours_worked: number,
 *       unique_clients_visited: number,
 *       average_distance_from_client: number
 *     },
 *     employee_breakdown: [{
 *       employee_id: number,
 *       employee_name: string,
 *       employee_email: string,
 *       total_checkins: number,
 *       hours_worked: number,
 *       clients_visited: string[],
 *       average_distance: number,
 *       checkins: [{...}]
 *     }]
 *   }
 * }
 */
router.get('/daily-summary', authenticateToken, requireManager, async (req, res) => {
    try {
        const { date, employee_id } = req.query;

        // Validate required date parameter
        if (!date) {
            return res.status(400).json({ 
                success: false, 
                message: 'Date parameter is required (format: YYYY-MM-DD)' 
            });
        }

        // Validate date format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid date format. Use YYYY-MM-DD' 
            });
        }

        // Validate that the date is a valid date
        const parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid date provided' 
            });
        }

        // Get all team members for this manager
        const [teamMembers] = await pool.execute(
            'SELECT id, name, email FROM users WHERE manager_id = ?',
            [req.user.id]
        );

        if (teamMembers.length === 0) {
            return res.json({
                success: true,
                data: {
                    date,
                    team_summary: {
                        total_employees: 0,
                        employees_with_checkins: 0,
                        total_checkins: 0,
                        total_hours_worked: 0,
                        unique_clients_visited: 0,
                        average_distance_from_client: null
                    },
                    employee_breakdown: []
                }
            });
        }

        // Build employee filter
        let employeeFilter = '';
        const params = [req.user.id, date];
        
        if (employee_id) {
            // Validate employee_id is a number
            if (isNaN(parseInt(employee_id))) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid employee_id parameter' 
                });
            }
            employeeFilter = ' AND ch.employee_id = ?';
            params.push(parseInt(employee_id));
        }

        // Efficient single query to get all checkins for the team on the specified date
        // This avoids N+1 queries by fetching all data in one go
        const [checkins] = await pool.execute(
            `SELECT 
                ch.id,
                ch.employee_id,
                ch.client_id,
                ch.checkin_time,
                ch.checkout_time,
                ch.latitude,
                ch.longitude,
                ch.distance_from_client,
                ch.notes,
                ch.status,
                u.name as employee_name,
                u.email as employee_email,
                c.name as client_name,
                c.address as client_address
             FROM checkins ch
             INNER JOIN users u ON ch.employee_id = u.id
             INNER JOIN clients c ON ch.client_id = c.id
             WHERE u.manager_id = ? 
             AND DATE(ch.checkin_time) = ?
             ${employeeFilter}
             ORDER BY ch.employee_id, ch.checkin_time`,
            params
        );

        // Process data to create employee breakdown
        const employeeMap = new Map();
        let totalCheckins = 0;
        let totalHoursWorked = 0;
        const uniqueClients = new Set();
        let totalDistance = 0;
        let distanceCount = 0;

        // Initialize all team members (even those without checkins)
        teamMembers.forEach(member => {
            // If filtering by employee_id, only include that employee
            if (employee_id && member.id !== parseInt(employee_id)) {
                return;
            }
            employeeMap.set(member.id, {
                employee_id: member.id,
                employee_name: member.name,
                employee_email: member.email,
                total_checkins: 0,
                hours_worked: 0,
                clients_visited: [],
                client_names: new Set(),
                average_distance: null,
                total_distance: 0,
                distance_count: 0,
                checkins: []
            });
        });

        // Process each checkin
        checkins.forEach(checkin => {
            const employee = employeeMap.get(checkin.employee_id);
            if (!employee) return;

            // Calculate hours worked for this checkin
            let hoursWorked = 0;
            if (checkin.checkout_time) {
                const checkinTime = new Date(checkin.checkin_time);
                const checkoutTime = new Date(checkin.checkout_time);
                hoursWorked = (checkoutTime - checkinTime) / (1000 * 60 * 60);
            }

            // Update employee data
            employee.total_checkins++;
            employee.hours_worked += hoursWorked;
            employee.client_names.add(checkin.client_name);
            employee.checkins.push({
                id: checkin.id,
                client_id: checkin.client_id,
                client_name: checkin.client_name,
                client_address: checkin.client_address,
                checkin_time: checkin.checkin_time,
                checkout_time: checkin.checkout_time,
                hours_worked: Math.round(hoursWorked * 100) / 100,
                distance_from_client: checkin.distance_from_client,
                notes: checkin.notes,
                status: checkin.status
            });

            // Track distance
            if (checkin.distance_from_client !== null) {
                employee.total_distance += checkin.distance_from_client;
                employee.distance_count++;
                totalDistance += checkin.distance_from_client;
                distanceCount++;
            }

            // Update team totals
            totalCheckins++;
            totalHoursWorked += hoursWorked;
            uniqueClients.add(checkin.client_id);
        });

        // Finalize employee breakdown
        const employeeBreakdown = [];
        let employeesWithCheckins = 0;

        employeeMap.forEach(employee => {
            if (employee.total_checkins > 0) {
                employeesWithCheckins++;
            }
            
            employeeBreakdown.push({
                employee_id: employee.employee_id,
                employee_name: employee.employee_name,
                employee_email: employee.employee_email,
                total_checkins: employee.total_checkins,
                hours_worked: Math.round(employee.hours_worked * 100) / 100,
                clients_visited: Array.from(employee.client_names),
                average_distance: employee.distance_count > 0 
                    ? Math.round((employee.total_distance / employee.distance_count) * 100) / 100 
                    : null,
                checkins: employee.checkins
            });
        });

        // Sort by total checkins (descending)
        employeeBreakdown.sort((a, b) => b.total_checkins - a.total_checkins);

        // Build response
        const response = {
            success: true,
            data: {
                date,
                team_summary: {
                    total_employees: employee_id ? 1 : teamMembers.length,
                    employees_with_checkins: employeesWithCheckins,
                    total_checkins: totalCheckins,
                    total_hours_worked: Math.round(totalHoursWorked * 100) / 100,
                    unique_clients_visited: uniqueClients.size,
                    average_distance_from_client: distanceCount > 0 
                        ? Math.round((totalDistance / distanceCount) * 100) / 100 
                        : null
                },
                employee_breakdown: employeeBreakdown
            }
        };

        res.json(response);

    } catch (error) {
        console.error('Daily summary error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to generate daily summary report' 
        });
    }
});

module.exports = router;
