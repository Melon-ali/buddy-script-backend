import passport from "passport";
import { Strategy as GoogleStrategy, Profile } from "passport-google-oauth20";
import prisma from "../shared/prisma";
import { UserRole } from "@prisma/client";
import { hashPassword } from "../helpars/passwordHelpers";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      callbackURL: process.env.CALL_BACK_URL as string,
      passReqToCallback: true,
    },
    async (
      request: Express.Request,
      accessToken: string,
      refreshToken: string,
      profile: Profile,
      done: (error: any, user?: any) => void
    ) => {
      try {
        const email = profile.emails?.[0].value;
        if (!email) return done(new Error("No email from Google"));

        // Find existing user
        let user = await prisma.user.findUnique({ where: { email } });

        // If user doesn't exist, create new user
        if (!user) {
          user = await prisma.user.create({
            data: {
              email,
              username: profile.name?.givenName || "",
              phoneNumber: "",          // default value
              password: await hashPassword("password"),
              role: UserRole.USER,      // Default USER
              region: "",
              country: "",
              userStatus: "ACTIVE",
              status: "ACTIVE",
              fcmToken: "",
              image: profile.photos?.[0]?.value || "",
              isGoogleAuth: true,
              lastLogin: new Date(),
              // createdAt & updatedAt handled automatically
            },
          });
        } else {
          // Update lastLogin for existing user
          user = await prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() },
          });
        }

        // Safe user object to send to frontend
        const safeUser = {
          id: user.id,
          email: user.email,
          role: user.role,
          username: user.username,
          photo: user.image,
          userType: user.isGoogleAuth ? "GOOGLE" : "LOCAL",
        };

        return done(null, safeUser);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

export default passport;
