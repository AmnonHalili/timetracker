'use client'

import { useEffect } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/lib/useLanguage'
import { isDatabaseError } from '@/lib/db-error-handler'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    const { t } = useLanguage()
    const isDbError = isDatabaseError(error)

    useEffect(() => {
        // Log the error for debugging
        console.error('Application error:', error)
    }, [error])

    if (isDbError) {
        return (
            <div className="flex min-h-screen items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                            <AlertCircle className="h-6 w-6 text-destructive" />
                        </div>
                        <CardTitle className="text-xl">
                            {t('common.databaseError.title')}
                        </CardTitle>
                        <CardDescription className="mt-2">
                            {t('common.databaseError.message')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex justify-center">
                        <Button onClick={reset} variant="default" className="gap-2">
                            <RefreshCw className="h-4 w-4" />
                            {t('common.databaseError.retry')}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // For other errors, show a generic error message
    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                        <AlertCircle className="h-6 w-6 text-destructive" />
                    </div>
                    <CardTitle className="text-xl">
                        {t('common.error')}
                    </CardTitle>
                    <CardDescription className="mt-2">
                        {error.message || 'Something went wrong'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center">
                    <Button onClick={reset} variant="default" className="gap-2">
                        <RefreshCw className="h-4 w-4" />
                        {t('common.databaseError.retry')}
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}

