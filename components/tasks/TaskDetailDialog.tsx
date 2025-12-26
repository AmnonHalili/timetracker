"use client"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Trash2, Plus, Calendar, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
import { format } from "date-fns"
import { useRouter } from "next/navigation"

interface ChecklistItem {
    id: string
    text: string
    isDone: boolean
}

interface Subtask {
    id: string
    title: string
    isDone: boolean
}

interface TaskDetailDialogProps {
    task: {
        id: string
        title: string
        status: string
        priority: string
        deadline: Date | string | null
        description: string | null
        assignees: Array<{ id: string; name: string | null }>
        checklist?: ChecklistItem[]
        subtasks?: Subtask[]
    } | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function TaskDetailDialog({ task, open, onOpenChange }: TaskDetailDialogProps) {
    const [checklist, setChecklist] = useState<ChecklistItem[]>([])
    const [subtasks, setSubtasks] = useState<Subtask[]>([])
    const [newItemText, setNewItemText] = useState("")
    const [newSubtaskTitle, setNewSubtaskTitle] = useState("")
    const [adding, setAdding] = useState(false)
    const [addingSubtask, setAddingSubtask] = useState(false)
    const router = useRouter()

    useEffect(() => {
        if (task) {
            if (task.checklist) {
                setChecklist(task.checklist)
            } else {
                setChecklist([])
            }
            if (task.subtasks) {
                setSubtasks(task.subtasks)
            } else {
                setSubtasks([])
            }
        }
    }, [task])

    if (!task) return null

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newItemText.trim()) return

