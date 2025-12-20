import { isManagerOfEmployee } from "../utils/managerUtils.js";

export const requireManagerOrAdmin = async (req, res, next) => {
  // ADMIN → full access
  if (req.user.role === "ADMIN") return next();

  const targetUserId =
    req.params.userId ||
    req.body.userId ||
    req.body.employeeId;

  if (!targetUserId) {
    return res.status(400).json({
      success: false,
      message: "Target employee missing"
    });
  }

  const allowed = await isManagerOfEmployee(
    req.user.id,
    targetUserId
  );

  if (!allowed) {
    return res.status(403).json({
      success: false,
      message: "Manager access denied"
    });
  }

  next();
};
