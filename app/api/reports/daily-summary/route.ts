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

    // Only managers can access daily summary
    if (user.role !== 'manager') {
      return NextResponse.json(
        { success: false, message: 'Access denied. Only managers can view daily summary reports.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    // Validate date format
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { success: false, message: 'Invalid date format. Please use YYYY-MM-DD format.' },
        { status: 400 }
      );
    }

    // Validate date is not in the future
    const targetDate = date ? new Date(date) : new Date();
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    if (targetDate > today) {
      return NextResponse.json(
        { success: false, message: 'Cannot generate report for future dates.' },
        { status: 400 }
      );
    }

    const summary = db.getDailySummary(date || new Date().toISOString().split('T')[0]);

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('Get daily summary error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
