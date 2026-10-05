// Next.js 15: middleware.ts. On Next.js 16+, rename to proxy.ts and export `proxy` instead.
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
export async function middleware(request: NextRequest) { return updateSession(request); }
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'] };
