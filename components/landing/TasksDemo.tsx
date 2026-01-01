"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Calendar, CheckCircle2, AlertCircle, Plus } from "lucide-react"
import { format, isPast, isToday } from "date-fns"
import { he } from "date-fns/locale"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useLanguage } from "@/lib/useLanguage"

export function TasksDemo() {
  const { t, language } = useLanguage()
  const dateLocale = language === 'he' ? he : undefined

  // Demo tasks data - matching the real screen structure
  const demoTasks = [
    {
      id: "1",
      title: "Job interviews for a marketing position",
      status: "DONE",
      priority: "MEDIUM",
      deadline: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000), // Jan 9
      assignees: [{ name: "AL" }, { name: "JA" }],
      subtasks: [
        { id: "1-1", title: "Review resumes", isDone: true }
      ]
    },
    {
      id: "2",
      title: "Design campaign visuals",
      status: "DONE",
      priority: "LOW",
      deadline: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // Jan 5
      assignees: [{ name: "SO" }, { name: "JA" }],
      subtasks: [
        { id: "2-1", title: "Create moodboard", isDone: true }
      ]
    },
    {
      id: "3",
      title: "Schedule post for the week",
      status: "TODO",
      priority: "MEDIUM",
      deadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // Jan 2
      assignees: [{ name: "JE" }, { name: "JA" }],
      subtasks: [
        { id: "3-1", title: "Draft captions", isDone: false },
        { id: "3-2", title: "Select images", isDone: false }
      ]
    },
    {
      id: "4",
      title: "Launch new marketing campaign",
      status: "DONE",
      priority: "HIGH",
      deadline: null,
      assignees: [{ name: "JA" }],
      subtasks: [
        { id: "4-1", title: "Initial setup", isDone: false },
        { id: "4-2", title: "Team briefing", isDone: false }
      ]
    }
  ]

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-primary text-primary-foreground border-transparent'
      case 'MEDIUM':
        return 'bg-[#4b7699] text-primary-foreground border-transparent'
      case 'LOW':
        return 'bg-[#7fa1bc] text-primary-foreground border-transparent'
      default:
        return 'bg-muted text-muted-foreground border-border'
    }
  }

  interface DemoTask {
    id: string
    title: string
    status: string
    priority: string
    deadline: Date | null
    assignees: { name: string }[]
    subtasks: { id: string, title: string, isDone: boolean }[]
  }

  const getStatusDisplay = (task: DemoTask) => {
    const isOverdue = task.deadline && isPast(new Date(task.deadline)) && !isToday(new Date(task.deadline)) && task.status !== 'DONE'

    if (task.status === 'DONE') {
      return (
        <div className="h-8 w-full max-w-[140px] mx-auto flex items-center justify-center gap-2 text-[10px] md:text-xs font-semibold text-white bg-[#00c875] rounded-md shadow-sm">
          <CheckCircle2 className="h-3 w-3 md:h-3.5 md:w-3.5" />
          <span>{t('tasks.statusDone')}</span>
        </div>
      )
    }

    if (isOverdue) {
      return (
        <div className="h-8 w-full max-w-[140px] mx-auto flex items-center justify-center gap-2 text-[10px] md:text-xs font-semibold text-white bg-[#e2445c] rounded-md shadow-sm">
          <AlertCircle className="h-3 w-3 md:h-3.5 md:w-3.5" />
          <span>{t('tasks.statusOverdue')}</span>
        </div>
      )
    }

    if (task.status === 'TODO') {
      return (
        <div className="h-8 w-full max-w-[140px] mx-auto flex items-center justify-center gap-2 text-[10px] md:text-xs font-semibold text-white bg-[#c4c4c4] rounded-md shadow-sm">
          <span>{t('tasks.statusTodo')}</span>
        </div>
      )
    }

    return (
      <div className="h-8 w-full max-w-[140px] mx-auto flex items-center justify-center gap-2 text-[10px] md:text-xs font-semibold text-white bg-[#fdab3d] rounded-md shadow-sm">
        <span>{t('tasks.statusInProgress')}</span>
      </div>
    )
  }

  return (
    <div className="w-full flex flex-col">
      {/* Header Info - Desktop Only */}
      <div className="hidden md:flex flex-row items-baseline justify-between mb-4 px-1">
        <div className="flex items-baseline gap-2">
          <h2 className="text-2xl font-bold tracking-tight">{t('tasks.title')}</h2>
          <p className="text-xs text-muted-foreground whitespace-nowrap">{t('tasks.manageTeamTasks')}</p>
        </div>
        <div className="flex items-center gap-2 scale-90 origin-right">
          <div className="h-8 px-2 rounded-md border border-input bg-background flex items-center gap-1.5 text-xs font-medium text-muted-foreground shadow-sm uppercase tracking-tight">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-filter"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
            {t('tasks.filters')}
          </div>
          <div className="h-8 px-2 rounded-md border border-input bg-background flex items-center gap-1.5 text-xs font-medium text-muted-foreground shadow-sm uppercase tracking-tight">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-up-down"><path d="m21 16-4 4-4-4" /><path d="M17 20V4" /><path d="m3 8 4-4 4 4" /><path d="M7 4v16" /></svg>
            {t('tasks.sort')}
          </div>
        </div>
      </div>

      {/* Desktop Table - No Scrollbars */}
      <div className="hidden md:block w-full overflow-hidden">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-base font-bold text-primary/80">{t('tasks.allTasksCount').replace('{count}', demoTasks.length.toString())}</h3>
        </div>
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="border-b border-border/50">
              <th className="w-[42%] h-8 px-2 text-left font-normal text-muted-foreground text-[10px] uppercase tracking-wider bg-muted/10">{t('tasks.title')}</th>
              <th className="w-[12%] h-8 px-1 text-center font-normal text-muted-foreground text-[10px] uppercase tracking-wider bg-muted/10">{t('tasks.assignedTo')}</th>
              <th className="w-[12%] h-8 px-1 text-center font-normal text-muted-foreground text-[10px] uppercase tracking-wider bg-muted/10">{t('tasks.priorityShort')}</th>
              <th className="w-[16%] h-8 px-1 text-center font-normal text-muted-foreground text-[10px] uppercase tracking-wider bg-muted/10">{t('tasks.deadline')}</th>
              <th className="w-[18%] h-8 px-1 text-center font-normal text-muted-foreground text-[10px] uppercase tracking-wider bg-muted/10">{t('tasks.status')}</th>
            </tr>
          </thead>
          <tbody>
            {demoTasks.map((task) => (
              <tr key={task.id} className="border-b border-border/20 hover:bg-muted/5 transition-colors h-14">
                {/* Title & Subtasks Info */}
                <td className="px-2 py-1.5 align-top border-r border-border/40 overflow-hidden">
                  <div className="flex items-start gap-2 h-full">
                    <Checkbox checked={task.status === 'DONE'} disabled className="rounded-md border-2 h-4 w-4 mt-0.5 shrink-0" />
                    <div className="flex flex-col min-w-0 flex-1 h-full justify-between">
                      <span className={`text-xs md:text-sm font-semibold truncate ${task.status === 'DONE' ? 'line-through text-muted-foreground/60' : ''}`}>
                        {task.title}
                      </span>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[9px] text-muted-foreground font-medium opacity-80 whitespace-nowrap overflow-hidden">{t('tasks.subtask')}</span>
                        <span className="text-[9px] text-muted-foreground opacity-60 whitespace-nowrap">• {t('tasks.subtasksDone').replace('{done}', task.subtasks.filter(s => s.isDone).length.toString()).replace('{total}', task.subtasks.length.toString())}</span>
                      </div>
                    </div>
                  </div>
                </td>

                {/* Assignees */}
                <td className="p-1 align-middle border-r border-border/40">
                  <div className="flex -space-x-1.5 justify-center">
                    {task.assignees.slice(0, 2).map((assignee, i) => (
                      <Avatar key={i} className="h-6 w-6 ring-1 ring-background bg-muted">
                        <AvatarFallback className="text-[8px] font-bold bg-[#dbe6ef] text-[#4b7699]">
                          {assignee.name}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                </td>

                {/* Priority */}
                <td className="p-1 align-middle text-center border-r border-border/40">
                  <div className={`h-6 w-11 mx-auto flex items-center justify-center text-[9px] font-bold rounded shadow-sm border ${getPriorityColor(task.priority)}`}>
                    <span className="capitalize">{task.priority.toLowerCase()}</span>
                  </div>
                </td>

                {/* Deadline */}
                <td className="p-1 align-middle text-center border-r border-border/40">
                  {task.deadline ? (
                    <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground font-medium">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(task.deadline), 'MMM d', { locale: dateLocale })}
                    </div>
                  ) : (
                    <span className="text-muted-foreground/30 text-[10px]">-</span>
                  )}
                </td>

                {/* Status */}
                <td className="p-1 align-middle text-center overflow-hidden">
                  <div className="scale-[0.8] origin-center translate-x-1 md:translate-x-0">
                    {getStatusDisplay(task)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card-Like View */}
      <div className="md:hidden space-y-3 px-1 h-full overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold tracking-tight">{t('tasks.title')}</h2>
          <Badge variant="outline" className="text-[9px] font-bold py-0 h-5 px-2">{t('tasks.totalCount').replace('{count}', demoTasks.length.toString())}</Badge>
        </div>

        {demoTasks.slice(0, 3).map((task) => (
          <div key={task.id} className="bg-card border border-border/30 rounded-lg p-3 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-2 overflow-hidden">
              <div className="flex items-start gap-2 w-full overflow-hidden">
                <Checkbox checked={task.status === 'DONE'} disabled className="mt-1 rounded-md h-4 w-4 shrink-0" />
                <div className="space-y-1 flex-1 min-w-0">
                  <h3 className={`text-[13px] font-bold leading-tight truncate ${task.status === 'DONE' ? 'line-through text-muted-foreground opacity-60' : ''}`}>
                    {task.title}
                  </h3>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground overflow-hidden">
                    <span className="flex items-center gap-1 whitespace-nowrap bg-muted/30 px-1.5 py-0.5 rounded-sm">
                      <Calendar className="h-2.5 w-2.5" />
                      {task.deadline ? format(new Date(task.deadline), 'MMM d', { locale: dateLocale }) : '-'}
                    </span>
                    <span className="opacity-70 truncate">{t('tasks.subtasksDone').replace('{done}', task.subtasks.filter(s => s.isDone).length.toString()).replace('{total}', task.subtasks.length.toString())}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/30">
              <div className="flex -space-x-1.5">
                {task.assignees.map((assignee, i) => (
                  <Avatar key={i} className="h-6 w-6 ring-1 ring-background bg-muted">
                    <AvatarFallback className="text-[8px] font-bold bg-[#dbe6ef] text-[#4b7699]">
                      {assignee.name}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <div className="flex items-center gap-1.5 overflow-hidden">
                <Badge className={`text-[9px] h-5 px-1.5 font-extrabold shadow-sm ${getPriorityColor(task.priority)}`}>
                  {task.priority[0]}
                </Badge>
                <div className="scale-[0.8] origin-right translate-x-1">
                  {getStatusDisplay(task)}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Placeholder for Add Task on Mobile */}
        <div className="border border-dashed border-border/40 rounded-lg p-3 flex items-center justify-center gap-2 text-muted-foreground/30 bg-muted/5">
          <Plus className="h-3 w-3" />
          <span className="text-[10px] font-bold uppercase tracking-wider">{t('tasks.addTask')}</span>
        </div>
      </div>
    </div>
  )
}
