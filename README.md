# WorkTracker

A minimalist work hours and task tracker with real-time balance calculation built with Next.js 14, TypeScript, Prisma (Neon), and Tailwind CSS/shadcn/ui.

## Features

### Core Functionality
- **Real-time Balance Calculation**: Balance = TotalWorked - (PastWorkDays × DailyTarget)
- **Automatic Weekend Handling**: Weekends are automatically ignored in balance calculations
- **Role-based Access Control**: PENDING → USER → ADMIN approval workflow

### Screens
1. **Authentication**
   - Registration with pending approval
   - Admin approval system
   
2. **Dashboard**
   - Timer for active work sessions
   - Manual time entry
   - Balance card with red (negative) / green (positive) indicators
   
3. **Reports**
   - Monthly breakdown of work hours
   - Historical data visualization
   
4. **Tasks**
   - Admin assigns tasks to users
   - Users mark tasks as complete

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL (Neon) with Prisma ORM
- **Styling**: Tailwind CSS + shadcn/ui
- **Authentication**: NextAuth.js
- **Design**: Mobile-first responsive design

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- A Neon PostgreSQL database (https://console.neon.tech)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd timetracker
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add your database URLs:
- `DATABASE_URL`: Your Neon connection string (for connection pooling)
- `DIRECT_URL`: Your Neon direct connection string (for migrations)
- `NEXTAUTH_SECRET`: Generate with `openssl rand -base64 32`
- `NEXTAUTH_URL`: Your app URL (http://localhost:3000 for development)
- `CRON_SECRET`: (Optional) Secret key for cron job authentication. Generate with `openssl rand -base64 32`. Required for production cron jobs.

4. Generate Prisma Client:
```bash
npm run prisma:generate
```

5. Push the database schema:
```bash
npm run prisma:push
```

6. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Database Schema

### User Model
- **Fields**: id, email, password, name, role, dailyTarget, workDays[]
- **Roles**: PENDING, USER, ADMIN
- **Default**: 8-hour daily target, Monday-Friday work week

### TimeEntry Model
- **Fields**: id, userId, start, end, duration, note
- **Relations**: Belongs to User

### Task Model
- **Fields**: id, title, description, status, priority, assignedToId, createdById, dueDate
- **Status**: TODO, IN_PROGRESS, COMPLETED, CANCELLED
- **Priority**: LOW, MEDIUM, HIGH, URGENT
- **Relations**: Assigned to User, Created by User

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio
- `npm run prisma:push` - Push schema changes to database

## Project Structure

```
timetracker/
├── app/                    # Next.js 14 App Router
│   ├── globals.css        # Global styles with shadcn/ui variables
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   └── ui/               # shadcn/ui components
├── lib/                   # Utility functions
│   ├── prisma.ts         # Prisma client singleton
│   └── utils.ts          # Utility functions (cn, etc.)
├── prisma/               # Database schema and migrations
│   └── schema.prisma     # Prisma schema with User, TimeEntry, Task models
├── .env                  # Environment variables (not committed)
├── .env.example          # Environment variables template
└── package.json          # Dependencies and scripts
```

## Balance Calculation Logic

The balance is calculated as:
```
Balance = Total Hours Worked - (Number of Past Work Days × Daily Target)
```

- **Past Work Days**: Only counts days from the user's `workDays` array (defaults to Monday-Friday)
- **Weekends**: Automatically excluded unless specified in user's work days
- **Daily Target**: Configurable per user (defaults to 8 hours)
- **Visual Indicator**: Red card for negative balance, green for positive

## License

MIT
