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

## API Endpoints

This application provides several REST API endpoints for document management and search functionality. Below are sample requests for each endpoint:

### Health Check

**GET** `/api/health`

Check if the API is running.

```bash
curl http://localhost:3000/api/health
```

Response:

```json
{
  "ok": true,
  "ts": "2024-01-15T10:30:00.000Z"
}
```

### Documents

**GET** `/api/documents`

Get all documents, ordered by creation date (newest first).

```bash
curl http://localhost:3000/api/documents
```

**POST** `/api/documents`

Create a document. This endpoint supports two modes:

1. **File Upload** (multipart/form-data) - Upload a file and create a document with text extraction (supports plain text and PDF files)
2. **Logical Document** (application/json) - Create a logical document without file upload

```bash
# Upload a text file
curl -X POST http://localhost:3000/api/documents \
  -F "file=@example.txt"

# Upload a PDF file
curl -X POST http://localhost:3000/api/documents \
  -F "file=@document.pdf"

# Create a logical document
curl -X POST http://localhost:3000/api/documents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Document",
    "mimeType": "text/plain",
    "sizeBytes": 1024
  }'
```

Response:

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "example.txt",
  "mimeType": "text/plain",
  "sizeBytes": 1024,
  "storageKey": "123e4567-e89b-12d3-a456-426614174000_example.txt",
  "version": 1,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### Document Search

**GET** `/api/documents/search`

Search across all documents for text content.

```bash
curl "http://localhost:3000/api/documents/search?q=search%20term&limit=10&offset=0"

# Or with simpler query
curl "http://localhost:3000/api/documents/search?q=hello"
```

### Document Operations

**PATCH** `/api/documents/{documentId}`

Edit a document's text content using position-based replacements.

```bash
curl -X PATCH http://localhost:3000/api/documents/62557b19-b120-4471-8fb3-97af0a8e9204 \
  -H "Content-Type: application/json" \
  -d '{
    "changes": [
      {
        "operation": "replace",
        "range": { "start": 10, "end": 20 },
        "text": "new content"
      }
    ]
  }'
```

Response:

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "version": 2,
  "updatedText": "...",
  "changesApplied": 1
}
```

### Document-Specific Search

**GET** `/api/documents/{documentId}/search`

Search within a specific document.

```bash
curl "http://localhost:3000/api/documents/123e4567-e89b-12d3-a456-426614174000/search?q=search%20term&limit=25&offset=0"

curl "http://localhost:3000/api/documents/62557b19-b120-4471-8fb3-97af0a8e9204/search?q=search%20term&limit=25&offset=0"

# Or with simpler query
curl "http://localhost:3000/api/documents/123e4567-e89b-12d3-a456-426614174000/search?q=hello"
```

### Response Format Notes

- All search endpoints return results with pagination support
- Document IDs are UUIDs
- File uploads support automatic text extraction for plain text and PDF files
- Document editing uses position-based replacements applied right-to-left to maintain index stability
- All timestamps are in ISO 8601 format
