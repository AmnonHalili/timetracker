"use client"

import { startTransition } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRouter, useSearchParams } from "next/navigation"
import { useLanguage } from "@/lib/useLanguage"

interface MonthSelectorProps {
    year: number
    month: number
}

export function MonthSelector({ year: propsYear, month: propsMonth }: MonthSelectorProps) {
    const { t } = useLanguage()
    const router = useRouter()
    const searchParams = useSearchParams()

    const currentMonth = propsMonth ?? (searchParams.get("month") ? parseInt(searchParams.get("month")!) : new Date().getMonth())
    const currentYear = propsYear ?? (searchParams.get("year") ? parseInt(searchParams.get("year")!) : new Date().getFullYear())

    const handleMonthChange = (value: string) => {
        const params = new URLSearchParams(searchParams)
        params.set("month", value)
        startTransition(() => {
            router.push(`?${params.toString()}`)
        })
    }

    const handleYearChange = (value: string) => {
        const params = new URLSearchParams(searchParams)
        params.set("year", value)
        startTransition(() => {
            router.push(`?${params.toString()}`)
        })
    }

    const months = Array.from({ length: 12 }, (_, i) => i)
    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i) // Last 2 years + next 2

    const monthNames: Array<'months.january' | 'months.february' | 'months.march' | 'months.april' | 'months.may' | 'months.june' | 'months.july' | 'months.august' | 'months.september' | 'months.october' | 'months.november' | 'months.december'> = [
        'months.january',
        'months.february',
        'months.march',
        'months.april',
        'months.may',
        'months.june',
        'months.july',
        'months.august',
        'months.september',
        'months.october',
        'months.november',
        'months.december'
    ]

    return (
        <div className="flex gap-2">
            <Select value={currentMonth.toString()} onValueChange={handleMonthChange}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder={t('months.month')} />
                </SelectTrigger>
                <SelectContent>
                    {months.map((month) => (
                        <SelectItem key={month} value={month.toString()}>
                            {t(monthNames[month])}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select value={currentYear.toString()} onValueChange={handleYearChange}>
                <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder={t('months.year')} />
                </SelectTrigger>
                <SelectContent>
                    {years.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                            {year}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}
