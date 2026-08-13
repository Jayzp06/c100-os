import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Convert a 24-hour time string (e.g. "18:00" or "18:00:00") to 12-hour
 * display format (e.g. "6:00 PM").  Handles both HH:MM and HH:MM:SS.
 */
export function formatTime12h(time: string): string {
  const [hourStr, minStr] = time.split(":");
  const hour = parseInt(hourStr ?? "0", 10);
  const min = minStr ?? "00";
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${min} ${period}`;
}
