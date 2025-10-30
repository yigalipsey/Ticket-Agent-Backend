// backend/src/config/session.js

const isProduction = process.env.NODE_ENV === "production";

export const sessionConfig = {
  cookieOptions: {
    httpOnly: true, // מונע גישה מ-JS בצד לקוח (הגנה מ-XSS)
    secure: isProduction, // בפרודקשן חובה Secure=true
    sameSite: isProduction ? "none" : "lax", // פרוד: cross-site, פיתוח: same-site
    ...(isProduction && {
      domain: process.env.COOKIE_DOMAIN || ".ticketagent.co.il", // פרוד: לכל הסאב-דומיינים
    }),
    maxAge: 60 * 60 * 24 * 7 * 1000, // זמן חיים של שבוע (במילישניות)
    path: "/", // נשלח לכל הנתיבים באתר
  },
  get jwtSecret() {
    return process.env.JWT_SECRET;
  },
};

// דינמי לפי תפקיד - מחזיר קונפיג מותאם לכל תפקיד
export const getSessionConfig = (role = "agent") => ({
  cookieName: `${role}_auth_token`,
  jwtSecret: sessionConfig.jwtSecret,
  cookieOptions: sessionConfig.cookieOptions,
});

// Helper functions לכל תפקיד
export const getAgentSessionConfig = () => getSessionConfig("agent");
export const getUserSessionConfig = () => getSessionConfig("user");
export const getAdminSessionConfig = () => getSessionConfig("admin");
export const getSuperAdminSessionConfig = () => getSessionConfig("super-admin");
