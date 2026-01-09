import { NextResponse } from "next/server";
import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:example@yourdomain.org",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
);

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    // Optional: Restrict sending to Admins or specific logic
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, message, url, userId } = body;

    const payload = JSON.stringify({
        title,
        body: message,
        icon: "/icon.png",
        url: url || "/",
    });

    try {
        // Fetch subscriptions (e.g., specific user or all)
        // For demo, if userId is provided, send to that user.
        // If not, maybe error or broadcast (be careful).

        let whereClause = {};
        if (userId) {
            whereClause = { userId };
        } else {
            // Just for safety in this demo, require userId
            return NextResponse.json({ error: "UserId required" }, { status: 400 });
        }

        const subscriptions = await prisma.pushSubscription.findMany({
            where: whereClause,
        });

        const results = await Promise.all(
            subscriptions.map((sub) =>
                webpush
                    .sendNotification(
                        {
                            endpoint: sub.endpoint,
                            keys: {
                                p256dh: sub.p256dh,
                                auth: sub.auth,
                            },
                        },
                        payload
                    )
                    .catch((err) => {
                        console.error("Error sending notification:", err);
                        // Optionally remove invalid subscriptions here
                        if (err.statusCode === 410 || err.statusCode === 404) {
                            return prisma.pushSubscription.delete({ where: { id: sub.id } });
                        }
                    })
            )
        );

        return NextResponse.json({ success: true, results });
    } catch (error) {
        console.error("Error sending push:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
