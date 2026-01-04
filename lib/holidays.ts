"use server"

import Holidays from 'date-holidays'

export interface CalendarEvent {
    id: string;
    title: string;
    startTime: Date;
    endTime: Date;
    allDay: boolean;
    isHoliday?: boolean;
    color?: string; // For custom styling
    type?: string;
}

export async function getIsraelHolidays(year: number): Promise<CalendarEvent[]> {
    console.log(`[Holidays] Fetching for year ${year}`)
    const hd = new Holidays('IL')
    const holidays = hd.getHolidays(year)
    console.log(`[Holidays] Found ${holidays.length} raw holidays`)

    return holidays.map(h => {
        return {
            id: `holiday-${h.date}-${h.name}`, // Unique ID
            title: h.name,
            startTime: new Date(h.start),
            endTime: new Date(h.end),
            allDay: true,
            isHoliday: true,
            color: '#FEF08A', // light yellow (yellow-200)
            type: h.type
        }
    })
}

export async function getHolidaysForRange(start: Date, end: Date): Promise<CalendarEvent[]> {
    const startYear = start.getFullYear()
    const endYear = end.getFullYear()

    let events: CalendarEvent[] = await getIsraelHolidays(startYear)

    if (endYear > startYear) {
        const nextYearEvents = await getIsraelHolidays(endYear)
        events = [...events, ...nextYearEvents]
    }

    // Filter to strictly within range (optional, but good for performance if years are huge, though usually just filtering by view happens in UI)
    // Actually, simple year fetching is enough, the calendar view filters what it shows or we can just return all for the years involved.

    // Filter to strictly within range
    const filtered = events.filter(e => e.startTime >= start && e.endTime <= end)
    console.log(`[Holidays] Returning ${filtered.length} holidays for range ${start.toISOString()} - ${end.toISOString()}`)
    return filtered
}
