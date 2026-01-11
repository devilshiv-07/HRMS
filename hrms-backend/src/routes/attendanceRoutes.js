import { Router } from "express";

import {
  checkIn,
  checkOut,
  getMyAttendance,
  getAllAttendance,
  getAttendanceForUser,
  getUserMonthlyLogs,
  deleteAttendance,
  decideHalfDay,
  exportAttendance
} from "../controllers/attendanceController.js";

import { requireAuth } from "../middlewares/auth.js";

const router = Router();

/* =======================================================
   AUTH GUARD - All attendance routes require login
======================================================= */
router.use(requireAuth(["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]));

/* =======================================================
   🟢 DEBUG ENDPOINT (Temporary - Remove in production)
======================================================= */
router.get(
  "/debug/my-records",
  requireAuth(["AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
  async (req, res) => {
    try {
      const prisma = (await import("../prismaClient.js")).default;
      
      // Helper function
      const toLocalISO = (date) => {
        const d = new Date(date);
        return (
          d.getFullYear() +
          "-" +
          String(d.getMonth() + 1).padStart(2, "0") +
          "-" +
          String(d.getDate()).padStart(2, "0")
        );
      };
      
      const records = await prisma.attendance.findMany({
        where: { userId: req.user.id },
        orderBy: { date: "desc" },
        take: 20
      });
      
      res.json({
        success: true,
        userId: req.user.id,
        totalRecords: records.length,
        records: records.map(r => ({
          id: r.id,
          rawDate: r.date,
          dateISO: toLocalISO(r.date),
          checkIn: r.checkIn,
          checkOut: r.checkOut,
          status: r.status
        }))
      });
    } catch (err) {
      console.error("[DEBUG ERROR]", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

/* =======================================================
   🟢 EMPLOYEE ROUTES
======================================================= */

// Check-in
router.post(
  "/checkin",
  requireAuth(["AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
  checkIn
);

// Check-out
router.post(
  "/checkout",
  requireAuth(["AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
  checkOut
);

// Get my attendance (with date range)
router.get(
  "/me",
  requireAuth(["AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
  getMyAttendance
);

/* =======================================================
   🔴 ADMIN ROUTES
======================================================= */

// Get all attendance (with filters)
router.get(
  "/all",
  requireAuth(["ADMIN"]),
  getAllAttendance
);

// Get attendance for specific user
router.get(
  "/user/:userId",
  requireAuth(["ADMIN"]),
  getAttendanceForUser
);

// Get user monthly logs
router.get(
  "/user/:userId/month",
  requireAuth(["ADMIN"]),
  getUserMonthlyLogs
);

// Delete attendance record
router.delete(
  "/:id",
  requireAuth(["ADMIN"]),
  deleteAttendance
);

router.post(
  "/half-day/decision",
  requireAuth(["ADMIN"]),
  decideHalfDay
);

/* =======================================================
   🟣 EXPORT (Both admin & employee)
======================================================= */
router.get(
  "/export",
  requireAuth(["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
  exportAttendance
);

export default router;