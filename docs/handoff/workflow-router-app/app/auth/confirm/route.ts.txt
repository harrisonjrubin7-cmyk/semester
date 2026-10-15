import { type EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get('token_hash'); const type = url.searchParams.get('type') as EmailOtpType | null;
  const next = url.searchParams.get('next')?.startsWith('/') ? url.searchParams.get('next')! : '/workflow-router';
  if (token_hash && type) { const supabase = await createClient(); const { error } = await supabase.auth.verifyOtp({ type, token_hash }); if (!error) return NextResponse.redirect(new URL(next, url.origin)); }
  return NextResponse.redirect(new URL('/auth/sign-in?error=link', url.origin));
}
