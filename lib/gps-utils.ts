/**
 * GPS Utilities for location verification
 */

export interface Location {
    latitude: number
    longitude: number
}

export interface WorkLocation {
    latitude: number
    longitude: number
    radius: number // in meters
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters
 */
export function calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371e3 // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const Δφ = ((lat2 - lat1) * Math.PI) / 180
    const Δλ = ((lon2 - lon1) * Math.PI) / 180

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c // Distance in meters
}

/**
 * Check if a location is within the work area
 */
export function isWithinWorkArea(
    userLocation: Location,
    workLocation: WorkLocation
): boolean {
    const distance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        workLocation.latitude,
        workLocation.longitude
    )
    return distance <= workLocation.radius
}

/**
 * Get user's current location
 */
export async function getCurrentLocation(): Promise<Location> {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Geolocation is not supported"))
            return
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                })
            },
            (error) => {
                reject(error)
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
            }
        )
    })
}

/**
 * Watch user's location and call callback when it changes
 */
export function watchLocation(
    callback: (location: Location) => void,
    errorCallback?: (error: GeolocationPositionError) => void
): number | null {
    if (!navigator.geolocation) {
        const error = {
            code: 2, // POSITION_UNAVAILABLE
            message: "Geolocation is not supported",
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
        } as GeolocationPositionError
        errorCallback?.(error)
        return null
    }

    return navigator.geolocation.watchPosition(
        (position) => {
            callback({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
            })
        },
        (error) => {
            errorCallback?.(error)
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000, // Accept cached position up to 1 minute old
        }
    )
}

/**
 * Stop watching location
 */
export function clearLocationWatch(watchId: number): void {
    navigator.geolocation.clearWatch(watchId)
}

