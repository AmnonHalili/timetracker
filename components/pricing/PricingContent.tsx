"use client"

import { useLanguage } from "@/lib/useLanguage"
import React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Check, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getRequiredTier, calculateCompanyPrice } from "@/lib/subscription-config"

export function PricingContent() {
    const { t, isRTL } = useLanguage()
    const [userCount, setUserCount] = React.useState<number>(0)
    const [currentPlan, setCurrentPlan] = React.useState<string>("free")


    // Fetch current subscription info
    React.useEffect(() => {
        async function fetchSubscription() {
            try {
                const res = await fetch("/api/user/subscription")
                if (res.ok) {
                    const data = await res.json()
                    setUserCount(data.userCount || 0)
                    setCurrentPlan(data.plan?.toLowerCase() || "free")
                }
            } catch (error) {
                console.error("Failed to fetch subscription:", error)
            } finally {

            }
        }
        fetchSubscription()
    }, [])

    // All features that appear in all plans
    const allFeatures = [
        { key: 'basicFeatures', text: t('pricing.feature.basicFeatures') },
        { key: 'userSupport', text: '' }, // Will be set dynamically per plan
        { key: 'taskAttachments', text: "Task Attachments" }, // Temporarily hardcoded until translated
        { key: 'noAds', text: t('pricing.feature.noAds') },
    ]

    // Additional features for Company tier
    const companyFeatures = [
        { key: 'basicFeatures', text: t('pricing.feature.basicFeatures') },
        { key: 'userSupport', text: t('pricing.feature.unlimitedUsers') },
        { key: 'taskAttachments', text: "Task Attachments" },
        { key: 'noAds', text: t('pricing.feature.noAds') },
    ]

    // Get user support text for each plan
    const getUserSupportText = (planId: string): string => {
        switch (planId) {
            case 'free':
                return t('pricing.feature.upTo3Users')
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

    // Get tier color and symbol
    const getTierStyle = (planId: string) => {
        switch (planId) {
            case 'free':
                return { color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', symbol: '🟢' }
            case 'tier1':
                return { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', symbol: '🔵' }
            case 'tier2':
                return { color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', symbol: '🟠' }
            case 'tier3':
                return { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', symbol: '🔴' }
            default:
                return { color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', symbol: '' }
        }
    }

    // Determine which tier user qualifies for
    const qualifiedTier = userCount > 0 ? getRequiredTier(userCount) : null

    // Define which features are included in each plan
    const getFeatureStatus = (planId: string, featureKey: string): boolean => {
        const featureMap: Record<string, Record<string, boolean>> = {
            free: {
                basicFeatures: true,
                userSupport: true,
                taskAttachments: false,
                noAds: false, // Gray (not included)
                perUserPricing: false,
            },
            tier1: {
                basicFeatures: true,
                userSupport: true,
                taskAttachments: true,
                noAds: true,
                perUserPricing: false,
            },
            tier2: {
                basicFeatures: true,
                userSupport: true,
                taskAttachments: true,
                noAds: true,
                perUserPricing: false,
            },
            tier3: {
                basicFeatures: true,
                userSupport: true,
                taskAttachments: true,
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
            price: userCount > 50 ? `$${calculateCompanyPrice(userCount).toFixed(2)} / month` : t('pricing.tier3.price'),
            description: t('pricing.tier3.description'),
            users: t('pricing.tier3.users'),
            popular: false,
        },
    ]

    const [isLoading, setIsLoading] = React.useState<string | null>(null)

    const handleUpgrade = async (planId: string) => {
        try {
            setIsLoading(planId)
            const response = await fetch("/api/stripe/checkout", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    planId: planId,
                }),
            })

            if (!response.ok) {
                throw new Error("Something went wrong")
            }

            const data = await response.json()
            window.location.href = data.url
        } catch (error) {
            console.error("Error connecting to Stripe:", error)
            // Ideally show a toast here
        } finally {
            setIsLoading(null)
        }
    }

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
                {plans.map((plan) => {
                    const tierStyle = getTierStyle(plan.id)
                    const isQualified = qualifiedTier?.slug === plan.id
                    const isCurrentPlan = currentPlan === plan.id

                    return (
                        <Card
                            key={plan.id}
                            className={`relative flex flex-col ${plan.popular ? 'border-primary shadow-lg scale-105' : ''
                                } ${isQualified && plan.id !== 'free' ? `${tierStyle.border} border-2` : ''
                                }`}
                        >
                            {plan.popular && (
                                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                                    {t('pricing.popular')}
                                </Badge>
                            )}
                            {isQualified && !isCurrentPlan && (
                                <Badge className={`absolute -top-3 ${isRTL ? 'left-2' : 'right-2'} ${tierStyle.bg} ${tierStyle.color} border ${tierStyle.border}`}>
                                    {tierStyle.symbol} {t('pricing.qualifiedFor')}
                                </Badge>
                            )}
                            <CardHeader className={`${isRTL ? 'text-right' : 'text-left'}`}>
                                <CardTitle className="text-2xl flex items-center gap-2">
                                    <span>{tierStyle.symbol}</span>
                                    <span>{plan.name}</span>
                                </CardTitle>
                                <div className="mt-4">
                                    <div className="text-3xl font-bold">{plan.price}</div>
                                    {plan.id === 'tier3' && (
                                        <div className="mt-2 space-y-1">
                                            {userCount > 50 ? (
                                                <div className="text-xs text-muted-foreground">
                                                    {t('pricing.tier3.basePrice')} + ${2.5.toFixed(2)} × {userCount - 50} {t('pricing.tier3.usersAbove50')} = ${calculateCompanyPrice(userCount).toFixed(2)}/month
                                                </div>
                                            ) : (
                                                <div className="text-xs text-muted-foreground">
                                                    {t('pricing.tier3.basePrice')} + ${2.5.toFixed(2)} {t('pricing.tier3.perUserAbove50')}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {plan.id !== 'free' && (
                                        <>
                                            <div className="mt-2 text-sm font-medium text-foreground">
                                                {plan.users}
                                            </div>
                                            <CardDescription className="mt-1">{plan.description}</CardDescription>
                                        </>
                                    )}
                                    {plan.id === 'free' && (
                                        <>
                                            <div className="mt-2 text-sm font-medium text-foreground">
                                                {plan.users}
                                            </div>
                                            <CardDescription className="mt-1">{plan.description}</CardDescription>
                                        </>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1 flex flex-col">
                                <ul className={`space-y-3 flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                                    {(plan.id === 'tier3' ? companyFeatures : allFeatures).map((feature) => {
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
                                    onClick={() => plan.id !== 'free' && handleUpgrade(plan.id)}
                                    disabled={isLoading === plan.id || plan.id === 'free' || (isCurrentPlan && plan.id !== 'free')}
                                >
                                    {isLoading === plan.id ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    ) : (
                                        isCurrentPlan ? t('pricing.currentPlan') : (plan.id === 'free' ? t('pricing.currentPlan') : t('pricing.upgrade'))
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>
        </div>
    )
}

