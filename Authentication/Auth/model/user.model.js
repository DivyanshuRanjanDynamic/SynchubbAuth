import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const userSchema= new mongoose.Schema( {
username:
{

    type:String,
    required:true,
    unique:true,
    lowercase:true,
    trim:true,
    index:true
},
password: { 
    type: String, 
    required: function () { return !this.googleId && !this.githubId; } // Only required for local users 
  },
  googleId: { type: String, default: null, sparse: true }, // Now optional for non-Google users
  githubId: { type: String, default: null , sparse: true}, // Now optional for non-GitHub users

 email:{
    type:String,
    required:true,
    unique:true
 },

refreshToken:
{
    type:String, 
},
isVerified:{
    type:Boolean,
    default:false
},
role:
{
    type:String,
    enum:["user","admin"],
    default:"user"
},
resetPasswordToken:
{
    type:String,
},
resetPasswordExpireAt:
{
    type:Date,
}
}, {timestamps:true} );
    // this give us two fields createdAt and updatedAt  automatically


//Before saving the user data in db firstly hash the password using bcript.Use "pre" keyword to make changes on user  before saving it.
//hasing of data took time thats why we use async function
userSchema.pre('save', function(next) {
    if (!this.password) return next(); // ✅ Avoid hashing if password is missing

    if ( this.isModified && this.isModified('password')) {
        this.password = bcrypt.hashSync(this.password, 10);
    }
    next();
});
// now we will sucessfully able to hash the password whenever we make update on it .

//now compare the hash password with real password
userSchema.methods.comparePassword = async function(password) {
    if (!password) {
        throw new Error("Entered password is undefined");
    }
    return await bcrypt.compare(password, this.password);
}



// generating the Access token 

userSchema.methods.generateAccessToken = async function() {
    const token = jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username,
            role: this.role
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    );
    return token;
}
//generating the Refresh Token 
userSchema.methods.generateRefreshToken = function(){
    const token = jwt.sign(
        {
            _id: this._id,
            
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
    return token
}

/*
How They Work Together:
User logs in → Receives Access Token + Refresh Token.
Access token is used for API calls.
When the access token expires, the refresh token is sent to get a new one.
A new access token is issued, and the cycle repeats.
If the refresh token expires, the user must log in again.

Refresh Token :-it is Used to obtain a new access token when the current one expires.
              :-Long-lived (days to weeks) to reduce frequent logins.
              :-Stored securely in an HTTP-only cookie.
              :-If stolen, it can be used to generate new access tokens, leading to prolonged unauthorized access.
Access Token :-Short-lived (minutes to hours) to minimize damage if stolen.
              :-Sent with every API request.
              :-Stored in memory or local storage.
              :-If stolen, it can only be used for a limited time.
*/        
export const User =mongoose.model("User",userSchema);   

