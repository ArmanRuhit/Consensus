import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import { env } from "./env.js";

const initSocket = (httpServer: HttpServer) => {
    const io = new Server(httpServer, {
        cors: {
            origin: env.ALLOWED_ORIGINS,
            credentials: true
        }
    })

    io.on('connection', (socket) => {
        console.log(`Socket connected: ${socket.id}`)

        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${socket.id}`);
        })
    })

    return io
}

export { initSocket }