import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrivacyPolicyPage() {
    const lastUpdated = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    return (
        <div className="min-h-screen bg-white dark:bg-zinc-950 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
                <div className="mb-8">
                    <Link href="/">
                        <Button variant="ghost" size="sm" className="gap-2 pl-0 hover:pl-0 hover:bg-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                            <ArrowLeft className="w-4 h-4" />
                            Back to Home
                        </Button>
                    </Link>
                </div>

                <article className="prose prose-zinc dark:prose-invert max-w-none">
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl mb-4">
                        Privacy Policy
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mb-8">
                        Last updated: {lastUpdated}
                    </p>

                    <div className="space-y-8 text-zinc-700 dark:text-zinc-300">
                        <section>
                            <p>
                                Welcome to Collabo ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy.
                                If you have any questions or concerns about this privacy notice or our practices with regard to your personal information, please
                                contact us at collabo.timetracker@gmail.com.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-3">1. Information We Collect</h2>
                            <p className="mb-2">We collect personal information that you voluntarily provide to us when you register on the website, express an interest in obtaining information about us or our products and services, or otherwise when you contact us.</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li><strong>Personal Information Given by You:</strong> We collect names; email addresses; passwords; contact preferences; and other similar information.</li>
                                <li><strong>Payment Data:</strong> We may collect data necessary to process your payment if you make purchases, such as your payment instrument number (such as a credit card number), and the security code associated with your payment instrument. All payment data is stored by Stripe. You may find their privacy notice link(s) here: <a href="https://stripe.com/privacy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">https://stripe.com/privacy</a>.</li>
                                <li><strong>Log and Usage Data:</strong> usage data is service-related, diagnostic, usage, and performance information our servers automatically collect when you access or use our Website and which we record in log files.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-3">2. How We Use Your Information</h2>
                            <p>We use personal information collected via our Website for a variety of business purposes described below. We process your personal information for these purposes in reliance on our legitimate business interests, in order to enter into or perform a contract with you, with your consent, and/or for compliance with our legal obligations.</p>
                            <ul className="list-disc pl-5 mt-2 space-y-1">
                                <li>To facilitate account creation and logon process (via Google Auth).</li>
                                <li>To send you administrative information.</li>
                                <li>To fulfill and manage your orders and payments.</li>
                                <li>To protect our Services.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-3">3. Cookies and Tracking Technologies</h2>
                            <p>We use cookies and similar tracking technologies (like web beacons and pixels) to access or store information.</p>
                            <ul className="list-disc pl-5 mt-2 space-y-1">
                                <li><strong>Authentication:</strong> We use cookies to verify your account and determine when you're logged in.</li>
                                <li><strong>Analytics:</strong> We use Google Analytics to collect data on how you interact with our website. This helps us understand what works well and what needs improvement.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-3">4. Third-Party Services</h2>
                            <p>We may share your data with the following third-party vendors, service providers, contractors, or agents who perform services for us or on our behalf and require access to such information to do that work:</p>
                            <ul className="list-disc pl-5 mt-2 space-y-1">
                                <li><strong>Stripe:</strong> For payment processing. We do not store your credit card details on our servers.</li>
                                <li><strong>Google Analytics:</strong> For website traffic analysis and reporting.</li>
                                <li><strong>Google Auth:</strong> For secure user authentication.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-3">5. Data Operations & Security</h2>
                            <p>We have implemented appropriate technical and organizational security measures designed to protect the security of any personal information we process. However, despite our safeguards and efforts to secure your information, no electronic transmission over the Internet or information storage technology can be guaranteed to be 100% secure.</p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-3">6. Contact Us</h2>
                            <p>If you have questions or comments about this policy, you may email us at <a href="mailto:collabo.timetracker@gmail.com" className="text-blue-600 hover:underline">collabo.timetracker@gmail.com</a>.</p>
                        </section>
                    </div>
                </article>
            </div>
        </div>
    );
}
