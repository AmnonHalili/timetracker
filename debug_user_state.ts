import { prisma } from "./lib/prisma"

async function checkUserState() {
    const email = "amnonhalili@gmail.com" // Assuming this is the user based on previous context
    const user = await prisma.user.findUnique({
        where: { email },
        include: {
            calendarSettings: true,
            accounts: true
        }
    })

    if (!user) {
        console.log("User not found")
        return
    }

    console.log("User found:", user.email)
    console.log("Calendar Settings:", user.calendarSettings)
    console.log("Accounts:", user.accounts.map(a => ({ provider: a.provider, hasRefreshToken: !!a.refresh_token, scopes: a.scope })))
}

checkUserState()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
