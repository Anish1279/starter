import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
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

    const activeCheckin = db.getActiveCheckin(user.id);
    if (!activeCheckin) {
      return NextResponse.json(
        { success: false, message: 'No active check-in found to checkout from' },
        { status: 400 }
      );
    }

    db.checkout(activeCheckin.id);

    return NextResponse.json({
      success: true,
      data: {
        message: 'Checked out successfully',
      },
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
