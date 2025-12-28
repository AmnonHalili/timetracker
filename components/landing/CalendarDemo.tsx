"use client"

import { Card } from "@/components/ui/card"
import { cn, formatHoursMinutes } from "@/lib/utils"
import { format, isSameHour, eachHourOfInterval, isSameDay } from "date-fns"
import { useState } from "react"

export function CalendarDemo() {
  // Demo data - simulating a calendar month view (simplified - showing first week)
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  
  // Selected day state - starts with day 10 (today)
  const [selectedDayIndex, setSelectedDayIndex] = useState(3) // Day 10 (index 3)
  
  // Assume daily target is 6 hours for demo
  const dailyTarget = 6
  
  const demoDays = [
    { 
      date: new Date(2024, 0, 7), 
      day: 7, 
      isCurrentMonth: true, 
      tasks: [
        { title: "Review Design", priority: "HIGH" },
        { title: "Update UI", priority: "MEDIUM" }
      ], 
      hours: 4.5,
    },
    { 
      date: new Date(2024, 0, 8), 
      day: 8, 
      isCurrentMonth: true, 
      tasks: [{ title: "Update Docs", priority: "MEDIUM" }], 
      hours: 6.0,
    },
    { 
      date: new Date(2024, 0, 9), 
      day: 9, 
      isCurrentMonth: true, 
      tasks: [], 
      hours: 5.5,
    },
    { 
      date: new Date(2024, 0, 10), 
      day: 10, 
      isCurrentMonth: true, 
      tasks: [{ title: "Code Review", priority: "MEDIUM" }, { title: "Bug Fix", priority: "HIGH" }], 
      hours: 7.0,
    },
    { 
      date: new Date(2024, 0, 11), 
      day: 11, 
      isCurrentMonth: true, 
      tasks: [{ title: "Deploy App", priority: "HIGH" }], 
      hours: 4.0,
    },
    { 
      date: new Date(2024, 0, 12), 
      day: 12, 
      isCurrentMonth: true, 
      tasks: [], 
      hours: 3.5,
    },
    { 
      date: new Date(2024, 0, 13), 
      day: 13, 
      isCurrentMonth: true, 
      tasks: [], 
      hours: 0,
    },
  ]

  // Get selected day data
  const selectedDayData = demoDays[selectedDayIndex]
  const selectedDate = selectedDayData.date
  
  const dayStart = new Date(selectedDate)
  dayStart.setHours(6, 0, 0, 0)
  const dayEnd = new Date(selectedDate)
  dayEnd.setHours(23, 0, 0, 0)
  const hours = eachHourOfInterval({ start: dayStart, end: dayEnd })

  // Convert tasks from month view to day events - only show tasks from the selected day
  const dayEvents = selectedDayData.tasks.map((task, idx) => {
    // Distribute tasks across different hours starting from 9 AM
    const hour = 9 + (idx * 2)
    return {
      hour: hour,
      title: task.title,
      type: "TASK_TIME" as const,
      duration: 1,
      priority: task.priority // Keep priority for color matching
    }
  })

  const eventTypeColors: Record<string, string> = {
    MEETING: "bg-blue-50 border-blue-200 text-blue-700",
    APPOINTMENT: "bg-purple-50 border-purple-200 text-purple-700",
    TASK_TIME: "bg-green-50 border-green-200 text-green-700",
    BREAK: "bg-gray-50 border-gray-200 text-gray-700",
    PERSONAL: "bg-pink-50 border-pink-200 text-pink-700",
    OTHER: "bg-orange-50 border-orange-200 text-orange-700",
  }

  const priorityColors: Record<string, string> = {
    HIGH: "bg-pink-700 text-white",
    MEDIUM: "bg-pink-500 text-white",
    LOW: "bg-pink-300 text-white",
  }

  return (
    <div className="w-full space-y-4 bg-background">
      {/* Month View - Top Section */}
      <div className="space-y-2">
        {/* Week Days Header */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {weekDays.map((day) => (
            <div key={day} className="text-[10px] font-medium text-muted-foreground uppercase py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {demoDays.map((dayData, index) => {
            const isSelected = index === selectedDayIndex
            const isCurrentMonthDay = dayData.isCurrentMonth

            return (
              <Card
                key={index}
                onClick={() => setSelectedDayIndex(index)}
                className={cn(
                  "min-h-[100px] p-1.5 flex flex-col justify-between transition-colors overflow-hidden cursor-pointer",
                  !isCurrentMonthDay && "bg-muted/10 text-muted-foreground",
                  isSelected && "border-primary shadow-sm ring-2 ring-primary/20"
                )}
              >
                <div className="flex justify-between items-start">
                  <span className={cn(
                    "text-xs font-semibold h-5 w-5 flex items-center justify-center rounded-full",
                    isSelected && "bg-primary text-primary-foreground"
                  )}>
                    {dayData.day}
                  </span>
                  {dayData.hours !== undefined && dayData.hours > 0 && (
                    <span className={cn(
                      "text-[9px] font-bold px-1 py-0.5 rounded",
                      dayData.hours >= dailyTarget ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                    )}>
                      {formatHoursMinutes(dayData.hours)}
                    </span>
                  )}
                </div>

                <div className="space-y-1 mt-3 flex-1 overflow-y-auto">
                  {/* Tasks - Show all (only pink tasks) */}
                  {dayData.tasks.map((task, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "text-[9px] px-1 py-0.5 rounded truncate",
                        priorityColors[task.priority] || priorityColors.MEDIUM
                      )}
                      title={task.title}
                    >
                      {task.title}
                    </div>
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Day View - Bottom Section */}
      <div className="space-y-2 border-t pt-3">
        <h4 className="text-xs font-medium text-muted-foreground">
          {format(selectedDate, "EEEE, MMMM d")}
        </h4>
        
        {/* Timeline */}
        <div className="border rounded-lg bg-background overflow-hidden max-h-[200px] overflow-y-auto">
          {hours.slice(0, 12).map((hour) => {
            const hourEvents = dayEvents.filter(e => e.hour === hour.getHours())
            const isCurrentHour = isSameHour(hour, new Date())

            return (
              <div
                key={hour.toISOString()}
                className={cn(
                  "grid grid-cols-[50px_1fr] border-b last:border-b-0 min-h-[40px]",
                  isCurrentHour && "bg-primary/5"
                )}
              >
                {/* Time label */}
                <div className="p-1.5 text-[10px] font-medium text-muted-foreground border-r flex items-center justify-center whitespace-nowrap">
                  {format(hour, 'HH:mm')}
                </div>

                {/* Events for this hour */}
                <div className="p-1.5 relative">
                  {hourEvents.length > 0 ? (
                    <div className="space-y-1">
                      {hourEvents.map((event, idx) => {
                        // Use priority color for tasks (pink), otherwise use event type color
                        const colorClass = event.priority 
                          ? (priorityColors[event.priority] || priorityColors.MEDIUM)
                          : (eventTypeColors[event.type] || eventTypeColors.OTHER)
                        
                        return (
                          <div
                            key={idx}
                            className={cn(
                              "text-[9px] px-1.5 py-0.5 rounded truncate",
                              event.priority ? "" : "border", // No border for priority colors (tasks)
                              colorClass
                            )}
                            title={event.title}
                          >
                            {event.title}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="h-full flex items-center">
                      <span className="text-[9px] text-muted-foreground opacity-50">—</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

