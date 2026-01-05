import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

export interface EmailValidationResult {
    isValid: boolean;
    message?: string;
}

export async function validateEmail(email: string): Promise<EmailValidationResult> {
    // 1. Syntax Check
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
        return {
            isValid: false,
            message: "Invalid email format"
        };
    }

    // 2. Domain & MX Record Check
    const domain = email.split('@')[1];
    try {
        const addresses = await resolveMx(domain);
        if (!addresses || addresses.length === 0) {
            return {
                isValid: false,
                message: "Email domain does not exist or has no mail server"
            };
        }
        return { isValid: true };
    } catch (error) {
        // dns.resolveMx throws an error if the domain doesn't exist or has no MX records
        console.error(`MX Check failed for domain: ${domain}`, error);
        return {
            isValid: false,
            message: "Invalid email domain"
        };
    }
}
