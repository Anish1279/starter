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

    const { searchParams } = new URL(request.url);
    const start_date = searchParams.get('start_date');
    const end_date = searchParams.get('end_date');

    // Input validation for dates
    if (start_date && !/^\d{4}-\d{2}-\d{2}$/.test(start_date)) {
      return NextResponse.json(
        { success: false, message: 'Invalid start date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    if (end_date && !/^\d{4}-\d{2}-\d{2}$/.test(end_date)) {
      return NextResponse.json(
        { success: false, message: 'Invalid end date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    const checkins = db.getCheckinHistory(user.id, start_date, end_date);

    return NextResponse.json({
      success: true,
      data: checkins,
    });
  } catch (error) {
    console.error('Get history error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
