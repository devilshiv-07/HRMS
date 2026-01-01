import prisma from "../prismaClient.js";
import { Parser } from "json2csv";
import ExcelJS from "exceljs";

/* =======================================================
   DATE HELPERS (TZ SAFE)
======================================================= */

function rangeFromISO(start, end) {
  const s = new Date(start);
  s.setHours(0, 0, 0, 0);

  const e = new Date(end);
  e.setHours(23, 59, 59, 999);

  return { s, e };
}

function todayRange() {
  const d = new Date();
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);

  const e = new Date(d);
  e.setHours(23, 59, 59, 999);

  return { s, e };
}

function toLocalISO(date) {
  const d = new Date(date);
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}
// ================= Auto Grant Comp-Off on Weekly Off Work =================
async function autoGrantCompOff(userId, workDate) {
  const dayName = new Date(workDate).toLocaleDateString("en-US",{ weekday:"long" });

  // Check user weekly-off config
  const weeklyOff = await prisma.weeklyOff.findFirst({
    where:{ userId, offDay: dayName, isFixed:true }
  });

  if(!weeklyOff) return; // not weekly-off

  // Prevent duplicate grant for same date
  const already = await prisma.compOff.findFirst({
    where:{ userId, workDate:new Date(workDate) }
  });

  if(already) return;

  // Grant comp-off record
  await prisma.compOff.create({
    data:{
      userId,
      workDate:new Date(workDate),
      duration:1,
      status:"APPROVED",
      approvedAt:new Date(),
      note:"Worked on weekly-off"
    }
  });

  // Increase user balance
  await prisma.user.update({
    where:{ id:userId },
    data:{ compOffBalance:{ increment:1 } }
  });

  console.log("🎉 Comp-Off Auto Granted for working on weekly off");
}

