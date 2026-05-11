import { env } from "./config/env.js";
import express from "express";
import cors from "cors"

import { router } from './routes/index.js'
import { errorMiddleWare } from "./middleware/error.middleware.js";
import { notFoundMiddleWare } from "./middleware/notFound.middleware.js";

const app = express()

app.use(cors({
  origin: env.ALLOWED_ORIGINS,
  methods: env.ALLOWED_METHODS,
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))

app.use(express.json())
app.use(express.urlencoded({extended: true}))

app.use('/api', router)

app.use(notFoundMiddleWare)
app.use(errorMiddleWare)


export default app