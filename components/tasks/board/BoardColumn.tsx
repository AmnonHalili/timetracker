"use client"

import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { BoardCard } from "./BoardCard"

interface BoardColumnProps {
    id: string
    title: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tasks: any[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onTaskClick: (task: any) => void
}

export function BoardColumn({ id, title, tasks, onTaskClick }: BoardColumnProps) {
    const { setNodeRef } = useDroppable({ id })

    return (
        <div className="flex flex-col h-full bg-muted/40 rounded-lg p-4 w-80 shrink-0 border border-border/50">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm uppercase text-muted-foreground tracking-wide">{title}</h3>
                <span className="bg-background border text-muted-foreground text-xs font-medium px-2 py-0.5 rounded-full">
                    {tasks.length}
                </span>
            </div>

            <div ref={setNodeRef} className="flex-1 overflow-y-auto min-h-[100px] flex flex-col gap-2">
                <SortableContext id={id} items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    {tasks.map(task => (
                        <BoardCard key={task.id} task={task} onClick={onTaskClick} />
                    ))}
                </SortableContext>
                {tasks.length === 0 && (
                    <div className="h-full border-2 border-dashed border-muted-foreground/10 rounded-lg flex items-center justify-center text-sm text-muted-foreground/40 italic">
                        Empty
                    </div>
                )}
            </div>
        </div>
    )
}
