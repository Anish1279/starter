# Bug Fixes Documentation

This document describes all bugs found and fixed in the Field Force Tracker application.

---

## Bug 1: Missing `await` on Password Comparison

**Location:** `backend/routes/auth.js`, Line 27

**Symptom:** Login sometimes fails even with correct credentials, or succeeds with incorrect credentials.

**What was wrong:**
```javascript
const isValidPassword = bcrypt.compare(password, user.password);
```
The `bcrypt.compare()` function returns a Promise, but the code was not awaiting it. This means `isValidPassword` was always truthy (a Promise object), causing authentication to always succeed regardless of password correctness.

**How I fixed it:**
```javascript
const isValidPassword = await bcrypt.compare(password, user.password);
```
Added the `await` keyword to properly wait for the Promise to resolve.

**Why this fix is correct:**
`bcrypt.compare()` is an asynchronous function that returns a Promise. Without `await`, the variable receives the Promise object itself (which is truthy) instead of the boolean result. Adding `await` ensures we get the actual comparison result (true/false).

---

## Bug 2: Password Stored in JWT Token (Security Vulnerability)

**Location:** `backend/routes/auth.js`, Line 33

**Symptom:** Security vulnerability - sensitive password data exposed in JWT token.

**What was wrong:**
```javascript
const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name, password: user.password },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
);
```
The password hash was being included in the JWT payload, which is a serious security vulnerability.

**How I fixed it:**
```javascript
const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
);
```
Removed the password field from the JWT payload.

**Why this fix is correct:**
JWT tokens are base64 encoded and can be decoded by anyone. Including password hashes exposes them to potential attackers. Only non-sensitive identification data should be stored in JWT tokens.

---

## Bug 3: Wrong HTTP Status Code for Validation Error

**Location:** `backend/routes/checkin.js`, Line 25

**Symptom:** API returns wrong status codes in certain scenarios.

**What was wrong:**
```javascript
if (!client_id) {
    return res.status(200).json({ success: false, message: 'Client ID is required' });
}
```
Returning HTTP 200 (OK) for a validation error.

**How I fixed it:**
```javascript
if (!client_id) {
    return res.status(400).json({ success: false, message: 'Client ID is required' });
}
```
Changed to HTTP 400 (Bad Request).

**Why this fix is correct:**
HTTP 200 indicates success, but a validation failure is a client error. HTTP 400 is the correct status code for malformed or invalid request data. This follows REST API best practices and allows clients to properly handle errors.

---

## Bug 4: Wrong Column Names in Database Insert

**Location:** `backend/routes/checkin.js`, Line 55-58

**Symptom:** Location data is not being saved correctly.

**What was wrong:**
```javascript
const [result] = await pool.execute(
    `INSERT INTO checkins (employee_id, client_id, lat, lng, notes, status)
     VALUES (?, ?, ?, ?, ?, 'checked_in')`,
    [req.user.id, client_id, latitude, longitude, notes || null]
);
```
The column names `lat` and `lng` don't match the actual database schema columns.

**How I fixed it:**
```javascript
const [result] = await pool.execute(
    `INSERT INTO checkins (employee_id, client_id, latitude, longitude, notes, status)
     VALUES (?, ?, ?, ?, ?, 'checked_in')`,
    [req.user.id, client_id, latitude, longitude, notes || null]
);
```
Changed to use correct column names `latitude` and `longitude`.

**Why this fix is correct:**
The database schema defines columns as `latitude` and `longitude`, not `lat` and `lng`. Using incorrect column names would cause the insert to fail or store data in wrong columns.

---

## Bug 5: SQL Injection Vulnerability

**Location:** `backend/routes/checkin.js`, Lines 77-78

**Symptom:** Security vulnerability in date filtering.

**What was wrong:**
```javascript
if (start_date) {
    query += ` AND DATE(ch.checkin_time) >= '${start_date}'`;
}
if (end_date) {
    query += ` AND DATE(ch.checkin_time) <= '${end_date}'`;
}
```
Direct string interpolation of user input into SQL query allows SQL injection attacks.

**How I fixed it:**
```javascript
if (start_date) {
    query += ` AND DATE(ch.checkin_time) >= ?`;
    params.push(start_date);
}
if (end_date) {
    query += ` AND DATE(ch.checkin_time) <= ?`;
    params.push(end_date);
}
```
Used parameterized queries with placeholder values.

**Why this fix is correct:**
Parameterized queries prevent SQL injection by treating input as data, not executable code. The database driver properly escapes and quotes the values, making it impossible for malicious input to alter the query structure.

---

## Bug 6: MySQL-Specific SQL Functions in SQLite Database

**Location:** `backend/routes/dashboard.js`, Line 75 and `backend/routes/checkin.js`, Line 87

**Symptom:** Dashboard shows incorrect data / queries fail.

**What was wrong:**
```javascript
// In dashboard.js
WHERE employee_id = ? AND checkin_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)

// In checkin.js (checkout)
'UPDATE checkins SET checkout_time = NOW(), status = "checked_out" WHERE id = ?'
```
`DATE_SUB()` and `NOW()` are MySQL-specific functions that don't work in SQLite.

**How I fixed it:**
```javascript
// In dashboard.js
WHERE employee_id = ? AND checkin_time >= datetime('now', '-7 days')

// In checkin.js
'UPDATE checkins SET checkout_time = datetime(\'now\'), status = "checked_out" WHERE id = ?'
```
Changed to SQLite-compatible `datetime()` function.

**Why this fix is correct:**
SQLite uses different date/time functions than MySQL. `datetime('now')` is SQLite's equivalent of MySQL's `NOW()`, and `datetime('now', '-7 days')` handles date arithmetic. This ensures queries work correctly with the SQLite database being used.

---

