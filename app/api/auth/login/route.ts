import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createToken, hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // Input validation
    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { success: false, message: 'Please provide a valid email address' },
        { status: 400 }
      );
    }

    if (typeof password !== 'string' || password.length < 1) {
      return NextResponse.json(
        { success: false, message: 'Password cannot be empty' },
        { status: 400 }
      );
    }

    const user = db.getUserByEmail(email);

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Bug Fix: Properly compare passwords (in real app, use bcrypt)
    const hashedPassword = hashPassword(password);
    if (hashedPassword !== user.password) {
      return NextResponse.json(
        { success: false, message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Bug Fix: Don't include password in token
    const token = createToken({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    return NextResponse.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
