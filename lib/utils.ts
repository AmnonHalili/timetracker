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

/**
 * Format time as 24-hour format with AM/PM suffix (e.g., "15:00 pm", "03:00 am")
 * @param date - Date object to format
 * @returns Formatted string like "15:00 pm" or "03:00 am"
 */
export function formatTimeWithAMPM(date: Date): string {
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const isPM = hours >= 12
  const period = isPM ? 'pm' : 'am'
  
  // Format as HH:mm with am/pm suffix (with space)
  const formattedHours = hours.toString().padStart(2, '0')
  const formattedMinutes = minutes.toString().padStart(2, '0')
  
  return `${formattedHours}:${formattedMinutes} ${period}`
}

/**
 * Stops the active timer if one is running
 * This is used before logout or when leaving the site to ensure time entries are saved
 * @param keepalive - If true, uses fetch with keepalive for beforeunload events
 * @returns Promise that resolves to true if timer was stopped, false if no active timer
 */
export async function stopActiveTimer(keepalive = false): Promise<boolean> {
  try {
    // Check if there's an active timer
    const response = await fetch('/api/time-entries', { keepalive })
    if (!response.ok) {
      return false
    }
    
    const data = await response.json()
    const activeEntry = data.activeEntry
    
    // If there's an active timer, stop it
    if (activeEntry) {
      await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
        keepalive // Use keepalive to ensure request completes even if page unloads
      })
      return true
    }
    
    return false
  } catch (error) {
    console.error('Failed to stop active timer:', error)
    return false
  }
}

/**
 * Stops active timer for beforeunload events
 * Uses keepalive flag to ensure the request completes even if page unloads
 * This is fire-and-forget - we don't check if timer exists, just try to stop it
 */
export function stopActiveTimerOnUnload(): void {
  if (typeof window === 'undefined') return
  
  try {
    // Try to stop the timer - API will handle gracefully if no active timer exists
    // Use keepalive to ensure the request completes even if the page unloads
    fetch('/api/time-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stop' }),
      keepalive: true // Critical: ensures request completes even if page unloads
    }).catch(() => {
      // Silently fail - we don't want to block page unload
    })
  } catch (error) {
    // Silently fail - we don't want to block page unload
  }
}