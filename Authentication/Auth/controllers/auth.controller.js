import { asynchandler } from "../utils/asynchandler.js";
import { User } from "../model/user.model.js";
import ApiResponse from "../utils/apiResponse.js";
import ApiError from "../utils/apiError.js";
import validator from "validator";
import zxcvbn from "zxcvbn";
import crypto from "crypto";
import { transporter } from "../utils/mailer.js";
import jwt from "jsonwebtoken";

// Generate Access token and Refresh Token
const generateAccessTokenAndRefreshToken = async (userId) => {
    try {
        const user = await User.findOne({ _id: userId });
        if (!user) throw new ApiError(404, "User not found");
        
        const refreshToken = user.generateRefreshToken();
        const accessToken = user.generateAccessToken();
        
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });
        
        return { refreshToken, accessToken };
    } catch (error) {
        throw new ApiError(500, "Something Went Wrong in Generating Tokens");
    }
};

export const signup = asynchandler(async (req, res) => {
    try {
        const { email, password, username } = req.body;
        
        // Validate required fields
        if ([email, password, username].some(field => !field?.trim())) {
            throw new ApiError(400, "Please Fill all the fields");
        }

        // Email validation
        if (!validator.isEmail(email)) {
            throw new ApiError(400, "Please Enter Valid Email Address");
        }

        // Check existing user
        const existingUser = await User.findOne({
            $or: [{ email }, { username }]
        });

        if (existingUser) {
            throw new ApiError(409, "User already exists");
        }

        // Password strength checking
        const isPasswordStrong = zxcvbn(password);
        if (isPasswordStrong.score < 3) {
            const suggestedPassword = crypto.randomBytes(16).toString('hex');
            return res.status(400).json(new ApiResponse(
                400, 
                "Password is weak!", 
                { suggestedPassword }
            ));
        }

        // Create user
        const user = await User.create({
            username: username.toLowerCase(),
            email,
            password
        });

        // Generate tokens
        const { accessToken } = await generateAccessTokenAndRefreshToken(user._id);

        // Send verification email
        const mailOptions = {
            from: process.env.EMAIL,
            to: user.email,
            subject: "Account Verification Token",
            text: `${process.env.CLIENT_URL}/api/auth/verify/:${accessToken}`
        };
        console.log(accessToken);
        await transporter.sendMail(mailOptions);

        // Return response
        return res.status(201).json(
            new ApiResponse(
                200, 
                null,
                "User Registered Successfully. Please check your email to verify your account."
            )
        );
    } catch (error) {
        console.error("Error in signup:", error.message);
        throw new ApiError(500, error.message);
    }
});

export const emailVerification = asynchandler(async (req, res) => {
    try {
        const {token}  = req.params;
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Token is required'
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        const email = decoded.email;

        // Update user verification status
        const user = await User.findOneAndUpdate(
            { email },
            { isVerified: true },
            { new: true }
        );

        if (!user) {
            throw new ApiError(400, "Invalid token");
        }

        return res.status(200).json(new ApiResponse(
            200,
            null,
            "Email Verified Successfully"
        ));
    } catch (error) {
        console.error(error);
        throw new ApiError(500,error.message);
    }
});

//forget password 
 export const forgetPassword=asynchandler(async(req,res)=>
    {
     try {
             const {email}=req.body
             const user=await User.findOne({email}).select("-password -refreshToken ")
             if(!user)
             {
               throw new ApiError(400,"Invalid Email")
             }
             //geterate the token using generateAccessTokenAndRefreshToken 
             const {refreshToken}=await generateAccessTokenAndRefreshToken(user._id)
             //update the user schema
             user.refreshToken=refreshToken
             await user.save({validateBeforeSave:false})
       
             //send the email to the user with reset link 
             const resetLink=`http://localhost:${process.env.PORT}/api/auth/resetPassword/${refreshToken}`;
             console.log("RedreshToken:",refreshToken);
             await transporter.sendMail(
               {
                   from:process.env.EMAIL,
                   to:email,
                   subject:"Reset your password",
                   text:`Please click  on this link to reset your password,Link is -> ${resetLink}`
               }
             )
             const option={
                httpOnly:true
                ,secure:true
             }
             return res.status(200).cookie("refreshToken",refreshToken,option).json( new ApiResponse("PaSssword Reset Email Sent Sucessfully"))
     }
      catch (error) {
        return res.status(500).json(new ApiError(500,"Something Went wrong in sending the email"))
        
     }
    
    })
    //reset password or change password

export const resetPassword=asynchandler(async(req,res)=>
    {
    try {
        const {previousPassword,newPassword,confirmPassword}=req.body
        if(!previousPassword)
        {
            throw new ApiError(400,"Please fill all fields")
        }
        console.log("provious Passwors",previousPassword)
          const user =await User.findById(req.user._id).select("+password ");
          if (!user) {
            throw new ApiError(404, "User not found");
        }
        console.log("userPassword:",user.password);
         if (!user.password) {
             throw new ApiError(400, "User password is missing");
         }

          const isPasswordCorrect= await user.comparePassword(previousPassword)
          if(!isPasswordCorrect)
          {
            throw new ApiError(400,"Unauthorized user")
          }
          if(!newPassword||!confirmPassword)
          {
            throw new ApiError(400,"Please fill both fields ")
          }
          if(newPassword != confirmPassword)
          {
            throw new ApiError(400,"Passwords do not match")
          }
        //update in database 
        user.password=newPassword
         await user.save({validateBeforeSave:false})
        
        res.status(200).json(
            new ApiResponse(200,"Password Updated Successfully",user)
        )
    } catch (error) {
        throw new ApiError(500,error.message)
    }
    }
    )
