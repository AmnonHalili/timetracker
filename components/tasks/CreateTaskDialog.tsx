"use client"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import { useState } from "react"
import { Plus } from "lucide-react"
import { useLanguage } from "@/lib/useLanguage"
import { cn } from "@/lib/utils"
import { useMediaQuery } from "@/hooks/use-media-query"
import { CreateTaskForm } from "./CreateTaskForm"

interface CreateTaskDialogProps {
    users: { id: string; name: string | null; email: string | null; managerId?: string | null; role?: string }[]
    onTaskCreated?: () => void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onOptimisticTaskCreate?: (task: any) => void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    task?: any
    mode?: 'create' | 'edit'
    open?: boolean
    onOpenChange?: (open: boolean) => void
    currentUserId?: string
}

export function CreateTaskDialog({
    users,
    onTaskCreated,
    onOptimisticTaskCreate,
    task,
    mode = 'create',
    open: controlledOpen,
    onOpenChange: setControlledOpen,
    currentUserId
}: CreateTaskDialogProps) {
    const { t, isRTL } = useLanguage()
    const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
    const isDesktop = useMediaQuery("(min-width: 768px)")

    const isOpen = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen
    const setIsOpen = setControlledOpen || setUncontrolledOpen

    if (isDesktop) {
        return (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                {mode === 'create' && (
                    <DialogTrigger asChild>
                        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 w-full md:w-auto">
                            <Plus className={cn(isRTL ? "ml-2" : "mr-2", "h-5 w-5")} /> {t('tasks.addTask')}
                        </Button>
                    </DialogTrigger>
                )}
                <DialogContent
                    className={cn(
                        "sm:max-w-2xl",
                        "h-[85vh] overflow-hidden flex flex-col",
                        isRTL && "[&>button]:left-4 [&>button]:right-auto"
                    )}
                    dir={isRTL ? "rtl" : "ltr"}
                >
                    <DialogHeader className={isRTL ? "text-right" : "text-left"}>
                        <DialogTitle className={isRTL ? "text-right" : "text-left"}>
                            {mode === 'edit' ? t('tasks.edit') : t('tasks.createNewTask')}
                        </DialogTitle>
                        <DialogDescription className={isRTL ? "text-right" : "text-left"}>
                            {mode === 'edit' ? t('tasks.edit') : t('tasks.assignNewTask')}
                        </DialogDescription>
                    </DialogHeader>
                    <CreateTaskForm
                        users={users}
                        onTaskCreated={onTaskCreated}
                        onOptimisticTaskCreate={onOptimisticTaskCreate}
                        task={task}
                        mode={mode}
                        currentUserId={currentUserId}
                        onSuccess={() => setIsOpen(false)}
                        onCancel={() => setIsOpen(false)}
                    />
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            {mode === 'create' && (
                <SheetTrigger asChild>
                    <Button className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg rounded-xl text-base">
                        <Plus className={cn(isRTL ? "ml-2" : "mr-2", "h-5 w-5")} /> {t('tasks.addTask')}
                    </Button>
                </SheetTrigger>
            )}
            <SheetContent
                side="bottom"
                className={cn(
                    "h-[95vh] rounded-t-xl px-4 pb-0 pt-6", // Full height on mobile with styling
                    isRTL && "[&>button]:left-4 [&>button]:right-auto"
                )}
                dir={isRTL ? "rtl" : "ltr"}
            >
                <SheetHeader className={cn("mb-4", isRTL ? "text-right" : "text-left")}>
                    <SheetTitle className={isRTL ? "text-right" : "text-left"}>
                        {mode === 'edit' ? t('tasks.edit') : t('tasks.createNewTask')}
                    </SheetTitle>
                    <SheetDescription className={isRTL ? "text-right" : "text-left"}>
                        {mode === 'edit' ? t('tasks.edit') : t('tasks.assignNewTask')}
                    </SheetDescription>
                </SheetHeader>
                <div className="h-[calc(100%-80px)] overflow-y-auto pb-4">
                    <CreateTaskForm
                        users={users}
                        onTaskCreated={onTaskCreated}
                        onOptimisticTaskCreate={onOptimisticTaskCreate}
                        task={task}
                        mode={mode}
                        currentUserId={currentUserId}
                        onSuccess={() => setIsOpen(false)}
                        onCancel={() => setIsOpen(false)}
                    />
                </div>
            </SheetContent>
        </Sheet>
    )
}
