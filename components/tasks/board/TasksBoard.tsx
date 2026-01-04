"use client"

import { useState } from "react"
import {
    DndContext,
    DragOverlay,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragEndEvent,
} from "@dnd-kit/core"
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { BoardColumn } from "./BoardColumn"
import { BoardCard } from "./BoardCard"
import { createPortal } from "react-dom"

interface TasksBoardProps {
    tasks: any[]
    onTaskClick: (task: any) => void
    onStatusChange: (taskId: string, newStatus: string) => Promise<void>
}

const COLUMNS = [
    { id: 'TODO', title: 'To Do' },
    { id: 'IN_PROGRESS', title: 'In Progress' },
    { id: 'BLOCKED', title: 'Blocked' },
    { id: 'DONE', title: 'Done' },
]

export function TasksBoard({ tasks, onTaskClick, onStatusChange }: TasksBoardProps) {
    const [activeId, setActiveId] = useState<string | null>(null)

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string)
    }

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event

        if (!over) return

        const activeId = active.id as string
        const overId = over.id as string

        const activeTask = tasks.find(t => t.id === activeId)
        if (!activeTask) return

        // Find the column the item was dropped over
        // It could be a column ID or another task ID
        let newStatus = overId as string

        // If dropped over a task, find that task's status
        const overTask = tasks.find(t => t.id === overId)
        if (overTask) {
            newStatus = overTask.status
        }

        // Only update if status changed
        if (activeTask.status !== newStatus && COLUMNS.some(c => c.id === newStatus)) {
            // Optimistic update handled by onStatusChange via parent re-render usually, 
            // but DSK requires local state for smooth animation. 
            // In this specific implementation, we rely on the parent to update the 'tasks' prop.
            // For a smoother experience, we'd manage local state here too.
            await onStatusChange(activeId, newStatus)
        }

        setActiveId(null)
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="flex gap-4 h-full overflow-x-auto pb-4">
                {COLUMNS.map(col => (
                    <BoardColumn
                        key={col.id}
                        id={col.id}
                        title={col.title}
                        tasks={tasks.filter(t => t.status === col.id)}
                        onTaskClick={onTaskClick}
                    />
                ))}
            </div>

            {createPortal(
                <DragOverlay>
                    {activeId ? (
                        <BoardCard
                            task={tasks.find(t => t.id === activeId)!}
                            onClick={() => { }}
                        />
                    ) : null}
                </DragOverlay>,
                document.body
            )}
        </DndContext>
    )
}
