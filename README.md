This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Database Setup

This project uses PostgreSQL with Prisma as the ORM. Follow these steps to set up your database:

### 1. Install and Start PostgreSQL

Make sure you have PostgreSQL installed and running on your system.

**On macOS (using Homebrew):**

```bash
brew install postgresql
brew services start postgresql
```

**On Ubuntu/Debian:**

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**On Windows:**
Download and install from [postgresql.org](https://www.postgresql.org/download/windows/)

### 2. Create a Database

Connect to PostgreSQL and create a database for the project:

```bash
# Connect to PostgreSQL (default user is usually 'postgres')
psql -U postgres

# Create a database (replace 'sandstone_db' with your preferred name)
CREATE DATABASE sandstone_db;

# Exit PostgreSQL
\q
```

### 3. Set Environment Variables

Create a `.env` file in the root directory and add your database connection string:

```bash
# .env
DATABASE_URL="postgresql://username:password@localhost:5432/sandstone_db"
```

Replace:

- `username` with your PostgreSQL username (often `postgres`)
- `password` with your PostgreSQL password
- `sandstone_db` with your database name

### 4. Run Prisma Commands

Initialize and set up your database schema:

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# (Optional) Seed your database if you have seed data
npx prisma db seed
```

### 5. Verify Database Setup

You can view your database in Prisma Studio:

```bash
npx prisma studio
```

This will open a web interface at `http://localhost:5555` where you can view and edit your data.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
