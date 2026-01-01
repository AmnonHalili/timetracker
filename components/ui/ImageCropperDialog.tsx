
"use client"

import { useState, useCallback, useEffect, useRef } from 'react'
import Cropper from 'react-easy-crop'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Loader2 } from "lucide-react"

interface ImageCropperDialogProps {
    open: boolean
    imageSrc: string | null
    onClose: () => void
    onCropComplete: (croppedImageBase64: string) => void
}

export function ImageCropperDialog({ open, imageSrc, onClose, onCropComplete }: ImageCropperDialogProps) {
    const [crop, setCrop] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(0.6) // Start more zoomed out
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    const onCropChange = (location: { x: number; y: number }) => {
        setCrop(location)
    }

    const onZoomChange = (zoom: number) => {
        setZoom(zoom)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onCropCompleteCallback = useCallback((croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels)
    }, [])

    const createImage = (url: string): Promise<HTMLImageElement> =>
        new Promise((resolve, reject) => {
            const image = new Image()
            image.addEventListener('load', () => resolve(image))
            image.addEventListener('error', (error) => reject(error))
            image.src = url
        })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<string> => {
        const image = await createImage(imageSrc)
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        if (!ctx) {
            throw new Error('No 2d context')
        }

        canvas.width = pixelCrop.width
        canvas.height = pixelCrop.height

        ctx.drawImage(
            image,
            pixelCrop.x,
            pixelCrop.y,
            pixelCrop.width,
            pixelCrop.height,
            0,
            0,
            pixelCrop.width,
            pixelCrop.height
        )

        return canvas.toDataURL('image/png')
    }

    // Reset zoom and crop when dialog opens
    useEffect(() => {
        if (open) {
            setZoom(0.6) // Reset to zoomed out view
            setCrop({ x: 0, y: 0 })
            // Disable body scroll to prevent background zoom
            document.body.style.overflow = 'hidden'
        } else {
            // Re-enable body scroll when dialog closes
            document.body.style.overflow = ''
        }

        return () => {
            // Cleanup: re-enable body scroll
            document.body.style.overflow = ''
        }
    }, [open])

    // Handle wheel event with smaller increments and prevent propagation
    const handleWheel = useCallback((e: React.WheelEvent | WheelEvent) => {
        // Prevent the event from propagating to the background
        e.stopPropagation()
        e.preventDefault()

        // Very small, proportional zoom step for smooth scrolling
        // Scale deltaY to create smooth, slow zoom increments
        const deltaY = 'deltaY' in e ? e.deltaY : (e as WheelEvent).deltaY
        // Use a very small multiplier (0.002) for smooth, slow zoom
        const zoomDelta = -deltaY * 0.002
        setZoom(prevZoom => {
            const newZoom = Math.max(0.5, Math.min(prevZoom + zoomDelta, 3))
            return newZoom
        })
    }, [])

    // Attach wheel event listener in capture phase to intercept before react-easy-crop
    useEffect(() => {
        if (!open) return

        const container = containerRef.current
        if (!container) return

        const handler = (e: WheelEvent) => handleWheel(e)
        container.addEventListener('wheel', handler, { passive: false, capture: true })

        return () => {
            container.removeEventListener('wheel', handler, { capture: true })
        }
    }, [open, handleWheel])

    const handleSave = async () => {
        if (!imageSrc || !croppedAreaPixels) return

        setIsLoading(true)
        try {
            const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels)
            onCropComplete(croppedImage)
            onClose()
        } catch (e) {
            console.error(e)
        } finally {
            setIsLoading(false)
        }
    }

    if (!imageSrc) return null

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent 
                className="sm:max-w-md"
                onWheel={(e) => {
                    // Prevent wheel events from propagating to background
                    e.stopPropagation()
                }}
            >
                <DialogHeader>
                    <DialogTitle>Adjust Logo</DialogTitle>
                </DialogHeader>

                <div 
                    ref={containerRef}
                    className="relative h-64 w-full bg-black/5 rounded-md overflow-hidden mt-4"
                >
                    <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={1}
                        onCropChange={onCropChange}
                        onCropComplete={onCropCompleteCallback}
                        onZoomChange={onZoomChange}
                        showGrid={false}
                        zoomWithScroll={false}
                        restrictPosition={false}
                    />
                </div>

                <div className="py-4 space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Zoom</span>
                        <span>{zoom.toFixed(1)}x</span>
                    </div>
                    <Slider
                        defaultValue={[0.6]}
                        min={0.5}
                        max={3}
                        step={0.1}
                        value={[zoom]}
                        onValueChange={(vals) => setZoom(vals[0])}
                    />
                </div>

                <DialogFooter className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={onClose} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isLoading}>
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Save Logo
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
