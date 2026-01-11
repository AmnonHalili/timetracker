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
import { useLanguage } from "@/lib/useLanguage"

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
    const { t } = useLanguage()
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
            console.error("Failed to fetch notifications")
        }
    }

    // Adaptive polling: faster when there are unread notifications, slower when none
    // Also refresh immediately when page becomes visible or gains focus
    useEffect(() => {
        let interval: NodeJS.Timeout | null = null
        
        const setupPolling = () => {
            // Clear existing interval
            if (interval) clearInterval(interval)
            
            // Poll every 5 seconds if there are unread notifications, 10 seconds otherwise
            const pollInterval = unreadCount > 0 ? 5000 : 10000
            interval = setInterval(fetchNotifications, pollInterval)
        }
        
        // Initial fetch
        fetchNotifications()
        setupPolling()
        
        // Handle visibility change - refresh immediately when page becomes visible
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                fetchNotifications()
            }
        }
        
        // Handle window focus - refresh immediately when window gains focus
        const handleFocus = () => {
            fetchNotifications()
        }
        
        document.addEventListener('visibilitychange', handleVisibilityChange)
        window.addEventListener('focus', handleFocus)
        
        return () => {
            if (interval) clearInterval(interval)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            window.removeEventListener('focus', handleFocus)
        }
    }, [unreadCount])

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
        // Optimistic update
        setUnreadCount(0)
        setNotifications(curr => curr.map(n => ({ ...n, isRead: true })))

        try {
            await fetch("/api/notifications", {
                method: "PATCH",
                body: JSON.stringify({ markAllRead: true }),
            })
        } catch {
            console.error("Failed to sync read status")
        }
    }

    return (
        <Popover open={isOpen} onOpenChange={(open) => {
            setIsOpen(open)
            if (open && unreadCount > 0) {
                markAllRead()
            }
        }}>
            <PopoverTrigger asChild>
                <Button variant="ghost" className="relative h-14 w-14 p-0 [&_svg]:!size-6 md:[&_svg]:!size-10" aria-label={`${t('notifications.title')}${unreadCount > 0 ? `, ${unreadCount} ${t('notifications.unread')}` : ''}`}>
                    <Bell className="h-6 w-6 md:h-10 md:w-10 text-muted-foreground transition-colors hover:text-foreground" aria-hidden="true" />
                    {unreadCount > 0 && (
                        <span className="absolute top-3 right-3 md:top-2 md:right-2 flex h-4 w-4 md:h-5 md:w-5 items-center justify-center rounded-full bg-destructive text-[10px] md:text-xs font-bold text-white shadow-sm ring-2 ring-background animate-in zoom-in-50 duration-300">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between p-4 border-b">
                    <h4 className="font-semibold text-sm">{t('notifications.title')}</h4>
                    {unreadCount > 0 && (
                        <Button variant="ghost" size="sm" onClick={markAllRead} className="h-auto p-1 text-xs text-muted-foreground hover:text-primary">
                            {t('notifications.markAllRead')}
                        </Button>
                    )}
                </div>
                <ScrollArea className="h-[300px]">
                    {notifications.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                            {t('notifications.noNotifications')}
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
