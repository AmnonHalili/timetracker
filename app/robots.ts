import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NEXTAUTH_URL || 'https://collabo-web.vercel.app'
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/dashboard/', '/reports/', '/settings/', '/tasks/', '/team/'],
        },
        sitemap: `${baseUrl}/sitemap.xml`,
    }
}
