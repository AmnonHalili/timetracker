import { useState, useEffect, useCallback } from 'react';

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
        let isMounted = true;

        if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
            // Wait for next-pwa to register the SW
            navigator.serviceWorker.ready.then((reg) => {
                if (isMounted) {
                    setRegistration(reg);
                    reg.pushManager.getSubscription().then((sub) => {
                        if (isMounted) {
                            if (sub) {
                                setSubscription(sub);
                                setIsSubscribed(true);
                            }
                            setLoading(false);
                        }
                    });
                }
            }).catch((err) => {
                console.error('Service Worker readiness failed:', err);
                if (isMounted) setLoading(false);
            });

            // Fallback timeout if ready never resolves (e.g. invalid config)
            const timeoutId = setTimeout(() => {
                if (isMounted) { // Check isMounted before accessing state
                    setLoading(false); // Set loading to false if it's still true after timeout
                }
            }, 4000);

            return () => {
                isMounted = false;
                clearTimeout(timeoutId);
            };
        } else {
            console.log('Push notifications not supported');
            setLoading(false);
        }
    }, []); // Empty dependency array ensures this runs once

    const subscribeToPush = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            console.log('Starting subscription process...');

            let currentReg = registration;
            if (!currentReg) {
                // Try to retrieve registration if missing
                console.log('Registration not found, waiting for service worker ready...');
                currentReg = await navigator.serviceWorker.ready;
                setRegistration(currentReg); // Update state with the retrieved registration
            }

            if (!currentReg) {
                throw new Error('Service Worker not registered. Try refreshing the page.');
            }

            const permission = await Notification.requestPermission();
            console.log('Notification permission status:', permission);

            if (permission !== 'granted') {
                setLoading(false);
                setError('Notifications permission denied. Please enable them in your browser settings.');
                return;
            }

            const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            if (!vapidPublicKey) {
                console.error('VAPID Public Key missing');
                throw new Error('System configuration error: VAPID key missing.');
            }

            console.log('Subscribing with key:', vapidPublicKey.substring(0, 10) + '...');

            const sub = await currentReg.pushManager.subscribe({
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
            setError(err.message || 'An error occurred during subscription.');
        } finally {
            setLoading(false);
        }
    }, [registration]); // Dependency on registration to ensure it's up-to-date

    return { isSubscribed, subscribeToPush, loading, error };
}
