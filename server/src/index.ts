import { createServer } from "http";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import { initSocket } from "./config/socket.js";
import app from "./app.js";

const httpServer = createServer(app)
initSocket(httpServer)

httpServer.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`)
})

// graceful shutdown
process.on('SIGINT', async () => {
    await prisma.$disconnect()
    process.exit(0)
})