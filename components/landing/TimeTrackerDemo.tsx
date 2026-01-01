"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Pause, Square, Clock, CheckCircle2 } from "lucide-react"

export function TimeTrackerDemo() {
  // Demo data - simulating an active timer
  const demoTime = "02:34:15"
  const demoTask = "tasks..."
  const demoDescription = "What are you working on?"
  const demoStartTime = "09:15"

  // Demo history entries
  const demoEntries = [
    {
      id: "1",
      task: "Backend API",
      time: "01:45:30",
      range: "08:00 - 09:45",
      date: "Today"
    },
    {
      id: "2",
      task: "Code Review",
      time: "00:30:00",
      range: "14:00 - 14:30",
      date: "Today"
    }
  ]

  return (
    <div className="w-full space-y-4">
      {/* Control Bar Demo */}
      <Card className="border-2 border-primary/50 shadow-md">
        <CardContent className="p-4 space-y-4">
          {/* Timer Display */}
          <div className="flex items-center justify-between">
            <div className="font-mono text-3xl font-bold text-primary tabular-nums tracking-wider">
              {demoTime}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Started at {demoStartTime}</span>
            </div>
          </div>

          {/* Task Selection */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Select defaultValue="task-1" disabled>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select task" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="task-1">{demoTask}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-9 border-primary/30 bg-white text-muted-foreground hover:bg-white hover:text-muted-foreground"
                disabled
              >
                <Pause className="h-4 w-4 mr-2 text-muted-foreground" />
                Pause
              </Button>
              <Button
                size="sm"
                className="h-9 bg-primary text-primary-foreground hover:bg-primary/90"
                disabled
              >
                <Square className="h-4 w-4 mr-2" />
                Stop
              </Button>
            </div>
          </div>

          {/* Description */}
          <Input
            value={demoDescription}
            placeholder="Add description..."
            className="h-9 text-sm"
            disabled
          />
        </CardContent>
      </Card>

      {/* History Entries Demo */}
      <div className="space-y-3">
        <div className="text-sm font-semibold text-muted-foreground px-1">
          Recent Entries
        </div>
        {demoEntries.map((entry) => (
          <Card key={entry.id} className="border shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    <span className="font-medium text-sm truncate">{entry.task}</span>
                  </div>
                  <div className="text-xs text-muted-foreground ml-6">
                    {entry.range}
                  </div>
                </div>
                <div className="font-mono text-sm font-semibold text-primary ml-4">
                  {entry.time}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

