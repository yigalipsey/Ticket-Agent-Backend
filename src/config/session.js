// backend/src/config/session.js

export const sessionConfig = {
  cookieOptions: {
    httpOnly: true, // מונע גישה מ-JS בצד לקוח (הגנה מ-XSS)
    // בפרודקשן עם סאב-דומיינים נדרש SameSite=None ו-Secure כדי לאפשר שליחה בבקשות cross-site
    secure: true, // חובה בפרודקשן עם SameSite: "none"
    sameSite: "none", // מאפשר שליחה גם בבקשות cross-site
    domain: process.env.COOKIE_DOMAIN || ".ticketagent.co.il", // מאפשר שליחה לכל הסאב-דומיינים
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
