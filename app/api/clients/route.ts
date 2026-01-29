import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// GET - Get all clients
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

    const clients = db.getClients();

    return NextResponse.json({
      success: true,
      data: clients,
    });
  } catch (error) {
    console.error('Get clients error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create new client (managers only)
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

    // Only managers can add clients
    if (user.role !== 'manager') {
      return NextResponse.json(
        { success: false, message: 'Only managers can add new clients' },
        { status: 403 }
      );
    }

    const { name, address, latitude, longitude, contact_person, contact_phone } = await request.json();

    // Input validation with meaningful error messages
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: 'Client name is required' },
        { status: 400 }
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        { success: false, message: 'Client name cannot exceed 100 characters' },
        { status: 400 }
      );
    }

    if (!address || typeof address !== 'string' || address.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: 'Client address is required' },
        { status: 400 }
      );
    }

    if (address.length > 255) {
      return NextResponse.json(
        { success: false, message: 'Address cannot exceed 255 characters' },
        { status: 400 }
      );
    }

    if (latitude !== undefined && latitude !== null) {
      if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
        return NextResponse.json(
          { success: false, message: 'Invalid latitude value. Must be between -90 and 90' },
          { status: 400 }
        );
      }
    }

    if (longitude !== undefined && longitude !== null) {
      if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
        return NextResponse.json(
          { success: false, message: 'Invalid longitude value. Must be between -180 and 180' },
          { status: 400 }
        );
      }
    }

    if (contact_person && typeof contact_person !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Contact person must be a text string' },
        { status: 400 }
      );
    }

    if (contact_phone && typeof contact_phone !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Contact phone must be a text string' },
        { status: 400 }
      );
    }

    const client = db.createClient({
      name: name.trim(),
      address: address.trim(),
      latitude: latitude || null,
      longitude: longitude || null,
      contact_person: contact_person?.trim() || null,
      contact_phone: contact_phone?.trim() || null,
    });

    return NextResponse.json({
      success: true,
      data: client,
      message: 'Client created successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Create client error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
