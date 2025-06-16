import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";
import dotenv from "dotenv";
import { User } from "./model/user.model.js";

dotenv.config();

// Using Passport for Google Authentication
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: `${process.env.SERVER_URL}/auth/google/callback`,
            proxy: true
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                console.log('Google OAuth profile:', {
                    id: profile.id,
                    email: profile.emails?.[0]?.value,
                    displayName: profile.displayName
                });

                let user = await User.findOne({ googleId: profile.id });

                if (!user) {
                    // Check if user exists with the same email
                    const existingUser = await User.findOne({ email: profile.emails[0].value });
                    if (existingUser) {
                        // Link Google account to existing user
                        existingUser.googleId = profile.id;
                        if (!existingUser.profilePic) {
                            existingUser.profilePic = profile.photos?.[0]?.value || "";
                        }
                        await existingUser.save();
                        return done(null, existingUser);
                    }

                    // Create new user
                    user = new User({
                        googleId: profile.id,
                        email: profile.emails[0].value,
                        username: profile.displayName,
                        profilePic: profile.photos?.[0]?.value || "",
                        isVerified: true,
                    });
                    await user.save();
                    console.log('Created new user from Google OAuth:', user.email);
                }

                return done(null, user);
            } catch (error) {
                console.error('Google OAuth error:', error);
                return done(error, null);
            }
        }
    )
);

// Using Passport for GitHub Authentication
passport.use(
    new GitHubStrategy(
        {
            clientID: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
            callbackURL: `${process.env.SERVER_URL}/auth/github/callback`,
            proxy: true,
            scope: ["user:email"]
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                console.log('GitHub OAuth profile:', {
                    id: profile.id,
                    username: profile.username,
                    email: profile.emails?.[0]?.value
                });

                let user = await User.findOne({ githubId: profile.id });

                if (!user) {
                    // Check if user exists with the same email
                    const email = profile.emails?.[0]?.value;
                    if (email) {
                        const existingUser = await User.findOne({ email });
                        if (existingUser) {
                            // Link GitHub account to existing user
                            existingUser.githubId = profile.id;
                            if (!existingUser.profilePic) {
                                existingUser.profilePic = profile.photos?.[0]?.value || "";
                            }
                            await existingUser.save();
                            return done(null, existingUser);
                        }
                    }

                    // Create new user
                    user = new User({
                        githubId: profile.id,
                        username: profile.username,
                        email: profile.emails?.[0]?.value || "",
                        profilePic: profile.photos?.[0]?.value || "",
                        isVerified: true,
                    });
                    await user.save();
                    console.log('Created new user from GitHub OAuth:', user.email);
                }

                return done(null, user);
            } catch (error) {
                console.error('GitHub OAuth error:', error);
                return done(error, null);
            }
        }
    )
);

// Serialize and deserialize user
passport.serializeUser((user, done) => {
    console.log('Serializing user:', user.id);
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        console.log('Deserializing user:', id);
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        console.error('Deserialize error:', error);
        done(error, null);
    }
});

export default passport;