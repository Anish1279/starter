import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, message: 'Authorization required' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const user = verifyToken(token);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Invalid token' },
        { status: 401 }
      );
    }

    // Bug Fix: Check role instead of hardcoded ID
    if (user.role !== 'manager') {
      return NextResponse.json(
        { success: false, message: 'Access denied. Managers only.' },
        { status: 403 }
      );
    }

    const stats = db.getManagerStats();
    const chartData = db.getWeeklyChartData();
    const employeePerformance = db.getEmployeePerformance();

    return NextResponse.json({
      success: true,
      data: {
        ...stats,
        chartData,
        employeePerformance,
      },
    });
  } catch (error) {
    console.error('Get manager stats error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