//login

export const loginUser = asynchandler(async(req,res)=>
    {
        //get the information of user -> username or email and password 
        const {username, email, password} = req.body;
    //check on the database
        if(!(username || email)){
            throw new ApiError(400, "Please enter either username or email")
        }
     //check in  the database that a user present in the database or not with username or email
    const user =await User.findOne({
        $or: [{username}, {email}],//$or is one of the keyword provided by the mongoDb
    })
    if(!user){
        throw new ApiError(401, "Invalid username or email")
    }
     //password check
    
    const isPasswordValid= await user.comparePassword(password);
    if(!isPasswordValid){
        throw new ApiError(401, "Invalid password")
    }
    
     //generate the Access and refresh  token 
    const {refreshToken,accessToken}= await generateAccessTokenAndRefreshToken(user._id);
    
    // if( user.istwoFactorEnabled){
    //   // Store partially authenticated status in session
    //   req.session.username = username;
    //    req.session.isAuthenticated=false;// Not fully authenticated until 2FA is verified
    
    //    //redirect the 2Fa verification page
    //    res.redirect('/verify2FA');
    // }
    // else{
    const userLoggedIn=await User.findById(user._id).select("-password -refreshToken");
        //send cookies===== Remember always send refressToken and access token via cookies that are provided by cookieParser
    
    
        
        const option = {
            httpOnly: true,
            secure: true
        }
    
        return res.status(200).cookie("accessToken",accessToken,option).cookie("refressToken",refreshToken,option).json(
            new ApiResponse(
                200,
              {
                userLoggedIn,
                accessToken,
                refreshToken
              }  ,
               ` User Login Sucessfully`)
        )
    }
    
)
    
    //logout
    
   export  const logoutUser=asynchandler(async (req,res)=>
    {
       //here the most important problem is that we donot have the access of user who was logged in and we will solve that problem by adding middleware in the loggedout route 
         await User.findByIdAndUpdate(req.user._id,
            {
               $unset:
               {
                refreshToken:1  //this will  be the token from the field 
               }
            },
            {
               new:true
            }
         )
    
         const option={
            httpOnly:true,
            secure:true
         }
         return res.status(200).cookie("accessToken","",option).cookie("refreshToken","",option).json(new ApiResponse(200, {}, "User logged Out"))
    })

//update user profile
 export const updateProfile=asynchandler(async(req,res)=>
    {
        const {newUsername}=req.body
        if(!newUsername)
        {
            throw new ApiError(400,"Update the field")
        }
        const user=await User.findById(req.user._id).select("-password -refreshToken")
        if(!user)
        {
            throw new ApiError(400,"User not found ")
        }
         user.username=newUsername
       
         user.save({validationBeforeSave:false})
    
         return res.status(200).json(new ApiResponse(201,user,"Your profile Updatrd  sucessfully !!"))
    })
//delete user account

export const deleteAccount=asynchandler(async(req,res)=>
    {
       try {
         const {password}=req.body
         if(!password)
         {
             throw new ApiError(400,"Please enter your password")
         }
         const user=await User.findById(req.user._id)
         if(!user)
         {
             throw new ApiError(400,"Unothorized User")
         }
         const isMatch=user.comparePassword(password)
         if(!isMatch)
         {
             throw new ApiError(400,"Please enter a valid password")
         }
         await User.findByIdAndDelete(req.user._id);
         
         return res.status(200).json(new ApiResponse("Account deleted successfully"))
       } 
       catch (error) {
        throw new ApiError(500,error.message)
       }
    })
    
//refresh  access token  so that by using refress token only  we will login and perform different actions 

// export const refreshAccessToken=asynchandler(async(req,res)=>
//     {  
//              //get the  password as token from user
       
//          const getrefressTokenByuser=req.cookies.refreshToken || req.body.refreshToken
     
//          if (!getrefressTokenByuser) {
//              throw new ApiError(401, "unauthorized request")
//          }
     
//             //decode that refresh token and extact payload from it 
     
//             const decode=jwt.verify(getrefressTokenByuser,process.env.REFRESS_TOKEN)
     
//            //using that payload find the user from the database
//              const user=await User.findById(decode?._id)
//              if(!user){
//                throw  new ApiError(401,"Invalid Refress Token")
//              }
     
//              const {accessToken,refreshToken}=await generateAccessTokenAndRefreshToken(user._id)
     
//                 if(user?.refreshToken !== getrefressTokenByuser){
//                 throw  new ApiError(401,"Invalid Refresh Token")
//                 }
//            const option={
//              httpOnly:true,
//              secure:true
//           }
     
//           return res.status(200).cookie("accessToken",accessToken,option).cookie("refreshToken",refreshToken,option).json(
//                  new ApiResponse(200,"Your AccessToken refressed Now!!",{
//                      accessToken:accessToken,
//                      refreshToken:refreshToken
//                  })
//           )//

//        } 
//     )
  


//privacy policy

export  const privacypolicy = asynchandler((req,res)=>
{
    res.sendFile(path.join(__dirname, "public", "privacypolicy.html"));
})
    
