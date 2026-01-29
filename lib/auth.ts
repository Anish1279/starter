import { db, User } from './db';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || 'unolo-secret-key-2024';

// Simple token management using cookies
export async function createToken(user: User): Promise<string> {
  // Create a simple base64 encoded token
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export async function verifyToken(token: string): Promise<{ id: number; email: string; role: string; name: string } | null> {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    if (payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  
  if (!token) {
    return null;
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return null;
  }

  return db.users.findById(payload.id) || null;
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete('auth-token');
}

// Input validation functions
export function validateEmail(email: string): { valid: boolean; message?: string } {
  if (!email) {
    return { valid: false, message: 'Email is required' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, message: 'Please enter a valid email address' };
  }
  return { valid: true };
}

export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (!password) {
    return { valid: false, message: 'Password is required' };
  }
  if (password.length < 6) {
    return { valid: false, message: 'Password must be at least 6 characters long' };
  }
  return { valid: true };
}

export function validateClientData(data: { name?: string; address?: string; latitude?: number; longitude?: number }): { valid: boolean; message?: string } {
  if (!data.name || data.name.trim().length < 2) {
    return { valid: false, message: 'Client name must be at least 2 characters' };
  }
  if (!data.address || data.address.trim().length < 5) {
    return { valid: false, message: 'Address must be at least 5 characters' };
  }
  if (data.latitude !== undefined && (data.latitude < -90 || data.latitude > 90)) {
    return { valid: false, message: 'Latitude must be between -90 and 90' };
  }
  if (data.longitude !== undefined && (data.longitude < -180 || data.longitude > 180)) {
    return { valid: false, message: 'Longitude must be between -180 and 180' };
  }
  return { valid: true };
}

export function validateCheckinData(data: { client_id?: number; latitude?: number; longitude?: number }): { valid: boolean; message?: string } {
  if (!data.client_id) {
    return { valid: false, message: 'Please select a client' };
  }
  if (data.latitude === undefined || data.longitude === undefined) {
    return { valid: false, message: 'Location is required for check-in. Please enable location services.' };
  }
  return { valid: true };
}
