import prisma from "../prismaClient.js";
import { emitToUser, emitToUsers } from "../socket/socketServer.js";

/* =====================================================
   LIST NOTIFICATIONS (Admin → all, Employee → own)
===================================================== */
export const listNotifications = async (req, res) => {
  try {
    const user = req.user;

    let notifications;

    if (user.role === "ADMIN") {
      // Admin notifications: base list (all notifications from active users)
      notifications = await prisma.notification.findMany({
        where: {
          user: {
            isActive: true, // 🔥 BLOCK soft-deleted employees
          },
        },
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
      });

      // Fetch all users once (with roles) to map readByIds and admin identities
      const allUsers = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, firstName: true, lastName: true, role: true },
      });

      const adminIds = new Set(
        allUsers.filter((u) => u.role === "ADMIN").map((u) => u.id)
      );

      // Attach readBy array with user objects
      let mapped = notifications.map((n) => ({
        ...n,
        readBy: allUsers.filter((u) => n.readByIds.includes(u.id)),
      }));

      // Step 1: keep only notifications that have NOT been seen by any admin yet
      mapped = mapped.filter(
        (n) => !n.readBy.some((u) => adminIds.has(u.id))
      );

      // Step 2: keep only notifications that correspond to "pending" requests
      const leaveIds = new Set(
        mapped
          .filter((n) => n.meta?.type === "leave_request" && n.meta?.leaveId)
          .map((n) => String(n.meta.leaveId))
      );

      const correctionIds = new Set(
        mapped
          .filter(
            (n) =>
              n.meta?.type === "attendance_correction" && n.meta?.correctionId
          )
          .map((n) => String(n.meta.correctionId))
      );

      const [leaves, corrections] = await Promise.all([
        leaveIds.size
          ? prisma.leave.findMany({
              where: { id: { in: Array.from(leaveIds) } },
              select: { id: true, status: true },
            })
          : Promise.resolve([]),
        correctionIds.size
          ? prisma.attendanceCorrection.findMany({
              where: { id: { in: Array.from(correctionIds) } },
              select: { id: true, status: true },
            })
          : Promise.resolve([]),
      ]);

      const leaveStatus = new Map(leaves.map((l) => [l.id, l.status]));
      const correctionStatus = new Map(
        corrections.map((c) => [c.id, c.status])
      );

      mapped = mapped.filter((n) => {
        const t = n.meta?.type;
        if (t === "leave_request") {
          const lid = n.meta?.leaveId;
          if (!lid) return false;
          return leaveStatus.get(String(lid)) === "PENDING";
        }
        if (t === "attendance_correction") {
          const cid = n.meta?.correctionId;
          if (!cid) return false;
          return correctionStatus.get(String(cid)) === "PENDING";
        }
        // Other notification types are not considered "pending requests" for admins
        return false;
      });

      notifications = mapped;
    } else {
      // Employee → only their own notifications
      notifications = await prisma.notification.findMany({
        where: { userId: user.id,user: { isActive: true }  },
        orderBy: { createdAt: "desc" }
      });
    }

    return res.json({ success: true, notifications });

  } catch (err) {
    console.error("listNotifications ERROR:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/* =====================================================
   GET SINGLE NOTIFICATION
===================================================== */
export const getNotificationById = async (req, res) => {
  try {
    const user = req.user;
    const id = req.params.id;

    let notif = await prisma.notification.findFirst({
      where: { id,
        user: { isActive: true } 
       },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, role: true } }
      }
    });

    if (!notif)
      return res.status(404).json({ success: false, message: "Notification not found" });

    if (user.role !== "ADMIN" && notif.userId !== user.id)
      return res.status(403).json({ success: false, message: "Access denied" });

    // Add readBy names
    const allUsers = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, firstName: true, lastName: true }
    });

    notif = {
      ...notif,
      readBy: allUsers.filter((u) => notif.readByIds.includes(u.id))
    };

    return res.json({ success: true, notification: notif });

  } catch (err) {
    console.error("getNotificationById ERROR:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/* =====================================================
   CREATE NOTIFICATION (ADMIN ONLY)
===================================================== */
export const createNotification = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN")
      return res.status(403).json({ success: false, message: "Admin only" });

    const { userId, title, body, notifyAll = false, meta } = req.body;

    if (!title || !body)
      return res.status(400).json({ success: false, message: "Title & body required" });

    const safeMeta = meta && meta !== "" ? meta : null;

    /* SEND TO ALL EMPLOYEES */
    if (notifyAll) {
      const employees = await prisma.user.findMany({
        where: {
          role: { in: ["AGILITY_EMPLOYEE", "LYF_EMPLOYEE"] },
          isActive: true
        },
        select: { id: true }
      });

      const rows = employees.map((emp) => ({
        userId: emp.id,
        title,
        body,
        meta: safeMeta
      }));

      await prisma.notification.createMany({ data: rows });

      // 🔔 Socket: notify all targeted employees in real-time
      const employeeIds = employees.map((e) => e.id);
      if (employeeIds.length > 0) {
        // Payload is minimal because clients will refetch from /notifications
        emitToUsers(employeeIds, "notification_created", {
          scope: "ALL_EMPLOYEES",
          title,
          body,
        });
      }

      return res.json({
        success: true,
        message: "Notification sent to all employees"
      });
    }

    /* SEND TO SINGLE EMPLOYEE */
    if (!userId)
      return res.status(400).json({ success: false, message: "userId required" });

    const target = await prisma.user.findFirst({ where: { id: userId,isActive: true } });

    if (!target)
      return res.status(404).json({ success: false, message: "User not found" });

    const notif = await prisma.notification.create({
      data: { userId, title, body, meta: safeMeta }
    });

    // 🔔 Socket: notify the specific employee in real-time
    emitToUser(userId, "notification_created", {
      title,
      body,
      id: notif.id,
    });

    return res.json({
      success: true,
      message: "Notification sent",
      notification: notif
    });

  } catch (err) {
    console.error("createNotification ERROR:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/* =====================================================
   MARK AS READ (Employee + Admin)
   - Employees can mark their own notifications
   - Admins can mark any notification as read for themselves
===================================================== */
export const markNotificationRead = async (req, res) => {
  try {
    const user = req.user;
    const id = req.params.id;
    if (!user.isActive) {
  return res.status(403).json({
    success: false,
    message: "Account deactivated"
  });
}

    let notif = await prisma.notification.findFirst({
      where: { id, user: { isActive: true } }
    });

    if (!notif)
      return res.status(404).json({ success: false, message: "Notification not found" });

    // For non-admins, ensure this notification belongs to them
    if (user.role !== "ADMIN" && notif.userId !== user.id)
      return res.status(403).json({ success: false, message: "Not allowed" });

    // Already read?
    if (notif.readByIds.includes(user.id)) {
      return res.json({ success: true, message: "Already read", notification: notif });
    }

    // Push employee ID to readByIds[]
    notif = await prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readByIds: { push: user.id }
      }
    });

    return res.json({
      success: true,
      message: "Marked as read",
      notification: notif
    });

  } catch (err) {
    console.error("markNotificationRead ERROR:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/* =====================================================
   DELETE NOTIFICATION
===================================================== */
export const deleteNotification = async (req, res) => {
  try {
    const user = req.user;
    const id = req.params.id;

    const notif = await prisma.notification.findFirst({
      where: { id,  user: { isActive: true } }
    });

    if (!notif)
      return res.status(404).json({ success: false, message: "Notification not found" });

    if (user.role !== "ADMIN" && notif.userId !== user.id)
      return res.status(403).json({ success: false, message: "Access denied" });

    await prisma.notification.delete({
      where: { id }
    });

    return res.json({
      success: true,
      message: "Notification deleted"
    });

  } catch (err) {
    console.error("deleteNotification ERROR:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
