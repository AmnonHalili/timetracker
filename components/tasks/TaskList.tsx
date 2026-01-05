"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useLanguage } from "@/lib/useLanguage"
import { toast } from "sonner"

interface TaskListProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tasks: Array<{
        id: string;
        title: string;
        isCompleted: boolean;
        assignees: Array<{ name: string | null; email: string }>;
    }>
    isAdmin: boolean
}

export function TaskList({ tasks, isAdmin }: TaskListProps) {
    const router = useRouter()
    const { t } = useLanguage()
    const [loadingId, setLoadingId] = useState<string | null>(null)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [taskToDelete, setTaskToDelete] = useState<string | null>(null)

    const handleToggle = async (id: string, currentStatus: boolean) => {
        setLoadingId(id)
        await fetch("/api/tasks", {
            method: "PATCH",
            body: JSON.stringify({ id, isCompleted: !currentStatus }),
        })
        router.refresh()
        setLoadingId(null)
    }

    const handleDelete = (id: string) => {
        setTaskToDelete(id)
        setDeleteDialogOpen(true)
    }

    const confirmDelete = async () => {
        if (!taskToDelete) return

        const id = taskToDelete
        setDeleteDialogOpen(false)

        try {
            const res = await fetch(`/api/tasks?id=${id}`, { method: "DELETE" })
            if (!res.ok) {
                throw new Error(t('tasks.deleteError') || "Failed to delete task")
            }
            router.refresh()
            setTaskToDelete(null)
        } catch (error) {
            console.error("Failed to delete task:", error)
            toast.error(error instanceof Error ? error.message : (t('tasks.deleteError') || "Failed to delete task"))
            setTaskToDelete(null)
        }
    }

    if (tasks.length === 0) {
        return <p className="text-sm text-muted-foreground italic">No tasks found.</p>
    }

    return (
        <div className="space-y-4">
            {tasks.map((task) => (
                <div key={task.id} className="flex items-start justify-between border-b pb-4 last:border-0 last:pb-0">
                    <div className="flex items-start space-x-3">
                        <Checkbox
                            id={task.id}
                            checked={task.isCompleted}
                            onCheckedChange={() => handleToggle(task.id, task.isCompleted)}
                            disabled={loadingId === task.id}
                        />
                        <div className="grid gap-1.5 leading-none">
                            <label
                                htmlFor={task.id}
                                className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${task.isCompleted ? 'line-through text-muted-foreground' : ''}`}
                            >
                                {task.title}
                            </label>
                            {isAdmin && (
                                <p className="text-xs text-muted-foreground">
                                    Assigned to: {task.assignees?.map((u) => u.name || u.email).join(", ") || "Unassigned"}
                                </p>
                            )}
                        </div>
                    </div>
                    {isAdmin && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleDelete(task.id)} aria-label={`Delete task: ${task.title}`}>
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                    )}
                </div>
            ))}

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('common.delete')}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('tasks.deleteConfirm') || 'Are you sure you want to delete this task? This action cannot be undone.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setTaskToDelete(null)}>
                            {t('common.cancel')}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        >
                            {t('common.delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
