import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

export default {
  env: process.env.NODE_ENV,
  google_client_id: process.env.GOOGLE_CLIENT_ID,
  google_client_secret: process.env.GOOGLE_CLIENT_SECRET,
  call_back_url: process.env.CALL_BACK_URL,
  frontend_url: process.env.FRONTEND_URL,
  stripe_key: process.env.STRIPE_SECRET_KEY,
  port: process.env.PORT,
  bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS,
  jwt: {
    jwt_secret: process.env.JWT_SECRET,
    expires_in: process.env.EXPIRES_IN,
    refresh_token_secret: process.env.REFRESH_TOKEN_SECRET,
    refresh_token_expires_in: process.env.REFRESH_TOKEN_EXPIRES_IN,
    reset_pass_secret: process.env.RESET_PASS_TOKEN,
    reset_pass_token_expires_in: process.env.RESET_PASS_TOKEN_EXPIRES_IN,
  },
  reset_pass_link: process.env.RESET_PASS_LINK,
  emailSender: {
    email: process.env.EMAIL,
    app_pass: process.env.APP_PASS,
  },
  brevoMail: {
    api_key: process.env.BREVO_API_KEY,
    email: process.env.BREVO_EMAIL,
    sender_name: process.env.BREVO_SENDER_NAME,
  },
  password: {
    password_salt: process.env.BCRYPT_SALT_ROUNDS,
  },
};
