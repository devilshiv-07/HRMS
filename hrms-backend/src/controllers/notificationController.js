import prisma from "../prismaClient.js";

/* =====================================================
   LIST NOTIFICATIONS (Admin → all, Employee → own)
===================================================== */
export const listNotifications = async (req, res) => {
  try {
    const user = req.user;

    let notifications;

    if (user.role === "ADMIN") {
      // Admin can view all notifications
      notifications = await prisma.notification.findMany({
          where: {
    user: {
      isActive: true        // 🔥 BLOCK soft-deleted employees
    }
  },
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, role: true } }
        }
      });

      // Fetch all user names ONCE for mapping readByIds
      const allUsers = await prisma.user.findMany({
        where: { isActive: true }, 
        select: { id: true, firstName: true, lastName: true }
      });

      // Convert readByIds → readBy array
      notifications = notifications.map((n) => ({
        ...n,
        readBy: allUsers.filter((u) => n.readByIds.includes(u.id))
      }));

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
   MARK AS READ (ONLY EMPLOYEE)
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

    // Admin cannot read notifications
    if (user.role === "ADMIN")
      return res.status(400).json({ success: false, message: "Admin cannot mark read" });

    if (notif.userId !== user.id)
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