## Bug 7: Form Not Preventing Default Submission

**Location:** `frontend/src/pages/CheckIn.jsx`, Line 53

**Symptom:** Check-in form doesn't submit properly.

**What was wrong:**
```javascript
const handleCheckIn = async (e) => {
    setError('');
    // ... missing e.preventDefault()
```
The form submission handler didn't call `e.preventDefault()`, causing the browser to perform a default form submission (page reload).

**How I fixed it:**
```javascript
const handleCheckIn = async (e) => {
    e.preventDefault();
    setError('');
```
Added `e.preventDefault()` at the beginning of the handler.

**Why this fix is correct:**
In React, form submissions need `preventDefault()` to stop the browser's default behavior of reloading the page. Without it, the async API call is interrupted by the page reload, and the user sees no feedback.

---

## Bug 8: Accessing Null Array in History Page

**Location:** `frontend/src/pages/History.jsx`, Lines 40-47

**Symptom:** Attendance history page crashes on load.

**What was wrong:**
```javascript
const totalHours = checkins.reduce((total, checkin) => {
```
The `checkins` state is initialized as `null`, and the `.reduce()` method is called before data is loaded, causing a crash.

**How I fixed it:**
```javascript
const totalHours = (checkins || []).reduce((total, checkin) => {
```
Added null coalescing to provide an empty array as fallback.

**Why this fix is correct:**
Using `(checkins || [])` ensures we always call `.reduce()` on an array, even when `checkins` is null during initial render or loading. This prevents the "Cannot read property 'reduce' of null" error.

---

## Bug 9: Hardcoded User ID for Manager Check

**Location:** `frontend/src/pages/Dashboard.jsx`, Line 18

**Symptom:** Dashboard shows incorrect data for some users.

**What was wrong:**
```javascript
const endpoint = user.id === 1 ? '/dashboard/stats' : '/dashboard/employee';
```
Using hardcoded `user.id === 1` to determine if user is a manager.

**How I fixed it:**
```javascript
const endpoint = user.role === 'manager' ? '/dashboard/stats' : '/dashboard/employee';
```
Changed to check the user's role property.

**Why this fix is correct:**
The manager check should be based on the user's role, not their ID. A user with ID 1 might not always be a manager, and managers might have different IDs in different environments. Using `user.role` is the semantically correct approach.

---

## Bug 10: Conditional Hook Call (Rules of Hooks Violation)

**Location:** `frontend/src/components/Counter.jsx`, Lines 17-20

**Symptom:** React components have performance issues and don't update correctly.

**What was wrong:**
```javascript
if (showDouble) {
    useEffect(() => {
        console.log('Double value:', count * 2);
    }, [count]);
}
```
Hooks cannot be called conditionally - this violates React's Rules of Hooks.

**How I fixed it:**
```javascript
useEffect(() => {
    if (showDouble) {
        console.log('Double value:', count * 2);
    }
}, [count, showDouble]);
```
Moved the condition inside the hook, and added `showDouble` to dependencies.

**Why this fix is correct:**
React requires hooks to be called in the same order every render. Conditional hook calls can cause hooks to be called in different orders, breaking React's internal state tracking. The condition should be inside the hook, not around it.

---

## Bug 11: Stale Closure in setInterval

**Location:** `frontend/src/components/Counter.jsx`, Line 13

**Symptom:** Auto-increment doesn't work correctly.

**What was wrong:**
```javascript
const interval = setInterval(() => {
    setCount(count + 1);
}, 1000);
```
Using `count` directly creates a stale closure - the interval always uses the initial value.

**How I fixed it:**
```javascript
const interval = setInterval(() => {
    setCount(prevCount => prevCount + 1);
}, 1000);
```
Used functional update form of setState.

**Why this fix is correct:**
When using state inside callbacks (like setInterval), the closure captures the value at the time of creation. Using `setCount(prev => prev + 1)` accesses the current state value instead of the captured stale value.

---

## Bug 12: useRef Value Never Updated

**Location:** `frontend/src/components/Counter.jsx`, Line 23

**Symptom:** "Log" button shows stale count value.

**What was wrong:**
```javascript
const countRef = useRef(count);
// ... ref is never updated after initial render
```
The ref was initialized with the count but never updated when count changed.

**How I fixed it:**
```javascript
const countRef = useRef(count);

useEffect(() => {
    countRef.current = count;
}, [count]);
```
Added a useEffect to keep the ref in sync with the count state.

**Why this fix is correct:**
`useRef` doesn't automatically track state changes. To maintain synchronization between a ref and state, we need an effect that updates the ref whenever the state changes.

---

## Summary

| # | Location | Issue | Fix |
|---|----------|-------|-----|
| 1 | auth.js:27 | Missing await on bcrypt.compare | Added await |
| 2 | auth.js:33 | Password in JWT token | Removed password from payload |
| 3 | checkin.js:25 | Wrong status code (200 vs 400) | Changed to 400 |
| 4 | checkin.js:55-58 | Wrong column names (lat/lng) | Changed to latitude/longitude |
| 5 | checkin.js:77-78 | SQL injection vulnerability | Used parameterized queries |
| 6 | dashboard.js:75, checkin.js:87 | MySQL functions in SQLite | Used SQLite datetime() |
| 7 | CheckIn.jsx:53 | Missing preventDefault | Added e.preventDefault() |
| 8 | History.jsx:40-47 | Null array access | Added null coalescing |
| 9 | Dashboard.jsx:18 | Hardcoded user ID check | Changed to role check |
| 10 | Counter.jsx:17-20 | Conditional hook call | Moved condition inside hook |
| 11 | Counter.jsx:13 | Stale closure in interval | Used functional setState |
| 12 | Counter.jsx:6,23 | Ref not synced with state | Added sync effect |
