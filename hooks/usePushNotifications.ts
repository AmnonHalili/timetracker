import { useState, useEffect } from 'react';

const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
};

export function usePushNotifications() {
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [subscription, setSubscription] = useState<PushSubscription | null>(null);
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
            // Attempt to register service worker manually to ensure it's loaded
            navigator.serviceWorker.register('/sw.js')
                .then((reg) => {
                    console.log('Service Worker registered successfully:', reg);
                })
                .catch((err) => {
                    console.error('Service Worker registration failed:', err);
                });

            // Set a timeout to prevent infinite loading
            const timeoutId = setTimeout(() => {
                setLoading(false);
            }, 3000);

            navigator.serviceWorker.ready.then((reg) => {
                clearTimeout(timeoutId);
                setRegistration(reg);
                reg.pushManager.getSubscription().then((sub) => {
                    if (sub) {
                        setSubscription(sub);
                        setIsSubscribed(true);
                    }
                    setLoading(false);
                });
            }).catch((err) => {
                console.error('Service Worker readiness failed:', err);
                setLoading(false);
            });
        } else {
            console.log('Push notifications not supported');
            setLoading(false);
        }
    }, []);

    const subscribeToPush = async () => {
        setLoading(true);
        try {
            if (!registration) {
                throw new Error('Service Worker not registered');
            }

            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                // User denied permission
                setLoading(false);
                return;
            }

            const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            if (!vapidPublicKey) {
                throw new Error('VAPID public key not found');
            }

            const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
            });

            // Send subscription to server
            const res = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(sub),
            });

            if (!res.ok) {
                throw new Error('Failed to save subscription on server');
            }

            setSubscription(sub);
            setIsSubscribed(true);
        } catch (err: any) {
            console.error('Failed to subscribe to push notification', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return { isSubscribed, subscribeToPush, loading, error };
}
