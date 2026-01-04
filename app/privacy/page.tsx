import { ExternalLink } from "lucide-react"
import Link from "next/link"

export default function PrivacyPolicy() {
    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto bg-white shadow sm:rounded-lg overflow-hidden">
                <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                    <h1 className="text-3xl font-bold leading-6 text-gray-900">
                        Privacy Policy
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm text-gray-500">
                        Last Updated: January 4, 2026
                    </p>
                </div>
                <div className="px-4 py-5 sm:p-6 space-y-8 text-gray-700">
                    {/* Introduction */}
                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introduction</h2>
                        <p className="leading-relaxed">
                            Welcome to <strong>Collabo</strong> ("we", "our", or "us"). We are committed to protecting your personal information and your right to privacy.
                            Collabo is a productivity and time-tracking application designed to help you manage your tasks and schedule efficiently.
                        </p>
                    </section>

                    {/* Information We Collect */}
                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Information We Collect</h2>
                        <p className="leading-relaxed mb-4">
                            We collect personal information that you voluntarily provide to us when you register on the application, express an interest in obtaining information about us or our products and services, or otherwise when you contact us.
                        </p>
                        <ul className="list-disc pl-5 space-y-2">
                            <li><strong>Account Data:</strong> Names, email addresses, and passwords (encrypted).</li>
                            <li><strong>Productivity Data:</strong> Tasks, project details, and time logs you create within the app.</li>
                            <li><strong>Google Data:</strong> If you choose to connect your Google Calendar, we access your calendar events labeled as "read-only" to display them within our interface.</li>
                        </ul>
                    </section>

                    {/* How We Use Google Data */}
                    <section className="bg-blue-50 p-4 rounded-md border border-blue-100">
                        <h2 className="text-xl font-semibold text-blue-900 mb-3">3. How We Use Google User Data</h2>
                        <div className="space-y-4 text-blue-800">
                            <p>
                                If you grant Collabo access to your Google Calendar, we use this access strictly for the following purpose:
                            </p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>
                                    <strong>Displaying Your Schedule:</strong> We fetch your calendar events to display them alongside your tasks in the Collabo daily and monthly views. This allows you to plan your work around your existing meetings and commitments.
                                </li>
                            </ul>
                            <p className="font-medium mt-4">We adhere to the following strict standards regarding your Google Data:</p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li><strong>No Advertising:</strong> We DO NOT use your Google Calendar data for serving advertisements, including retargeting, personalized, or interest-based advertising.</li>
                                <li><strong>No Sale of Data:</strong> We DO NOT sell, trade, or otherwise transfer your Google user data to third parties.</li>
                                <li><strong>No Human Interaction:</strong> Our staff does not read your calendar events unless explicitly authorised by you for security purposes or to resolve a support issue.</li>
                            </ul>
                        </div>
                    </section>

                    {/* Google Limited Use Disclosure */}
                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Google API Services User Data Policy</h2>
                        <p className="leading-relaxed italic border-l-4 border-gray-300 pl-4 py-2 bg-gray-50">
                            "Collabo's use and transfer to any other app of information received from Google APIs will adhere to <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">Google API Services User Data Policy <ExternalLink className="h-3 w-3" /></a>, including the Limited Use requirements."
                        </p>
                    </section>

                    {/* Data Retention */}
                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Data Retention and AI Training</h2>
                        <p className="leading-relaxed">
                            We retain your account data for as long as your account is active. Regarding Google Calendar data:
                        </p>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li>We employ short-term caching mechanisms to improve application performance and reduce API calls.</li>
                            <li>We <strong>DO NOT</strong> use your Google Calendar data to train artificial intelligence (AI) models.</li>
                            <li>If you disconnect your Google Calendar or delete your account, any cached calendar data is permanently removed from our systems.</li>
                        </ul>
                    </section>

                    {/* Contact Information */}
                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Contact Us</h2>
                        <p className="leading-relaxed">
                            If you have questions or comments about this policy, you may email us at:
                        </p>
                        <div className="mt-2 text-lg font-medium text-gray-900">
                            collabo.timetracker@gmail.com
                        </div>
                    </section>

                    <div className="pt-6 mt-8 border-t border-gray-200">
                        <Link href="/" className="text-blue-600 hover:text-blue-800 font-medium">
                            &larr; Back to Home
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
