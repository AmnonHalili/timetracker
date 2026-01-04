
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
    const userId = "cmjvdbyan0001rwawsyjvmohw" // From logs

    console.log("Checking CalendarSettings for user:", userId)

    const settings = await prisma.calendarSettings.findUnique({
        where: { userId }
    })

    console.log("CalendarSettings:", settings)

    const account = await prisma.account.findFirst({
        where: { userId, provider: "google" }
    })
    console.log("Google Account:", account ? "Found" : "Not Found")
    if (account) {
        console.log("Has refresh token:", !!account.refresh_token)
        console.log("Scopes:", account.scope)
    }
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
