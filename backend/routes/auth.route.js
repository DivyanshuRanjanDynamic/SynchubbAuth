import express from "express";
import { deleteAccount, emailVerification, forgetPassword, loginUser, logoutUser, resetPassword, signup, updateProfile,privacypolicy } from "../controllers/auth.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";
import passport from "passport" ;

const router = express.Router();

router.post("/signup",signup);
router.get("/verify/:token",verifyJWT,emailVerification);
router.get("/forgetPassword",verifyJWT,forgetPassword);
router.get("/resetPassword",verifyJWT,resetPassword);
router.post("/login",loginUser);
router.post("/logout",verifyJWT,logoutUser);
router.post("/updateProfile",verifyJWT,updateProfile);
router.post("/deleteAccount",verifyJWT,deleteAccount);
router.get("/Home",(req,res)=>{
   res.json("You Are Inside The Home Page");
})


//Google Auth Route 
router.get("/google",(passport.authenticate("google", { scope: ["profile", "email"] })))
//Google Callback Route
router.get("/google/callback",
    passport.authenticate("google", {
    successRedirect: process.env.CLIENT_URL,//Redirect to Frontend
    failureRedirect: "/login",
  }))

//Github Auth Route
router.get("/github",passport.authenticate("github"))
//Github Callback Route
router.get("/github/callback",passport.authenticate("github", {
  successRedirect: process.env.CLIENT_URL,  // Redirect to frontend 
  failureRedirect: "/login",
}))


router.get("/privacypolicy",privacypolicy);



export default router;


