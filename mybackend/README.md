QuizGen backend

Quick start

1. Copy the example env file and edit values:

    - On Windows (PowerShell):
       copy .env.example .env

    - For local development the default uses SQLite. To use a different database (Postgres, MySQL), set `DATABASE_URL` in `.env` accordingly.

    - Example Postgres connection string (replace placeholders):

       DATABASE_URL=postgresql://<username>:<password>@<host>:<port>/<dbname>?schema=public

2. Install dependencies, generate Prisma client and run migrations, then start the server:

   ```powershell
   cd mybackend
   npm install
   npx prisma generate
   npx prisma migrate dev --name init
   npm start
   ```

3. Environment variables:

   - `DATABASE_URL` - the SQL connection string (SQLite for dev or Postgres for production)
   - `JWT_SECRET` - a secure random string used to sign JWT tokens
   - `PORT` - optional, default 4000

4. Health check: After starting, open http://localhost:4000/ to see the backend message.

If you only have Atlas login credentials (username/password), follow these steps in Atlas:

- Go to Network Access -> IP Access List and add your IP (or 0.0.0.0/0 for testing, not recommended for production).
- Go to Database Access -> Create Database User, set a username and password and give proper roles.
- Go to Clusters -> Connect -> Connect your application -> copy the provided connection string and replace `<password>` with the user's password.

Security notes

- Do not commit `.env` to version control.
- Use a strong `JWT_SECRET` in production and rotate periodically.
- Consider using HTTP-only cookies for auth tokens in production.
