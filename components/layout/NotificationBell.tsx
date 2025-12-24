"use client"

import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { useState, useEffect } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatDistanceToNow } from "date-fns"
import { useRouter } from "next/navigation"

interface Notification {
    id: string
    title: string
    message: string
    link?: string | null
    type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR'
    isRead: boolean
    createdAt: string
}

export function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [isOpen, setIsOpen] = useState(false)
    const router = useRouter()

    const fetchNotifications = async () => {
        try {
            const res = await fetch("/api/notifications")
            if (res.ok) {
                const data = await res.json()
                setNotifications(data)
                setUnreadCount(data.filter((n: Notification) => !n.isRead).length)
            }
        } catch {
            console.error("Failed to mark as read")
        }
    }

    // Initial fetch and poll every minute
    useEffect(() => {
        fetchNotifications()
        const interval = setInterval(fetchNotifications, 60000)
        return () => clearInterval(interval)
    }, [])

    // Refresh when opening
    useEffect(() => {
        if (isOpen) fetchNotifications()
    }, [isOpen])

    const markAsRead = async (id: string) => {
        await fetch("/api/notifications", {
            method: "PATCH",
            body: JSON.stringify({ id }),
        })
        setNotifications(curr => curr.map(n => n.id === id ? { ...n, isRead: true } : n))
        setUnreadCount(prev => Math.max(0, prev - 1))
    }

    const markAllRead = async () => {
        await fetch("/api/notifications", {
            method: "PATCH",
            body: JSON.stringify({ markAllRead: true }),
        })
        setNotifications(curr => curr.map(n => ({ ...n, isRead: true })))
        setUnreadCount(0)
    }

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-14 w-14 [&_svg]:h-7 [&_svg]:w-7">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    {unreadCount > 0 && (
                        <span className="absolute top-3.5 right-3.5 h-3 w-3 rounded-full bg-red-600 animate-pulse border-2 border-background" />
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between p-4 border-b">
                    <h4 className="font-semibold text-sm">Notifications</h4>
                    {unreadCount > 0 && (
                        <Button variant="ghost" size="sm" onClick={markAllRead} className="h-auto p-1 text-xs text-muted-foreground hover:text-primary">
                            Mark all read
                        </Button>
                    )}
                </div>
                <ScrollArea className="h-[300px]">
                    {notifications.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                            No notifications
                        </div>
                    ) : (
                        <div className="divide-y">
                            {notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`p-4 hover:bg-muted/50 transition-colors cursor-pointer ${!notification.isRead ? 'bg-muted/20' : ''}`}
                                    onClick={() => {
                                        if (!notification.isRead) markAsRead(notification.id)
                                        if (notification.link) {
                                            router.push(notification.link)
                                            setIsOpen(false)
                                        }
                                    }}
                                >
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="space-y-1">
                                            <p className={`text-sm ${!notification.isRead ? 'font-semibold' : 'font-medium'}`}>
                                                {notification.title}
                                            </p>
                                            <p className="text-xs text-muted-foreground line-clamp-2">
                                                {notification.message}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground pt-1">
                                                {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                                            </p>
                                        </div>
                                        {!notification.isRead && (
                                            <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    )
}
