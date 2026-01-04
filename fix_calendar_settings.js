
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const email = 'amnonhalili@gmail.com'
    const user = await prisma.user.findFirst({
        where: { email },
        include: { calendarSettings: true }
    })

    if (!user || !user.calendarSettings) {
        console.log('No settings found')
        return
    }

    const currentIds = user.calendarSettings.syncedCalendarIds
    console.log('Current IDs:', currentIds)

    // 1. Remove 'primary' if we have specific IDs (to avoid duplicates)
    // 2. Remove holidays
    const newIds = currentIds.filter(id => {
        const isPrimaryKeyword = id === 'primary'
        const isHoliday = id.includes('holiday') || id.includes('import.calendar.google.com') // holidays usually come from these groups
        return !isPrimaryKeyword && !isHoliday
    })

    // If we ended up with nothing but we want the main calendar, ensure the email is there
    // (Assuming the user wants their main calendar)
    const hasMain = newIds.some(id => id === email)
    if (!hasMain) {
        newIds.push(email)
    }

    console.log('New IDs:', newIds)

    await prisma.calendarSettings.update({
        where: { id: user.calendarSettings.id },
        data: { syncedCalendarIds: newIds }
    })
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
