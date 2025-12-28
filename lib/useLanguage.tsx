"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { Language, getTranslation, isRTL, TranslationKey } from "./translations"

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: TranslationKey) => string
  dir: 'ltr' | 'rtl'
  isRTL: boolean
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Load saved language from localStorage
    try {
      const saved = localStorage.getItem('language') as Language
      if (saved && (saved === 'en' || saved === 'he')) {
        setLanguageState(saved)
      }
    } catch {
      // Ignore errors, default is already 'en'
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', lang)
      // Update HTML dir attribute
      document.documentElement.setAttribute('dir', isRTL(lang) ? 'rtl' : 'ltr')
      document.documentElement.setAttribute('lang', lang)
    }
  }

  // Update HTML attributes when language changes
  useEffect(() => {
    if (mounted && typeof window !== 'undefined') {
      document.documentElement.setAttribute('dir', isRTL(language) ? 'rtl' : 'ltr')
      document.documentElement.setAttribute('lang', language)
    }
  }, [language, mounted])

  const t = (key: TranslationKey) => getTranslation(language, key)

  const value: LanguageContextType = {
    language,
    setLanguage,
    t,
    dir: isRTL(language) ? 'rtl' : 'ltr',
    isRTL: isRTL(language),
  }

  // Always provide the context, even before mounted, to prevent errors
  // The value will update once mounted and language is loaded from localStorage
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