        setAdding(true)
        try {
            const res = await fetch("/api/tasks/checklist", {
                method: "POST",
                body: JSON.stringify({ taskId: task.id, text: newItemText }),
            })
            const newItem = await res.json()
            setChecklist([...checklist, newItem])
            setNewItemText("")
            router.refresh()
        } catch {
            console.error("Failed to add item")
        } finally {
            setAdding(false)
        }
    }

    const toggleItem = async (id: string, isDone: boolean) => {
        setChecklist(checklist.map(item => item.id === id ? { ...item, isDone } : item))
        try {
            await fetch("/api/tasks/checklist", {
                method: "PATCH",
                body: JSON.stringify({ id, isDone }),
            })
            router.refresh()
        } catch {
            console.error("Failed to toggle item")
        }
    }

    const deleteItem = async (id: string) => {
        setChecklist(checklist.filter(item => item.id !== id))
        try {
            await fetch(`/api/tasks/checklist?id=${id}`, { method: "DELETE" })
            router.refresh()
        } catch {
            console.error("Failed to delete item")
        }
    }

    const getPriorityColor = (p: string) => {
        switch (p) {
            case 'URGENT': return 'bg-red-600'
            case 'HIGH': return 'bg-orange-500'
            case 'MEDIUM': return 'bg-blue-500'
            case 'LOW': return 'bg-slate-500'
            default: return 'bg-slate-500'
        }
    }

    const completedCount = checklist.filter(i => i.isDone).length
    const progress = checklist.length > 0 ? Math.round((completedCount / checklist.length) * 100) : 0

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center gap-3 pr-8">
                        <DialogTitle className="text-xl">{task.title}</DialogTitle>
                        <Badge className={`${getPriorityColor(task.priority)}`}>{task.priority}</Badge>
                        <Badge variant="outline">{task.status.replace('_', ' ')}</Badge>
                    </div>
                    {task.description && (
                        <DialogDescription className="text-base pt-2">
                            {task.description}
                        </DialogDescription>
                    )}
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    {/* Meta Info */}
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground border-b pb-4">
                        {task.deadline && (
                            <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                <span>Due: {format(new Date(task.deadline), "PPP")}</span>
                            </div>
                        )}
                        {task.assignees.length > 0 && (
                            <div className="flex items-center gap-1">
                                <span className="font-semibold">Assignees:</span>
                                <span>{task.assignees.map(a => a.name).join(", ")}</span>
                            </div>
                        )}
                    </div>

                    {/* Tabs for Checklist and Subtasks */}
                    <Tabs defaultValue="checklist" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="checklist">
                                Checklist
                                {checklist.length > 0 && (
                                    <Badge variant="secondary" className="ml-2 rounded-full px-1.5 text-xs">
                                        {completedCount}/{checklist.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="subtasks">
                                Subtasks
                                {subtasks.length > 0 && (
                                    <Badge variant="secondary" className="ml-2 rounded-full px-1.5 text-xs">
                                        {subtasks.filter(s => s.isDone).length}/{subtasks.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                        </TabsList>

                        {/* Checklist Tab */}
                        <TabsContent value="checklist" className="space-y-4 mt-4">
                            {checklist.length > 0 && (
                                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary transition-all duration-300"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                {checklist.map(item => (
                                    <div key={item.id} className="flex items-start gap-3 group bg-muted/20 p-2 rounded-md hover:bg-muted/40 transition-colors">
                                        <Checkbox
                                            checked={item.isDone}
                                            onCheckedChange={(checked) => toggleItem(item.id, checked as boolean)}
                                            className="mt-1"
                                        />
                                        <span className={`flex-1 text-sm ${item.isDone ? "line-through text-muted-foreground opacity-70" : ""}`}>
                                            {item.text}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                            onClick={() => deleteItem(item.id)}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>

                            <form onSubmit={handleAddItem} className="flex items-center gap-2 mt-2">
                                <Plus className="h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Add an item..."
                                    value={newItemText}
                                    onChange={(e) => setNewItemText(e.target.value)}
                                    className="flex-1 h-9 bg-transparent border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                                />
                                <Button type="submit" size="sm" variant="ghost" disabled={adding || !newItemText.trim()}>
                                    {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                                </Button>
                            </form>
                        </TabsContent>

                        {/* Subtasks Tab */}
                        <TabsContent value="subtasks" className="space-y-4 mt-4">
                            <div className="space-y-2">
                                {subtasks.map(subtask => (
                                    <div key={subtask.id} className="flex items-start gap-3 group bg-muted/20 p-2 rounded-md hover:bg-muted/40 transition-colors">
                                        <Checkbox
                                            checked={subtask.isDone}
                                            onCheckedChange={async (checked) => {
                                                const newSubtasks = subtasks.map(s => 
                                                    s.id === subtask.id 
                                                        ? { ...s, isDone: checked as boolean }
                                                        : s
                                                )
                                                setSubtasks(newSubtasks)
                                                try {
                                                    await fetch("/api/tasks/subtasks", {
                                                        method: "PATCH",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify({ id: subtask.id, isDone: checked })
                                                    })
                                                    router.refresh()
                                                } catch {
                                                    console.error("Failed to toggle subtask")
                                                    // Revert on error
                                                    setSubtasks(subtasks)
                                                }
                                            }}
                                            className="mt-1"
                                        />
                                        <span className={`flex-1 text-sm ${subtask.isDone ? "line-through text-muted-foreground opacity-70" : ""}`}>
                                            {subtask.title}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                            onClick={async () => {
                                                setSubtasks(subtasks.filter(s => s.id !== subtask.id))
                                                try {
                                                    await fetch(`/api/tasks/subtasks?id=${subtask.id}`, { method: "DELETE" })
                                                    router.refresh()
                                                } catch {
                                                    console.error("Failed to delete subtask")
                                                    setSubtasks(subtasks)
                                                }
                                            }}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>

                            <form onSubmit={async (e) => {
                                e.preventDefault()
                                if (!newSubtaskTitle.trim() || !task) return

                                setAddingSubtask(true)
                                try {
                                    const res = await fetch("/api/tasks/subtasks", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ taskId: task.id, title: newSubtaskTitle.trim() })
                                    })
                                    const newSubtask = await res.json()
                                    setSubtasks([...subtasks, newSubtask])
                                    setNewSubtaskTitle("")
                                    router.refresh()
                                } catch {
                                    console.error("Failed to add subtask")
                                } finally {
                                    setAddingSubtask(false)
                                }
                            }} className="flex items-center gap-2 mt-2">
                                <Plus className="h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Add a subtask..."
                                    value={newSubtaskTitle}
                                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                    className="flex-1 h-9 bg-transparent border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                                />
                                <Button type="submit" size="sm" variant="ghost" disabled={addingSubtask || !newSubtaskTitle.trim()}>
                                    {addingSubtask ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                                </Button>
                            </form>
                        </TabsContent>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    )
}
