"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

interface HeaderPortalProps {
    children: React.ReactNode
}

export function HeaderPortal({ children }: HeaderPortalProps) {
    const [mounted, setMounted] = useState(false)
    const [container, setContainer] = useState<HTMLElement | null>(null)

    useEffect(() => {
        setMounted(true)

        const findContainer = () => {
            const el = document.getElementById("app-header-portal")
            if (el) {
                setContainer(el)
                return true
            }
            return false
        }

        // Try immediately
        if (findContainer()) return

        // If not found, use MutationObserver to wait for it
        const observer = new MutationObserver(() => {
            if (findContainer()) {
                observer.disconnect()
            }
        })

        observer.observe(document.body, {
            childList: true,
            subtree: true
        })

        return () => observer.disconnect()
    }, [])

    if (!mounted || !container) return null

    return createPortal(children, container)
}
