import express from 'express';
import authRoutes from './backend/routes/auth.route.js';
import cors from "cors";
import cookieParser from 'cookie-parser';
import session from 'express-session';
export const  app = express();
import  passport  from './backend/passport.js';

app.use(express.json()); //middleware that allow us to parse the incoming request:  req.body .it also enables json parsing 
app.use(express.urlencoded({extended:true}));// to enable parsing on form data


const corsOptions = {
    origin: process.env.CLIENT_URL,
    credentials: true
};
app.use(cors(corsOptions));
app.use(cookieParser());// the cookieParser() middleware allows the server to read cookies from the client side (by parsing them) so that we can access and use them in our server-side logic. 
 app.use(
     session({
        secret: process.env.SESSION_SECRET || 'secret',
         resave: false,
         saveUninitialized: true,
         cookie :{
            secure:false
         }
     })
 )

// Add global error handler to app.js
app.use(async (err, req, res, next) => {
    console.error('Error Stack:', err.stack);
    console.error('Request Method:', req.method);
    console.error('Request URL:', req.url);
    console.error('Session State:', JSON.stringify(req.session));
    
    res.status(err.status || 500).json({
        error: {
            status: err.status || 500,
            message: err.message || 'Internal Server Error'
        },
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});


app.use(passport.initialize());
app.use(passport.session());
app.use("/api/auth",authRoutes);

