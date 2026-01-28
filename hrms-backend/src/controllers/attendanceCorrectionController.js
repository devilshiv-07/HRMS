import prisma from "../prismaClient.js";
import { emitToAdmins, emitToUser } from "../socket/socketServer.js";

export const requestPresentCorrection = async (req, res) => {
  const userId = req.user.id;
  const { date, reason, checkInTime, checkOutTime, witnessId, witness } = req.body;

  // Reason is optional; date, times and a witness are required
  if (!date || !checkInTime || !checkOutTime || (!witnessId && !witness)) {
    return res.status(400).json({ message: "Date, times and witness are required" });
  }

  const [y, m, d] = date.split("-").map(Number);
  // 🔥 PURE DATE (no timezone shift)
  const day = new Date(Date.UTC(y, m - 1, d));

  // Build check-in and check-out DateTimes (UTC from local HH:mm)
  const [ciH, ciM] = checkInTime.split(":").map(Number);
  const [coH, coM] = checkOutTime.split(":").map(Number);

  const checkIn = new Date(Date.UTC(y, m - 1, d, ciH || 0, ciM || 0));
  const checkOut = new Date(Date.UTC(y, m - 1, d, coH || 0, coM || 0));

  if (checkOut <= checkIn) {
    return res.status(400).json({ message: "Checkout time must be after check-in time" });
  }

  // Check attendance is ABSENT or missing
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);

  const end = new Date(day);
  end.setHours(23, 59, 59, 999);

  const attendance = await prisma.attendance.findFirst({
    where: {
      userId,
      date: {
        gte: start,
        lte: end,
      },
    },
  });

  if (attendance && attendance.status !== "ABSENT") {
    return res.status(400).json({
      message: "Attendance is not absent for this date",
    });
  }

  // Resolve witness name (prefer userId if provided)
  let witnessName = witness || "";
  if (witnessId) {
    const witnessUser = await prisma.user.findFirst({
      where: { id: witnessId, isActive: true },
      select: { firstName: true, lastName: true },
    });
    if (!witnessUser) {
      return res.status(400).json({ message: "Selected witness is invalid" });
    }
    witnessName = `${witnessUser.firstName} ${witnessUser.lastName || ""}`.trim();
  }

  const reqEntry = await prisma.attendanceCorrection.create({
    data: {
      userId,
      date: day,
      reason,
      checkIn,
      checkOut,
      witness: witnessName,
    },
  });

  // Notify admins in real-time via notifications + socket
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { id: true },
  });
  const adminIds = admins.map((a) => a.id);

  if (adminIds.length > 0) {
    await prisma.notification.createMany({
      data: adminIds.map((id) => ({
        userId: id,
        title: "Attendance Correction Request",
        body: `Employee requested to cancel leave on ${date}`,
        meta: {
          type: "attendance_correction",
          correctionId: reqEntry.id,
          date,
          userId,
        },
      })),
    });
    emitToAdmins("notification_created", {
      scope: "ATTENDANCE_CORRECTION",
      title: "Attendance Correction Request",
      body: `Employee requested to cancel leave on ${date}`,
    });
  }

  return res.json({
    success: true,
    message: "Present request sent successfully",
    request: reqEntry,
  });
};


export const getAllAttendanceCorrections = async (req, res) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Admin only" });
  }

  const list = await prisma.attendanceCorrection.findMany({
    where: { status: "PENDING" },
    include: { user: true },
    orderBy: { createdAt: "desc" }
  });

  res.json({ success: true, data: list });
};


export const decideAttendanceCorrection = async (req, res) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Admin only" });
  }

  const { id, action, reason } = req.body;

  const reqItem = await prisma.attendanceCorrection.findUnique({
    where: { id },
  });

  if (!reqItem || reqItem.status !== "PENDING") {
    return res.status(400).json({ message: "Invalid request" });
  }

  if (action === "APPROVE") {
    // 1️⃣ create or update attendance with provided times
    await prisma.attendance.upsert({
      where: {
        userId_date: {
          userId: reqItem.userId,
          date: reqItem.date,
        },
      },
      update: {
        status: "PRESENT",
        checkIn: reqItem.checkIn,
        checkOut: reqItem.checkOut,
      },
      create: {
        userId: reqItem.userId,
        date: reqItem.date,
        status: "PRESENT",
        checkIn: reqItem.checkIn,
        checkOut: reqItem.checkOut,
      },
    });

    // 2️⃣ cancel any single-day leave on that date and restore balance if needed
    const leaves = await prisma.leave.findMany({
      where: {
        userId: reqItem.userId,
        startDate: reqItem.date,
        endDate: reqItem.date,
        status: { in: ["PENDING", "APPROVED"] },
        isAdminDeleted: false,
        isEmployeeDeleted: false,
      },
    });

    for (const leave of leaves) {
      if (
        leave.status === "APPROVED" &&
        !["WFH", "UNPAID", "COMP_OFF"].includes(leave.type)
      ) {
        // single day → increment balance back by 1
        await prisma.user.update({
          where: { id: leave.userId },
          data: {
            leaveBalance: { increment: 1 },
          },
        });
      }

      await prisma.leave.update({
        where: { id: leave.id },
        data: {
          status: "REJECTED",
          rejectReason:
            reason || "Leave cancelled due to attendance correction approval",
        },
      });
    }
  }

  const updatedReq = await prisma.attendanceCorrection.update({
    where: { id },
    data: {
      status: action === "APPROVE" ? "APPROVED" : "REJECTED",
      adminReason: reason || null,
      decidedAt: new Date(),
    },
  });

  // Notify employee about decision
  await prisma.notification.create({
    data: {
      userId: updatedReq.userId,
      title: "Attendance Correction Decision",
      body: `Your attendance correction request for ${updatedReq.date.toISOString().slice(0, 10)} has been ${action.toLowerCase()}`,
      meta: {
        type: "attendance_correction_decision",
        correctionId: updatedReq.id,
        action,
      },
    },
  });

  emitToUser(updatedReq.userId, "notification_created", {
    scope: "ATTENDANCE_CORRECTION_DECISION",
    title: "Attendance Correction Decision",
    body: `Your attendance correction request has been ${action.toLowerCase()}`,
  });

  res.json({
    success: true,
    message: `Request ${action.toLowerCase()}`,
  });
};
