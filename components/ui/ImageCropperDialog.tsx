
"use client"

import { useState, useCallback } from 'react'
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
    const [zoom, setZoom] = useState(1)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(false)

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
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Adjust Logo</DialogTitle>
                </DialogHeader>

                <div className="relative h-64 w-full bg-black/5 rounded-md overflow-hidden mt-4">
                    <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={1}
                        onCropChange={onCropChange}
                        onCropComplete={onCropCompleteCallback}
                        onZoomChange={onZoomChange}
                        showGrid={false}
                    />
                </div>

                <div className="py-4 space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Zoom</span>
                        <span>{zoom.toFixed(1)}x</span>
                    </div>
                    <Slider
                        defaultValue={[1]}
                        min={1}
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
