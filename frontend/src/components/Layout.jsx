import { Outlet, Link, useLocation } from 'react-router-dom';

function Layout({ user, onLogout }) {
    const location = useLocation();

    const baseNav = [
        { path: '/dashboard', label: 'Dashboard' },
        { path: '/checkin', label: 'Check In' },
        { path: '/history', label: 'History' }
    ];

    // Add manager nav item only for users with manager role
    const navItems = [...baseNav];
    if (user && user.role === 'manager') {
        navItems.push({ path: '/dashboard/manager', label: 'Manager' });
    }

    // Active logic: treat /dashboard as exact match, other items use startsWith
    const isActive = (path) => {
        if (path === '/dashboard') {
            return location.pathname === '/dashboard';
        }
        return location.pathname.startsWith(path);
    };

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
                    <div className="flex items-center space-x-8">
                        <h1 className="text-xl font-bold text-blue-600">Unolo Tracker</h1>
                        <nav className="flex space-x-4">
                            {navItems.map((item) => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                                        isActive(item.path)
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                                    aria-current={isActive(item.path) ? 'page' : undefined}
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </nav>
                    </div>
                    <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-600">
                            {user?.name ?? 'Guest'} {user?.role ? `(${user.role})` : null}
                        </span>
                        <button
                            onClick={onLogout}
                            className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 py-6">
                <Outlet />
            </main>
        </div>
    );
}

export default Layout;
