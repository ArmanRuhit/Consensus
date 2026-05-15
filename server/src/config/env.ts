import 'dotenv/config'

const env = {
  PORT: process.env.PORT ?? '3000',
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:5173'],
  ALLOWED_METHODS: process.env.ALLOWED_METHODS?.split(',') ?? ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://user:password@localhost:5432/mydb',
  JWT_SECRET: process.env.JWT_SECRET
}

export { env }