/* =======================================================
   CHECK-IN
======================================================= */
export const checkIn = async (req, res) => {
  try {
    const user = req.user;
    if (!user)
      return res.status(401).json({ success: false, message: "Not authenticated" });

    if (user.role === "ADMIN")
      return res.status(403).json({ success: false, message: "Admin cannot check in" });

    const todayISO = toLocalISO(new Date());

    // ❗ BLOCK IF TODAY IS LEAVE OR WFH
    const leaveToday = await prisma.leave.findFirst({
      where: {
        userId: user.id,
        status: "APPROVED",
        startDate: { lte: new Date(todayISO) },
        endDate: { gte: new Date(todayISO) }
      }
    });

    if (leaveToday) {
      return res.status(400).json({
        success: false,
        message: `You cannot check-in today because you are marked as ${leaveToday.type}`
      });
    }

    // --- Normal check-in logic ---
    const { s, e } = todayRange();

    const existing = await prisma.attendance.findFirst({
      where: { userId: user.id, date: { gte: s, lte: e } }
    });

    const now = new Date();
    const lateTime = new Date(now);
    lateTime.setHours(23, 0, 0, 0);

    const status = now > lateTime ? "LATE" : "PRESENT";

    if (existing) {
      if (!existing.checkIn) {
        const updated = await prisma.attendance.update({
          where: { id: existing.id },
          data: { checkIn: now, status }
        });
        return res.json({ success: true, message: "Checked in", attendance: updated });
      }
      return res.json({ success: true, message: "Already checked in", attendance: existing });
    }

 const localDay = new Date(todayISO + "T00:00:00"); // Safe full-day date

const created = await prisma.attendance.create({
  data: {
    userId: user.id,
    date: localDay,   // Always store pure calendar day
    checkIn: now,
    status
  }
});


    return res.json({ success: true, message: "Checked in (new)", attendance: created });

  } catch (err) {
    console.error("[checkIn ERROR]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* =======================================================
   CHECK-OUT
======================================================= */
export const checkOut = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, message: "Not authenticated" });
    if (user.role === "ADMIN") return res.status(403).json({ success: false, message: "Admin cannot check out" });

    const todayISO = toLocalISO(new Date());
    const { s, e } = todayRange();
const existing = await prisma.attendance.findFirst({
  where: {
    userId: user.id,
   date: { gte: new Date(todayISO+"T00:00:00"), lte: new Date(todayISO+"T23:59:59.999") }
  }
});

    if (!existing)
      return res.status(400).json({ success: false, message: "You have not checked in today" });

    if (existing.checkOut)
      return res.json({ success: true, message: "Already checked out", attendance: existing });

    const updated = await prisma.attendance.update({
      where: { id: existing.id },
      data: { checkOut: new Date() }
    });
    // ⭐ Auto Comp-Off Grant if worked on weekly off
    await autoGrantCompOff(user.id, existing.date);
    return res.json({ success: true, message: "Checked out", attendance: updated });
  } catch (err) {
    console.error("[checkOut ERROR]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* =======================================================
   GET MY ATTENDANCE (EMPLOYEE)
======================================================= */
export const getMyAttendance = async (req, res) => {
  try {
    const userId = req.user.id;
    const { start, end } = req.query;

    const attendances = await prisma.attendance.findMany({
      where: { userId, date: { gte: new Date(start), lte: new Date(end) } },
      orderBy: { date: "asc" }
    });

    const leaves = await prisma.leave.findMany({
      where: { userId, status: "APPROVED" }
    });

    // ⭐ Merge Leave + WFH into attendance
    leaves.forEach(l => {
      let cur = new Date(l.startDate);
      const last = new Date(l.endDate);

      while (cur <= last) {
        const iso = toLocalISO(cur);
        attendances.push({
          date: iso,
          status: l.type === "WFH" ? "WFH" : "LEAVE",
          checkIn: null,
          checkOut: null
        });
        cur.setDate(cur.getDate() + 1);
      }
    });

    attendances.sort((a, b) => new Date(a.date) - new Date(b.date));

    const calendar = {};
    attendances.forEach(a => {
      calendar[toLocalISO(a.date)] = a.status || "ABSENT";
    });

    return res.json({
      success: true,
      attendances: attendances.map(a => ({
        ...a,
        date: toLocalISO(a.date)
      })),
      calendar
    });

  } catch (err) {
    console.error("[getMyAttendance ERROR]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* =======================================================
   ADMIN — GET ALL ATTENDANCE  (FINAL WFH FIX)
======================================================= */
export const getAllAttendance = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN")
      return res.status(403).json({ success: false, message: "Admin only" });

    const { start, end, userId, departmentId, status } = req.query;

    const where = {};

    if (start && end) {
      const { s, e } = rangeFromISO(start, end);
      where.date = { gte: s, lte: e };
    }

    if (userId) where.userId = userId;
    if (status) where.status = status;
    if (departmentId) where.user = { departmentId };

    // ORIGINAL ATTENDANCE
    const baseRows = await prisma.attendance.findMany({
      where,
      include: { user: true },
      orderBy: { date: "desc" }
    });

    /* ⭐ WFH MERGE FIX (MOST IMPORTANT) */
    const wfhLeaves = await prisma.leave.findMany({
      where: {
        type: "WFH",
        status: "APPROVED",
        startDate: { lte: new Date(end) },
        endDate: { gte: new Date(start) }
      }
    });

    let wfhMap = {};
    wfhLeaves.forEach(l => {
      let cur = new Date(l.startDate);
      const last = new Date(l.endDate);
      while (cur <= last) {
        wfhMap[toLocalISO(cur)] = l.userId;
        cur.setDate(cur.getDate() + 1);
      }
    });

    const rows = baseRows.map(r => {
      const iso = toLocalISO(r.date);
      if (wfhMap[iso] === r.userId) {
        r.status = "WFH";
        r.checkIn = null;
        r.checkOut = null;
      }
      return r;
    });

    const summary = {
      present: rows.filter(a => a.status === "PRESENT").length,
      absent: rows.filter(a => a.status === "ABSENT").length,
      late: rows.filter(a => a.status === "LATE").length,
      leave: rows.filter(a => a.status === "LEAVE").length,
      wfh: rows.filter(a => a.status === "WFH").length
    };

    return res.json({ success: true, attendances: rows, summary });

  } catch (err) {
    console.error("[getAllAttendance ERROR]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* =======================================================
   ADMIN — USER FULL HISTORY
======================================================= */
export const getAttendanceForUser = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN")
      return res.status(403).json({ success: false, message: "Admin only" });

    const userId = req.params.userId;

    const rows = await prisma.attendance.findMany({
      where: { userId },
      include: { user: true },
      orderBy: { date: "desc" }
    });

    return res.json({ success: true, attendances: rows });
  } catch (err) {
    console.error("[getAttendanceForUser ERROR]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* =======================================================
   ADMIN — MONTHLY LOGS
======================================================= */
export const getUserMonthlyLogs = async (req, res) => {
  try {
    const { userId } = req.params;
    const { month } = req.query;

    const [y, m] = month.split("-").map(Number);

    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    end.setHours(23, 59, 59, 999);

    const logs = await prisma.attendance.findMany({
      where: { userId, date: { gte: start, lte: end } },
      orderBy: { date: "asc" }
    });

    return res.json({ success: true, month, days: logs });
  } catch (err) {
    console.error("[getUserMonthlyLogs ERROR]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* =======================================================
   ADMIN — DELETE ATTENDANCE
======================================================= */
export const deleteAttendance = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN")
      return res.status(403).json({ success: false, message: "Admin only" });

    await prisma.attendance.delete({ where: { id: req.params.id } });

    return res.json({ success: true, message: "Attendance deleted successfully" });
  } catch (err) {
    console.error("[deleteAttendance ERROR]", err);
    return res.status(500).json({ success: false, message: "Failed to delete attendance" });
  }
};

/* =======================================================
   EXPORT CSV / EXCEL
======================================================= */
export const exportAttendance = async (req, res) => {
  try {
    const user = req.user;

    let { start, end, userId, departmentId, format } = req.query;
    if (!format) format = "csv";

    if (user.role !== "ADMIN") userId = user.id;

    const where = {};

    if (start && end) {
      const { s, e } = rangeFromISO(start, end);
      where.date = { gte: s, lte: e };
    }

    if (userId) where.userId = userId;
    if (departmentId) where.user = { departmentId };

    const rows = await prisma.attendance.findMany({
      where,
      include: { user: true },
      orderBy: { date: "asc" }
    });

    if (format === "csv") {
      const parser = new Parser({
        fields: ["user.firstName", "date", "checkIn", "checkOut", "status"]
      });

      const csv = parser.parse(rows);

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=attendance.csv");
      return res.send(csv);
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Attendance");

    sheet.columns = [
      { header: "Employee", key: "employee", width: 20 },
      { header: "Date", key: "date", width: 15 },
      { header: "Check In", key: "checkIn", width: 15 },
      { header: "Check Out", key: "checkOut", width: 15 },
      { header: "Status", key: "status", width: 12 }
    ];

    rows.forEach((r) => {
      sheet.addRow({
        employee: r.user.firstName,
        date: toLocalISO(r.date),
        checkIn: r.checkIn ? r.checkIn.toTimeString().slice(0, 5) : "",
        checkOut: r.checkOut ? r.checkOut.toTimeString().slice(0, 5) : "",
        status: r.status
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=attendance.xlsx");

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error("[exportAttendance ERROR]", err);
    return res.status(500).json({ success: false, message: "Export failed" });
  }
};
