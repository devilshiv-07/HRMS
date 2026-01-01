import prisma from "../prismaClient.js";

/* ==================== Helper ==================== */
const calcDays = (start, end) =>
  Math.floor((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24)) + 1;

/* ===================== COMMON RULES ===================== */
// 1. Comp-off leave apply only if balance >= required
// 2. On final approval → Balance deduct
// 3. Admin can grant manual comp-off (extra work)
// 4. Attendance Weekly-Off present → auto grant (already integrated earlier)

/* ------------------------------------------------------------------
   1️⃣ Employee → Apply Comp-Off Leave Request (*no auto approve here*)
------------------------------------------------------------------ */
export const applyCompOffLeave = async (req, res) => {
  try {
    const { startDate, endDate, reason } = req.body;

    if (!startDate || !endDate)
      return res.status(400).json({ success: false, message: "Date required" });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    const days = calcDays(startDate, endDate);

    // ❗ Comp-Off Balance Check
    if (user.compOffBalance < days) {
      return res.status(400).json({
        success: false,
        message: `Insufficient Comp-Off balance. Need ${days}, Available ${user.compOffBalance}`
      });
    }

    const leave = await prisma.leave.create({
      data: {
        userId: req.user.id,
        type: "COMP_OFF",
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason,
        status: "PENDING"
      }
    });

    return res.json({ success: true, message: "Comp-Off leave request submitted", leave });

  } catch (e) {
    console.log("applyCompOffLeave:", e);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};




/* ------------------------------------------------------------------
   2️⃣ Admin/Manager → Approve or Reject Comp-Off Leave
------------------------------------------------------------------ */
export const approveCompOffLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body;

    if (!["APPROVED", "REJECTED"].includes(action))
      return res.status(400).json({ success: false, message: "Invalid action" });

    const leave = await prisma.leave.findUnique({ where: { id } });
    if (!leave) return res.status(404).json({ success: false, message: "Leave not found" });

    if (leave.type !== "COMP_OFF")
      return res.status(400).json({ success: false, message: "Not a Comp-Off type leave" });

    const days = calcDays(leave.startDate, leave.endDate);

    if (action === "APPROVED") {
      const user = await prisma.user.findUnique({ where: { id: leave.userId } });

      if (user.compOffBalance < days)
        return res.status(400).json({
          success: false,
          message: `Not enough balance. Need ${days}, Have ${user.compOffBalance}`
        });

      await prisma.user.update({
        where: { id: leave.userId },
        data: { compOffBalance: { decrement: days } }
      });
    }

    const updated = await prisma.leave.update({
      where: { id },
      data: {
        status: action,
        rejectReason: action === "REJECTED" ? reason || "" : null
      }
    });

    return res.json({
      success: true,
      message: `Comp-Off ${action}`,
      updated
    });

  } catch (e) {
    console.log("approveCompOffLeave:", e);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};




/* ------------------------------------------------------------------
   3️⃣ Admin → Grant Extra Comp-Off Balance (Manual Reward)
------------------------------------------------------------------ */
export const grantCompOff = async (req, res) => {
  try {
    const { userId, workDate, duration = 1, note } = req.body;

    if (!userId || !workDate)
      return res.status(400).json({ success: false, message: "User & workDate required" });

    const record = await prisma.compOff.create({
      data: {
        userId,
        workDate: new Date(workDate),
        duration,
        status: "APPROVED",
        note: note || "Extra work reward"
      }
    });

    await prisma.user.update({
      where: { id: userId },
      data: { compOffBalance: { increment: duration } }
    });

    return res.json({
      success: true,
      message: "Comp-Off granted",
      record
    });

  } catch (e) {
    console.log("grantCompOff:", e);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};




/* ------------------------------------------------------------------
   4️⃣ Admin → View All Comp-Off Entries
------------------------------------------------------------------ */
export const listCompOffRecords = async (req, res) => {
  try {
    const records = await prisma.compOff.findMany({
      include: { user: true },
      orderBy: { createdAt: "desc" }
    });

    return res.json({ success: true, records });

  } catch (e) {
    console.log("listCompOffRecords:", e);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};





/* ------------------------------------------------------------------
   5️⃣ Admin → Delete + Balance Revert
------------------------------------------------------------------ */
export const deleteCompOff = async (req, res) => {
  try {
    const { id } = req.params;

    const rec = await prisma.compOff.findUnique({ where: { id } });
    if (!rec) return res.status(404).json({ success: false, message: "Record not found" });

    await prisma.user.update({
      where: { id: rec.userId },
      data: { compOffBalance: { decrement: rec.duration } }
    });

    await prisma.compOff.delete({ where: { id } });

    return res.json({
      success: true,
      message: "Comp-Off deleted & balance reverted"
    });

  } catch (e) {
    console.log("deleteCompOff:", e);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
