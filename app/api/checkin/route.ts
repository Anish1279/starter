import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// Haversine formula to calculate distance between two geographic coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// GET - Get active check-in status
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

    const activeCheckin = db.getActiveCheckin(user.id);

    return NextResponse.json({
      success: true,
      data: {
        hasActiveCheckin: !!activeCheckin,
        activeCheckin,
      },
    });
  } catch (error) {
    console.error('Get checkin error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create new check-in
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

    const { client_id, latitude, longitude, notes } = await request.json();

    // Input validation with meaningful error messages
    if (!client_id) {
      return NextResponse.json(
        { success: false, message: 'Please select a client before checking in' },
        { status: 400 }
      );
    }

    if (typeof client_id !== 'number' || client_id < 1) {
      return NextResponse.json(
        { success: false, message: 'Invalid client selection' },
        { status: 400 }
      );
    }

    if (latitude !== undefined && (typeof latitude !== 'number' || latitude < -90 || latitude > 90)) {
      return NextResponse.json(
        { success: false, message: 'Invalid latitude value. Must be between -90 and 90' },
        { status: 400 }
      );
    }

    if (longitude !== undefined && (typeof longitude !== 'number' || longitude < -180 || longitude > 180)) {
      return NextResponse.json(
        { success: false, message: 'Invalid longitude value. Must be between -180 and 180' },
        { status: 400 }
      );
    }

    if (notes && typeof notes !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Notes must be a text string' },
        { status: 400 }
      );
    }

    if (notes && notes.length > 500) {
      return NextResponse.json(
        { success: false, message: 'Notes cannot exceed 500 characters' },
        { status: 400 }
      );
    }

    // Check for active check-in
    const activeCheckin = db.getActiveCheckin(user.id);
    if (activeCheckin) {
      return NextResponse.json(
        { success: false, message: 'You already have an active check-in. Please checkout first.' },
        { status: 400 }
      );
    }

    // Verify client exists
    const client = db.getClientById(client_id);
    if (!client) {
      return NextResponse.json(
        { success: false, message: 'Selected client does not exist' },
        { status: 400 }
      );
    }

    // Calculate distance from client
    let distanceFromClient: number | null = null;
    let distanceWarning: string | null = null;

    if (latitude && longitude && client.latitude && client.longitude) {
      distanceFromClient = calculateDistance(
        latitude,
        longitude,
        client.latitude,
        client.longitude
      );
      distanceFromClient = Math.round(distanceFromClient * 100) / 100;

      if (distanceFromClient > 0.5) {
        distanceWarning = 'You are far from the client location';
      }
    }

    const checkin = db.createCheckin({
      employee_id: user.id,
      client_id,
      latitude: latitude || null,
      longitude: longitude || null,
      distance_from_client: distanceFromClient,
      notes: notes || null,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: checkin.id,
        message: 'Checked in successfully',
        distance_from_client: distanceFromClient,
        distance_warning: distanceWarning,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Create checkin error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
