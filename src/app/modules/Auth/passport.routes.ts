import express from "express";
import passport from "../../../config/passport";
import { jwtHelpers } from "../../../helpars/jwtHelpers";

const router = express.Router();

interface GoogleUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  photo?: string | null;
  userType: string;
}

// Step 1: Redirect to Google login
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Step 2: Google callback
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  (req, res) => {
    const data = req.user as GoogleUser;

    const tokens = jwtHelpers.createToken(
      {
        id: data.id,
        email: data.email,
        name: `${data.firstName} ${data.lastName}`,
        role: data.role,         // ✅ role token এ আছে
        userType: data.userType, // ✅ userType token এ আছে
      },
      process.env.JWT_SECRET as string,
      process.env.EXPIRES_IN as string
    );

    // Redirect to frontend
    const frontendURL = process.env.FRONTEND_URL || "http://localhost:3000";
    res.redirect(
      `${frontendURL}/auth/login?` +
        `id=${data.id}&` +
        `firstName=${data.firstName}&` +
        `lastName=${data.lastName}&` +
        `role=${data.role}&` +         // ✅ role পাঠানো হলো
        `email=${data.email}&` +
        `userType=${data.userType}&` + // ✅ userType পাঠানো হলো
        `accessToken=${tokens}`
    );
  }
);

export default router;
