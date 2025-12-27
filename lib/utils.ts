import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format hours to display as hours and minutes, or just minutes if less than 1 hour
 * @param hours - Number of hours (can be decimal, e.g., 2.5)
 * @returns Formatted string like "2h 30m" or "45m"
 */
export function formatHoursMinutes(hours: number): string {
  if (hours <= 0) return "-"
  
  const totalMinutes = Math.round(hours * 60)
  
  if (totalMinutes < 60) {
    // Less than 1 hour - show only minutes
    return `${totalMinutes}m`
  }
  
  // 1 hour or more - show hours and minutes
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  
  if (m === 0) {
    return `${h}h`
  }
  
  return `${h}h ${m}m`
}