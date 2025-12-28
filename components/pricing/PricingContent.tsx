"use client"

import { useLanguage } from "@/lib/useLanguage"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Check, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export function PricingContent() {
    const { t, isRTL } = useLanguage()

    // All features that appear in all plans
    const allFeatures = [
        { key: 'basicFeatures', text: t('pricing.feature.basicFeatures') },
        { key: 'userSupport', text: '' }, // Will be set dynamically per plan
        { key: 'noAds', text: t('pricing.feature.noAds') },
    ]

    // Get user support text for each plan
    const getUserSupportText = (planId: string): string => {
        switch (planId) {
            case 'free':
                return t('pricing.feature.upTo5Users')
            case 'tier1':
                return t('pricing.feature.upTo20Users')
            case 'tier2':
                return t('pricing.feature.upTo50Users')
            case 'tier3':
                return t('pricing.feature.unlimitedUsers')
            default:
                return ''
        }
    }

    // Define which features are included in each plan
    const getFeatureStatus = (planId: string, featureKey: string): boolean => {
        const featureMap: Record<string, Record<string, boolean>> = {
            free: {
                basicFeatures: true,
                userSupport: true,
                noAds: false, // Gray (not included)
            },
            tier1: {
                basicFeatures: true,
                userSupport: true,
                noAds: true,
            },
            tier2: {
                basicFeatures: true,
                userSupport: true,
                noAds: true,
            },
            tier3: {
                basicFeatures: true,
                userSupport: true,
                noAds: true,
            },
        }
        return featureMap[planId]?.[featureKey] ?? false
    }

    const plans = [
        {
            id: 'free',
            name: t('pricing.free.name'),
            price: t('pricing.free.price'),
            description: t('pricing.free.description'),
            users: t('pricing.free.users'),
            popular: false,
        },
        {
            id: 'tier1',
            name: t('pricing.tier1.name'),
            price: t('pricing.tier1.price'),
            description: t('pricing.tier1.description'),
            users: t('pricing.tier1.users'),
            popular: true,
        },
        {
            id: 'tier2',
            name: t('pricing.tier2.name'),
            price: t('pricing.tier2.price'),
            description: t('pricing.tier2.description'),
            users: t('pricing.tier2.users'),
            popular: false,
        },
        {
            id: 'tier3',
            name: t('pricing.tier3.name'),
            price: t('pricing.tier3.price'),
            description: t('pricing.tier3.description'),
            users: t('pricing.tier3.users'),
            popular: false,
        },
    ]

    return (
        <div className="container mx-auto px-4 py-12">
            <div className="text-center mb-12">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
                    {t('pricing.title')}
                </h1>
                <p className={`text-lg md:text-xl text-muted-foreground mx-auto ${isRTL ? 'text-right' : 'text-left'} inline-block`}>
                    {t('pricing.subtitle')}
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {plans.map((plan) => (
                    <Card
                        key={plan.id}
                        className={`relative flex flex-col ${plan.popular ? 'border-primary shadow-lg scale-105' : ''}`}
                    >
                        {plan.popular && (
                            <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                                {t('pricing.popular')}
                            </Badge>
                        )}
                        <CardHeader className={`${isRTL ? 'text-right' : 'text-left'}`}>
                            <CardTitle className="text-2xl">{plan.name}</CardTitle>
                            <div className="mt-4">
                                <div className="text-3xl font-bold">{plan.price}</div>
                                {plan.id !== 'free' && (
                                    <>
                                        <div className="mt-2 text-sm font-medium text-foreground">
                                            {plan.users}
                                        </div>
                                        <CardDescription className="mt-1">{plan.description}</CardDescription>
                                    </>
                                )}
                                {plan.id === 'free' && (
                                    <CardDescription className="mt-2">{plan.description}</CardDescription>
                                )}
                            </div>
                            {plan.id === 'free' && (
                                <div className="mt-2 text-sm text-muted-foreground">
                                    {plan.users}
                                </div>
                            )}
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col">
                            <ul className={`space-y-3 flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                                {allFeatures.map((feature) => {
                                    const included = getFeatureStatus(plan.id, feature.key)
                                    // For userSupport, use dynamic text per plan
                                    const displayText = feature.key === 'userSupport' 
                                        ? getUserSupportText(plan.id)
                                        : feature.text
                                    return (
                                        <li key={feature.key} className="flex items-start gap-2">
                                            {included ? (
                                                <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                                            ) : (
                                                <X className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                                            )}
                                            <span className={included ? 'text-foreground' : 'text-muted-foreground'}>
                                                {displayText}
                                            </span>
                                        </li>
                                    )
                                })}
                            </ul>
                            <Button
                                className={`w-full mt-6 ${plan.id === 'free' ? 'variant-outline' : ''}`}
                                variant={plan.popular ? 'default' : 'outline'}
                            >
                                {plan.id === 'free' ? t('pricing.currentPlan') : t('pricing.upgrade')}
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}

