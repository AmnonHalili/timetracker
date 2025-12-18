# timetracker
A minimalist work hours and task tracker with real-time balance calculation (Next.js, Prisma, Neon).

### 1. Technology Stack
* **Framework:** Next.js 14 (App Router) with TypeScript.
* **Styling:** Tailwind CSS + shadcn/ui components (for a clean, minimal look).
* **Database:** PostgreSQL.
* **ORM:** Prisma.
* **Auth:** NextAuth.js (v5) or a simple custom JWT implementation.
* **Icons:** Lucide-React.

### 2. Core Concept & Business Logic
The application tracks employee work hours and tasks. The unique selling point is the **"Real-Time Accumulation Logic"**:
* Each employee has a `daily_target` (e.g., 9 hours).
* The system must calculate the "Balance" (Missing hours vs. Extra hours) dynamically.
* **Logic:** `Balance = Total_Actual_Hours_Worked - (Count_Of_Past_Work_Days * Daily_Target)`.
* **Crucial:** The system must strictly respect defined "Work Days" (e.g., Sunday-Thursday). Do not accumulate "missing hours" on weekends or non-working days.

### 3. Database Schema (Prisma Draft)
Please implement a schema similar to this:

model User {
  idString      String   @id @default(cuid())
  email         String   @unique
  password      String
  name          String
  role          Role     @default(EMPLOYEE) // ADMIN or EMPLOYEE
  status        Status   @default(PENDING)  // Admin must approve new users
  dailyTarget   Float    @default(9.0)      // Hours per day
  workDays      Int[]    // Array of days (e.g., [0,1,2,3,4] for Sun-Thu)
  timeEntries   TimeEntry[]
  tasks         Task[]
}

model TimeEntry {
  idString      String    @id @default(cuid())
  userId        String
  startTime     DateTime
  endTime       DateTime? // Null means currently running (timer active)
  isManual      Boolean   @default(false)
  user          User      @relation(fields: [userId], references: [id])
}

model Task {
  idString      String   @id @default(cuid())
  title         String
  isCompleted   Boolean  @default(false)
  assignedToId  String
  assignedTo    User     @relation(fields: [assignedToId], references: [id])
}

### 4. Application Structure & Requirements (4 Screens)

#### A. Registration & Login
* Simple email/password login.
* Registration: Users sign up, but status is `PENDING` until Admin approves.

#### B. Time Tracking (Main Dashboard)
* **Stopwatch:** Large, prominent "Start/Stop" button.
* **Manual Entry:** Option to add a specific time range manually.
* **The Balance Card:** A highly visible card showing the current accumulated balance.
    * If balance is negative (missing hours): Show in **RED**.
    * If balance is positive (extra hours): Show in **GREEN**.
* **Today's Progress:** A visual progress bar (e.g., 4/9 hours worked today).

#### C. Reports Screen
* Table view displaying daily breakdown for a selected month.
* Columns: Date, Start Time, End Time, Total Duration, Status (Target Met / Missed).
* Summary cards at the top: Total Monthly Hours, Total Balance.

#### D. Tasks Screen
* **Admin View:** Create tasks, assign to users, delete tasks.
* **Employee View:** List of assigned tasks with a simple checkbox to toggle completion.
* **Real-time:** Use optimistic UI updates for task toggling.

### 5. Design Guidelines
* **Mobile-First:** The Dashboard must look perfect on mobile devices.
* **Minimalist:** Use plenty of whitespace. Avoid clutter.
* **Navigation:** A simple bottom navigation bar for mobile, or sidebar for desktop.

### 6. Step-by-Step Implementation Plan
Please start by:
1.  Setting up the Next.js project and installing shadcn/ui.
2.  Defining the Prisma schema and running the migration.
3.  Creating the authentication flow.
4.  Building the "Time Tracking" dashboard with the logic for calculating the balance.

Let's start with step 1 and 2. Output the code for the Prisma schema and the project structure setup.
