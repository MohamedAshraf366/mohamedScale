import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================================
// Date Formatting
// ============================================================

export function fmtDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return format(new Date(iso), 'dd MMM yyyy');
  } catch {
    return iso;
  }
}

export function fmtDateTime(iso: string | null) {
  if (!iso) return '—';
  try {
    return format(new Date(iso), 'dd MMM yyyy HH:mm');
  } catch {
    return iso;
  }
}

// ============================================================
// Currency Formatting
// ============================================================

export function fmtCurrency(n: number | null, cur = 'SAR') {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-SA', { style: 'currency', currency: cur, minimumFractionDigits: 0 }).format(n);
}

export function fmtNumber(n: number | null, digits = 0) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-SA', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

// ============================================================
// Time Ago Formatting
// ============================================================

export function fmtAgo(iso: string | null) {
  if (!iso) return '—';
  try {
    const diff = Math.floor((new Date().getTime() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return `${diff} seconds ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
    return format(new Date(iso), 'dd MMM yyyy');
  } catch {
    return iso;
  }
}

// ============================================================
// Gate Event Logger
// ============================================================

export async function logGateEvent(orderId: string, gateKey: string, payload?: any, notes?: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('order_gate_events').insert({
      order_id: orderId,
      gate_key: gateKey,
      actor_id: user?.id,
      acted_at: new Date().toISOString(),
      payload: payload || {},
      notes: notes || null,
    });
    if (error) {
      console.error('Failed to log gate event:', error);
    } else {
      console.log(`✅ Gate event logged: ${gateKey}`);
    }
  } catch (err) {
    console.error('Error logging gate event:', err);
  }
}

// ============================================================
// Phone Number Formatting
// ============================================================

export function formatPhoneNumber(phone: string | null) {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('966')) {
    return cleaned.replace(/(966)(5)(\d{8})/, '+$1 $2 $3');
  }
  if (cleaned.startsWith('05')) {
    return cleaned.replace(/(05)(\d{8})/, '$1 $2');
  }
  return phone;
}

// ============================================================
// Truncate Text
// ============================================================

export function truncate(str: string | null, length: number = 50) {
  if (!str) return '';
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}