import { env } from './configs/env.js'; // FIRST — validates all env vars before anything else loads
import express from 'express'
import cors from 'cors'
import userRouter from './routes/userRoutes.js';
import connectDB from './configs/mongodb.js';
import imageRouter from './routes/imageRoutes.js';
import { notFound, errorHandler } from './middlewares/errorHandler.js';

// App Config
const PORT = env.PORT
const app = express();

try {
    await connectDB()
} catch (error) {
    console.error('Failed to connect to MongoDB:', error.message);
    process.exit(1);
}

// Intialize Middlewares
app.use(express.json())
app.use(cors())

// API routes
app.use('/api/user',userRouter)
app.use('/api/image',imageRouter)

app.get('/', (req,res) => res.send("API Working"))

// No route matched -> 404 JSON
app.use(notFound)

// The one error handler. Must be last, must take 4 args.
app.use(errorHandler)

const server = app.listen(PORT, () => console.log('Server running on port ' + PORT));

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Set a different PORT in server/.env or stop the process using it.`);
        process.exit(1);
    }

    throw error;
})
