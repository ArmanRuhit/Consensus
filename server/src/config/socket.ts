import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import { env } from "./env.js";

let io: Server | null = null;

const initSocket = (httpServer: HttpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: env.ALLOWED_ORIGINS,
            credentials: true
        }
    })

    io.on('connection', (socket) => {
        console.log(`Socket connected: ${socket.id}`)

        socket.on('poll:join', (pollId: string) => {
            socket.join(`poll:${pollId}`);
            console.log(`Socket ${socket.id} joined poll:${pollId}`);
        })

        socket.on('poll:leave', (pollId: string) => {
            socket.leave(`poll:${pollId}`);
            console.log(`Socket ${socket.id} left poll:${pollId}`);
        })

        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${socket.id}`);
        })
    })

    return io
}

const getIO = () => {
    if (!io) throw new Error("Socket.io not initialized");
    return io;
};

export { initSocket, getIO };
