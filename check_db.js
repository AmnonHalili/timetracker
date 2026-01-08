const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const columns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Event' AND column_name = 'exDates'
    `;
        console.log('Column check:', columns);

        // Also try a simple query
        try {
            const event = await prisma.event.findFirst();
            console.log('First event exDates:', event ? event.exDates : 'No events');
        } catch (e) {
            console.log('findFirst failed as expected if column is missing:', e.message);
        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
