import Link from "next/link"

export default function TermsOfService() {
    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto bg-white shadow sm:rounded-lg overflow-hidden">
                <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                    <h1 className="text-3xl font-bold leading-6 text-gray-900">
                        Terms of Service
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm text-gray-500">
                        Last Updated: January 4, 2026
                    </p>
                </div>
                <div className="px-4 py-5 sm:p-6 space-y-8 text-gray-700">

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
                        <p className="leading-relaxed">
                            By accessing and using <strong>Collabo</strong> ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. In addition, when using this Service to access Google Calendar features, you shall be subject to any posted guidelines or rules applicable to such services.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Description of Service</h2>
                        <p className="leading-relaxed">
                            Collabo is a time-tracking and project management tool designed to help teams and individuals organize their work. We provide features including but not limited to task management, time logging, and calendar integration.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">3. User Accounts</h2>
                        <ul className="list-disc pl-5 space-y-2">
                            <li>You are responsible for maintaining the security of your account and password.</li>
                            <li>You are responsible for all content posted and activity that occurs under your account.</li>
                            <li>We reserve the right to suspend or terminate accounts that violate these terms or are used for illegal activities.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Google Calendar Integration</h2>
                        <p className="leading-relaxed mb-4">
                            Our Service allows you to connect your Google Calendar account. By doing so, you acknowledge and agree that:
                        </p>
                        <ul className="list-disc pl-5 space-y-2">
                            <li>We will access your calendar data solely to display it within the Collabo interface.</li>
                            <li>Our use of data is governed by our <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link> and strictly adheres to Google's Limited Use Policy.</li>
                            <li>You can revoke our access at any time via your Google Account security settings.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Intellectual Property</h2>
                        <p className="leading-relaxed">
                            The Service and its original content, features, and functionality are and will remain the exclusive property of Collabo and its licensors. The Service is protected by copyright, trademark, and other laws.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Termination</h2>
                        <p className="leading-relaxed">
                            We may terminate or suspend access to our Service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Limitation of Liability</h2>
                        <p className="leading-relaxed">
                            In no event shall Collabo, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Contact Us</h2>
                        <p className="leading-relaxed">
                            If you have any questions about these Terms, please contact us at:
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
