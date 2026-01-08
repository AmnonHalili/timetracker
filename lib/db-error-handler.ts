import { NextResponse } from "next/server"

/**
 * Checks if an error is a database connection error (Neon/PostgreSQL)
 */
export function isDatabaseError(error: unknown): boolean {
    if (!(error instanceof Error)) {
        return false
    }

    const errorMessage = error.message.toLowerCase()
    const errorStack = error.stack?.toLowerCase() || ''
    const fullErrorText = `${errorMessage} ${errorStack}`
    
    // Prisma error codes for database connection issues
    const prismaErrorCodes = [
        'P1000', // Authentication failed
        'P1001', // Can't reach database server
        'P1002', // Database server is not available
        'P1003', // Database does not exist
        'P1008', // Operations timed out
        'P1010', // User was denied access
        'P1011', // TLS connection error
        'P1012', // Error opening a TLS connection
        'P1013', // Invalid database string
        'P1017', // Server has closed the connection
    ]
    
    // Check for Prisma error codes
    if (prismaErrorCodes.some(code => fullErrorText.includes(code.toLowerCase()))) {
        return true
    }
    
    // Check for Neon-specific error messages
    const neonErrorKeywords = [
        'neon',
        'neon.tech',
        'neon database',
        'neon connection',
        'neon server',
    ]
    
    if (neonErrorKeywords.some(keyword => fullErrorText.includes(keyword))) {
        return true
    }
    
    // Check for common database connection error messages
    const connectionErrorKeywords = [
        "can't reach database",
        "cannot reach database",
        "database server",
        "database connection",
        "connection timeout",
        "connection refused",
        "connection error",
        "connection failed",
        "network error",
        "postgres",
        "postgresql",
        "prisma",
        "database connection failed",
        "unable to connect",
        "connection pool",
        "connection pool timeout",
        "connection limit",
        "too many connections",
        "database unavailable",
        "service unavailable",
        "database error",
        "query timeout",
        "operation timeout",
        "server closed",
        "connection closed",
        "socket error",
        "econnrefused",
        "etimedout",
        "enotfound",
    ]
    
    return connectionErrorKeywords.some(keyword => fullErrorText.includes(keyword))
}

/**
 * Creates a standardized error response for database connection issues
 */
export function createDatabaseErrorResponse(error: unknown): NextResponse {
    console.error("Database connection error:", error)
    
    return NextResponse.json(
        {
            message: "Database connection issue",
            error: "We are experiencing issues with our database service. We will be back online shortly. Please try again in a few moments.",
            code: "DATABASE_CONNECTION_ERROR"
        },
        { status: 503 } // Service Unavailable
    )
}

/**
 * Wraps a database operation with error handling
 * Returns the result or throws a formatted error if it's a DB connection error
 */
export async function handleDatabaseError<T>(
    operation: () => Promise<T>
): Promise<T> {
    try {
        return await operation()
    } catch (error) {
        if (isDatabaseError(error)) {
            // Re-throw with a more user-friendly message
            throw new Error("Database connection issue. Please try again in a few moments.")
        }
        throw error
    }
}

