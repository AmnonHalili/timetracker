"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "lucide-react"
import { format } from "date-fns"

export function TasksDemo() {
  // Demo tasks data - matching the real screen structure
  const demoTasks = [
    {
      id: "1",
      title: "Design Landing Page",
      status: "IN_PROGRESS",
      priority: "HIGH",
      deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      assignees: [{ name: "Sarah Johnson" }],
      inProgressBy: "Sarah Johnson",
      subtasks: [
        { id: "1-1", title: "Create wireframes", isDone: true },
        { id: "1-2", title: "Design mockups", isDone: false }
      ]
    },
    {
      id: "2",
      title: "Implement User Authentication",
      status: "TODO",
      priority: "MEDIUM",
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      assignees: [{ name: "Mike Chen" }, { name: "Emily Davis" }],
      subtasks: [
        { id: "2-1", title: "Setup OAuth", isDone: false },
        { id: "2-2", title: "Create login page", isDone: false }
      ]
    },
    {
      id: "3",
      title: "Write API Documentation",
      status: "DONE",
      priority: "LOW",
      deadline: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      assignees: [{ name: "Alex Brown" }],
      subtasks: []
    }
  ]

  // Priority colors matching the theme - using primary color with different opacities
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "HIGH":
        return "bg-primary hover:bg-primary text-primary-foreground"
      case "MEDIUM":
        return "bg-primary/80 hover:bg-primary/80 text-primary-foreground"
      case "LOW":
        return "bg-primary/60 hover:bg-primary/60 text-primary-foreground"
      default:
        return "bg-primary/60 hover:bg-primary/60 text-primary-foreground"
    }
  }

  return (
    <div className="w-full space-y-4 bg-background">
      {demoTasks.map((task) => (
        <div key={task.id} className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-4 last:border-0 last:pb-0 gap-4">
          <div className="flex items-start gap-3 flex-1 group">
            <Checkbox
              checked={task.status === "DONE"}
              disabled
              className="mt-1"
            />
            <div className="space-y-1 flex-1">
              {/* Task Title */}
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${task.status === "DONE" ? "line-through text-muted-foreground" : ""}`}>
                  {task.title}
                </span>
              </div>

              {/* Assign To */}
              {task.assignees && task.assignees.length > 0 && (
                <div className="pl-1">
                  <span className="text-xs text-muted-foreground">
                    Assigned to: {task.assignees.map(a => a.name).join(", ")}
                  </span>
                </div>
              )}

              {/* Status: To Do / In Progress */}
              <div className="pl-1">
                <span className="text-xs text-muted-foreground">
                  Status: {task.status === "DONE" 
                    ? "Done" 
                    : task.inProgressBy
                      ? `In Progress by ${task.inProgressBy}`
                      : "To Do"}
                </span>
              </div>

              {/* Deadline */}
              {task.deadline && (
                <div className="flex items-center gap-4 text-xs text-muted-foreground pl-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(task.deadline), "dd/MM/yyyy")}
                  </span>
                </div>
              )}

              {/* Subtasks Display - Under task title with border-left */}
              {task.subtasks && task.subtasks.length > 0 && (
                <div className="pl-3 mt-2 space-y-1.5 border-l-2 border-muted/50">
                  {task.subtasks.map((subtask) => (
                    <div key={subtask.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={subtask.isDone}
                        disabled
                        className="h-4 w-4"
                      />
                      <span className={`text-xs flex-1 ${subtask.isDone ? "line-through text-muted-foreground opacity-70" : "text-muted-foreground"}`}>
                        {subtask.title}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Priority Badge on the right */}
          <div className="flex items-center gap-2">
            <Badge className={`text-xs ${getPriorityColor(task.priority)}`}>
              {task.priority}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  )
}

