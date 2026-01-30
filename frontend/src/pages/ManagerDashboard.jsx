// src/pages/ManagerDashboard.jsx
import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import Chart from 'chart.js/auto';

export default function ManagerDashboard({ user }) {
  // Guard: require a logged-in manager
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'manager') return <Navigate to="/dashboard" replace />;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartData, setChartData] = useState(null);
  const lineRef = useRef(null);
  const barRef = useRef(null);
  const chartInstances = useRef({ line: null, bar: null });

  useEffect(() => {
    let mounted = true;

    async function fetchChartData() {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const endpoint = '/api/dashboard/stats/charts';

      async function doFetch(opts) {
        const res = await fetch(endpoint, opts);
        const text = await res.text();
        try {
          const json = JSON.parse(text);
          return { ok: res.ok, status: res.status, json };
        } catch (err) {
          return { ok: res.ok, status: res.status, text };
        }
      }

      try {
        let result = null;

        if (token) {
          result = await doFetch({
            method: 'GET',
            headers: { 'Accept': 'application/json', 'Authorization': 'Bearer ' + token },
          });

          // If 401/403 try cookie mode as fallback
          if (!result.ok && (result.status === 401 || result.status === 403)) {
            result = await doFetch({
              method: 'GET',
              credentials: 'include',
              headers: { 'Accept': 'application/json' },
            });
          }
        } else {
          // no token: try cookie mode
          result = await doFetch({
            method: 'GET',
            credentials: 'include',
            headers: { 'Accept': 'application/json' },
          });
        }

        if (!mounted) return;

        if (!result.ok) {
          const message = result.json?.message || result.json || result.text || `HTTP ${result.status}`;
          setError(`Failed to load chart data: ${message}`);
          setLoading(false);
          return;
        }

        if (!result.json || !result.json.success) {
          setError('Server returned an error: ' + (result.json?.message ?? 'unknown'));
          setLoading(false);
          return;
        }

        setChartData(result.json.data);
        setLoading(false);
      } catch (err) {
        if (!mounted) return;
        setError('Network error: ' + (err.message || String(err)));
        setLoading(false);
      }
    }

    fetchChartData();

    return () => {
      mounted = false;
    };
  }, [user]);

  // Render charts when chartData arrives — use the imported Chart (no dynamic loader)
  useEffect(() => {
    if (!chartData) return;
    let cancelled = false;

    function destroyCharts() {
      try { if (chartInstances.current.line) { chartInstances.current.line.destroy(); } } catch (e) {}
      try { if (chartInstances.current.bar) { chartInstances.current.bar.destroy(); } } catch (e) {}
      chartInstances.current.line = null;
      chartInstances.current.bar = null;
    }

    function renderCharts() {
      if (cancelled) return;

      // prepare labels (last 7 days) and data
      const labels = [];
      const countsByDate = {};
      (chartData.checkins_last_7_days || []).forEach(r => { countsByDate[r.date] = Number(r.count || 0); });
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const key = `${yyyy}-${mm}-${dd}`;
        labels.push(key);
      }
      const dailyCounts = labels.map(l => countsByDate[l] || 0);

      destroyCharts();

      try {
        if (lineRef.current) {
          chartInstances.current.line = new Chart(lineRef.current.getContext('2d'), {
            type: 'line',
            data: {
              labels,
              datasets: [{
                label: 'Check-ins per day',
                data: dailyCounts,
                fill: true,
                tension: 0.3,
                pointRadius: 4
              }]
            },
            options: {
              responsive: true,
              plugins: { legend: { display: true } },
              scales: { y: { beginAtZero: true } }
            }
          });
        }

        const memberLabels = (chartData.checkins_per_member_last_7_days || []).map(r => r.name || 'Unknown');
        const memberCounts = (chartData.checkins_per_member_last_7_days || []).map(r => Number(r.count || 0));

        if (barRef.current) {
          chartInstances.current.bar = new Chart(barRef.current.getContext('2d'), {
            type: 'bar',
            data: {
              labels: memberLabels,
              datasets: [{
                label: 'Check-ins (last 7 days)',
                data: memberCounts,
                barPercentage: 0.7
              }]
            },
            options: {
              indexAxis: 'y',
              responsive: true,
              plugins: { legend: { display: false } },
              scales: { x: { beginAtZero: true } }
            }
          });
        }
      } catch (err) {
        if (!cancelled) setError('Chart rendering error: ' + (err.message || String(err)));
      }
    }

    renderCharts();

    return () => {
      cancelled = true;
      destroyCharts();
    };
  }, [chartData]);

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-3">Manager Dashboard</h2>

      {loading && (
        <div className="min-h-[160px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded mb-3">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && chartData && (
        <>
          <div className="mb-4">
            <div className="flex gap-6">
              <div><strong>Team size:</strong> {chartData.checkins_per_member_last_7_days?.length ?? 0}</div>
              <div><strong>Active now:</strong> {(chartData.active_checkins_per_member || []).reduce((s, r) => s + Number(r.active_count || 0), 0)}</div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-4 rounded shadow">
              <h3 className="font-medium mb-2">Check-ins (last 7 days)</h3>
              <canvas ref={lineRef} style={{ width: '100%', height: 320 }} />
            </div>

            <div className="bg-white p-4 rounded shadow">
              <h3 className="font-medium mb-2">Check-ins by team member (7d)</h3>
              <canvas ref={barRef} style={{ width: '100%', height: 320 }} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
