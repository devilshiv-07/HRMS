import bcrypt from "bcryptjs";
import prisma from "../prismaClient.js";
import {
  signAccessToken,
  signRefreshToken,
  saveRefreshToken,
} from "../utils/tokenUtils.js";
import jwt from "jsonwebtoken";

/**
 * LOGIN CONTROLLER — FINAL (OPTION A: TOKEN ONLY)
 */
export const login = async (req, res) => {
  try {
    const { email, password, loginType } = req.body;

    if (!email || !password || !loginType) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    if (!user.isActive) {
      return res.status(403).json({
        message: "Your account is disabled. Contact admin.",
      });
    }

    // Verify password
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ message: "Invalid credentials" });

    // ---------------------------------------
    // ROLE VALIDATION
    // ---------------------------------------
    if (loginType === "ADMIN" && user.role !== "ADMIN")
      return res.status(403).json({ message: "Unauthorized admin access" });

    if (loginType === "AGILITY" && user.role !== "AGILITY_EMPLOYEE")
      return res.status(403).json({ message: "Not an Agility AI employee" });

    if (loginType === "LYFSHILP" && user.role !== "LYF_EMPLOYEE")
      return res
        .status(403)
        .json({ message: "Not a Lyfshilp Academy employee" });

    // ---------------------------------------
    // TOKEN GENERATION (sub = userId)
    // ---------------------------------------
    const accessToken = signAccessToken(user.id);
    const refreshToken = signRefreshToken(user.id);

    // Store refresh token in DB (for revoke / security)
    await saveRefreshToken(refreshToken, user.id);

    // ---------------------------------------
    // RETURN BOTH TOKENS (NO COOKIES)
    // ---------------------------------------
    return res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        role: user.role,
      },
      accessToken,
      refreshToken,
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * REFRESH CONTROLLER — OPTION A (BODY TOKEN)
 */
export const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ message: "No refresh token" });
    }

    // Verify refresh token
    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const stored = await prisma.refreshToken.findFirst({
      where: { token: refreshToken, revoked: false },
    });

    if (!stored) {
      return res.status(401).json({ message: "Token revoked or not found" });
    }

    // Generate new access token
    const newAccessToken = signAccessToken(payload.sub);

    return res.json({ accessToken: newAccessToken });

  } catch (err) {
    console.error("REFRESH ERROR:", err);
    return res.status(500).json({ message: "Failed to refresh token" });
  }
};
