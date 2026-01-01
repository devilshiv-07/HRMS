import prisma from "../prismaClient.js";
import multer from "multer";
import fs from "fs";
import path from "path";
import { sendRequestNotificationMail } from "../utils/sendMail.js";
import { getAdminAndManagers } from "../utils/getApprovers.js";
import { Parser } from "json2csv";
import ExcelJS from "exceljs";

/* =====================================================
   📦 STORAGE
===================================================== */
const uploadDir = path.join(process.cwd(), "uploads", "reimbursements");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

export const uploadBills = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const ext = file.originalname.split(".").pop();
      cb(null, `bill-${Date.now()}.${ext}`);
    },
  }),
});

/* =====================================================
   🔹 HELPERS
===================================================== */
const validateManagerReimbursementAccess = async (reimbursementId, managerId) => {
  const record = await prisma.reimbursement.findFirst({
    where: {
      id: reimbursementId,
      user: {
        departments: {
          some: {
            department: {
              managers: {
                some: { id: managerId },
              },
            },
          },
        },
      },
    },
  });

  if (!record) {
    throw new Error("Manager has no access to this reimbursement");
  }

  return record;
};

const getFullUrl = (file) => {
  const base ="https://www.agilityai.in";
  return `${base}/${file}`.replace(/([^:]\/)\/+/g, "$1");
};

const calculateTotal = (bills = []) =>
  bills.reduce((sum, b) => sum + Number(b.amount || 0), 0);

const validateOwner = async (id, userId) => {
  const record = await prisma.reimbursement.findFirst({
    where: { id, userId },
  });
  if (!record) throw new Error("Unauthorized access");
  return record;
};

const updateStatus = async ({ id, status, reason = null }) => {
  return prisma.reimbursement.update({
    where: { id },
    data: {
      status,
      rejectReason: status === "REJECTED" ? reason || "" : null,
    },
    include: {
      user: true, // 👈 IMPORTANT
    },
  });
};

/* =====================================================
   📤 UPLOAD BILL FILES
===================================================== */
export const uploadReimbursementFiles = async (req, res) => {
  try {
    if (!req.files?.length)
      return res
        .status(400)
        .json({ success: false, message: "No files uploaded" });

    const files = req.files.map((f) => ({
      fileUrl: getFullUrl(`uploads/reimbursements/${f.filename}`),
    }));

    res.json({ success: true, files });
  } catch (e) {
    res.status(500).json({ success: false, message: "Upload failed" });
  }
};

/* =====================================================
   👤 EMPLOYEE — CREATE
===================================================== */
export const createReimbursement = async (req, res) => {
  try {
    const { title, description, bills } = req.body;

    if (!title || !bills?.length)
      return res.status(400).json({
        success: false,
        message: "Title & bills required"
      });

    /* =====================================================
       1️⃣ Create reimbursement base entry
    ====================================================== */
    const reimbursement = await prisma.reimbursement.create({
      data: {
        userId: req.user.id,
        title,
        description: description || "",
        totalAmount: calculateTotal(bills),
        bills: {
          create: bills.map((b) => ({
            fileUrl: b.fileUrl,
            amount: Number(b.amount),
            note: b.note || "",
          })),
        },
      },
      include: { bills: true },
    });

    /* =====================================================
       2️⃣ Auto-Assign APPROVERS based on ALL employee departments
          ✔ Multiple departments supported
          ✔ Self manager exclusion
          ✔ No duplicate managers
          ✔ Admin fallback if no manager exists
    ====================================================== */
    
/* ================== FINAL MULTI-DEPT MANAGER APPROVER ASSIGN ================== */

const employee = await prisma.user.findUnique({
  where: { id: req.user.id },
  include: {
    departments: {
      include: {
        department: {
          include: { managers: true }
        }
      }
    }
  }
});

// Collect all managers from ALL departments where employee exists
let approvers = employee.departments.flatMap(d => d.department.managers);

// Remove duplicate managers
approvers = approvers.filter((v,i,a)=>a.findIndex(t=>t.id===v.id)===i);

// ❗ Remove requesting user if he is also manager (prevent self approval)
approvers = approvers.filter(m => m.id !== req.user.id);

// If after filter no manager remains → stop (DON'T fallback to admin)
if(approvers.length === 0){
  return res.status(400).json({
    success:false,
    message:"No manager available for approval"
  });
}

// Create approval entries
await prisma.reimbursementApproval.createMany({
  data: approvers.map(m=>({
    reimbursementId: reimbursement.id,
    managerId: m.id,
    status:"PENDING"
  })),
  skipDuplicates:true
});

    /* =====================================================
       3️⃣ Mail to Admin/Managers
    ====================================================== */
    try {
      const approverEmails = await getAdminAndManagers(req.user.id);

      if (approverEmails.length > 0) {
        await sendRequestNotificationMail({
          to: approverEmails,
          subject: "New Reimbursement Request Submitted",
          title: "Reimbursement Request",
          employeeName: `${req.user.firstName} ${req.user.lastName || ""}`,
          details: [
            `Title: ${title}`,
            `Total Amount: ₹${calculateTotal(bills)}`,
            description && `Description: ${description}`
          ].filter(Boolean),
        });
      }
    } catch (mailErr) {
      console.error("Reimbursement notification mail failed:", mailErr.message);
      // Mail failure should not block request
    }

    return res.json({
      success: true,
      message: "Reimbursement submitted successfully",
      reimbursementId: reimbursement.id,
    });

  } catch (e) {
    console.error("createReimbursement ERROR:", e);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

/* =====================================================
   👤 EMPLOYEE — MY LIST
===================================================== */
export const myReimbursements = async (req,res)=>{
  const list = await prisma.reimbursement.findMany({
    where:{ userId:req.user.id,isEmployeeDeleted:false },
    include:{
      bills:true,
      approvals:{ include:{ manager:true }}  // ⚡ same include
    },
    orderBy:{createdAt:"desc"}
  })
  res.json({success:true,list})
}

/* =====================================================
   👤 EMPLOYEE — SOFT DELETE
===================================================== */
export const employeeDeleteReimbursement = async (req, res) => {
  try {
    await validateOwner(req.params.id, req.user.id);

    await prisma.reimbursement.update({
      where: { id: req.params.id },
      data: { isEmployeeDeleted: true },
    });

    res.json({ success: true, message: "Removed from your list" });
  } catch (e) {
    res.status(403).json({ success: false, message: e.message });
  }
};

/* =====================================================
   👑 ADMIN — ALL || Manager-Department
===================================================== */
export const getManagerReimbursements = async (req, res) => {
  try {
    const managerId = req.user.id;

    const reimbursements = await prisma.reimbursement.findMany({
      where: {
        user: {
          departments: {
            some: {
              department: { managers: { some: { id: managerId } } }
            }
          }
        }
      },
      include: {
        user: true,
        bills: true,
        approvals: {                    // 🔥 add this
          include: { manager: true }    // 🔥 manager data
        }
      },
      orderBy:{ createdAt:"desc" }
    });

    res.json({ success:true, list:reimbursements });
  }
  catch(err){ res.status(500).json({success:false}) }
};

export const getAllReimbursements = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN")
      return res.status(403).json({ success: false, message: "Admin only" });

    const list = await prisma.reimbursement.findMany({
      where: { isAdminDeleted: false },
      include: { user: true, bills: true },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, list });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed" });
  }
};

/* =====================================================
   👑 ADMIN — APPROVE / REJECT
===================================================== */
/* =====================================================
   ⭐ MANAGER + ADMIN — APPROVE / REJECT (FINAL VERSION)
===================================================== */
export const updateReimbursementStatus = async (req, res) => {
  try {
    const reimbursementId = req.params.id;
    let { status, reason } = req.body;
    const managerId = req.user.id;

    if (!["APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    /* 1️⃣ Fetch reimbursement + managers */
    const reimbursement = await prisma.reimbursement.findUnique({
      where: { id: reimbursementId },
      include: {
        user: {
          include: {
            departments: { include: { department: { include: { managers: true } } } }
          }
        },
        approvals: true, // important
      }
    });

    if (!reimbursement) {
      return res.status(404).json({ success: false, message: "Reimbursement not found" });
    }

    /* 2️⃣ Block self-approval */
    if (reimbursement.userId === managerId) {
      return res.status(403).json({ success: false, message: "You cannot approve your own reimbursement" });
    }

    /* 3️⃣ Permission Check */
    const managerIds = reimbursement.user.departments.flatMap(d =>
      d.department.managers.map(m => m.id)
    );

    const isManager = managerIds.includes(managerId);
    const isAdmin = req.user.role === "ADMIN";

    if (!isAdmin && !isManager) {
      return res.status(403).json({ success: false, message: "Not allowed" });
    }

    /* =====================================================
       🔥 RECORD APPROVAL ENTRY
    ====================================================== */
    if (isAdmin) {
      // Admin = direct approval entry
      await prisma.reimbursementApproval.upsert({
        where: { reimbursementId_managerId: { reimbursementId, managerId } },
        update: { status, reason, actedAt: new Date() },
        create: { reimbursementId, managerId, status, reason }
      });
    } else {
      // Manager only updates own decision
      const updated = await prisma.reimbursementApproval.updateMany({
        where: { reimbursementId, managerId },
        data: { status, reason, actedAt: new Date() }
      });

      if (updated.count === 0) {
        return res.status(403).json({ success: false, message: "Not assigned as approver" });
      }
    }

    /* =====================================================
       🔍 FINAL DECISION CHECK (Leave जैसा)
    ====================================================== */
      const approvals = await prisma.reimbursementApproval.findMany({
       where: { reimbursementId },
       include:{ manager:true }        // ⭐ इस line से ही role मिलेगा
      });

/* ===========================================
   🔍 Final Approval Evaluation (Your Logic)
   - All managers approve  → Approved
   - OR Admin approve      → Approved
   - Any reject            → Rejected
   - Else                  → Pending
=========================================== */
/* =====================================================
   🔥 UPDATED FINAL LOGIC — IMPORTANT CHANGE
===================================================== */

//-------------------------------------------------------------
// FINAL APPROVAL EVALUATION
//-------------------------------------------------------------
const anyRejected = approvals.some(a => a.status === "REJECTED");

const managerApprovals = approvals.filter(a => a.manager.role !== "ADMIN");
const allManagersApproved = managerApprovals.length > 0 && managerApprovals.every(a => a.status === "APPROVED");

const adminApproved = approvals.some(a => a.manager.role === "ADMIN" && a.status === "APPROVED");

// check if requester is also a manager
const requesterIsManager = managerIds.includes(reimbursement.userId);

let finalStatus = "PENDING";

// ❌ If ANY rejection → reject
if(anyRejected){
  finalStatus = "REJECTED";
}

// 🔥 CASE-1 : requester is manager → (all managers + admin both required)
else if(requesterIsManager){
  if(allManagersApproved && adminApproved){
    finalStatus = "APPROVED";
  }
}

// 🔥 CASE-2 : normal employee → (either all managers OR admin)
else{
  if(allManagersApproved || adminApproved){
    finalStatus = "APPROVED";
  }
}
// else pending रहेगी

    /* =====================================================
       📝 Update Final Table Status
    ====================================================== */
    const updated = await prisma.reimbursement.update({
      where: { id: reimbursementId },
      data: {
        status: finalStatus,
        rejectReason: finalStatus === "REJECTED" ? reason || "" : null
      },
      include: { user: true }
    });

    /* 📩 Email Notification */
    try {
      await sendRequestNotificationMail({
        to: [updated.user.email],
        subject: `Reimbursement ${finalStatus}`,
        title: "Reimbursement Status Update",
        employeeName: `${updated.user.firstName} ${updated.user.lastName || ""}`,
        details: [
          `Total Amount: ₹${updated.totalAmount}`,
          `Status: ${finalStatus}`,
          finalStatus === "REJECTED" && `Reason: ${reason || "Not specified"}`
        ].filter(Boolean)
      });
    } catch (mailErr) {
      console.log("Mail failed:", mailErr.message);
    }

    return res.json({
      success: true,
      message: `Reimbursement ${finalStatus.toLowerCase()}`,
      reimbursement: updated,
    });

  } catch (error) {
    console.error("updateReimbursementStatus ERROR:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};


/* =====================================================
   👑 ADMIN — SOFT DELETE
===================================================== */
export const adminDeleteReimbursement = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN")
      return res.status(403).json({ success: false, message: "Admin only" });

    await prisma.reimbursement.update({
      where: { id: req.params.id },
      data: { isAdminDeleted: true },
    });

    res.json({ success: true, message: "Removed from admin list" });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed" });
  }
};

/* =====================================================
   📤 EXPORT REIMBURSEMENTS (CSV / EXCEL)
===================================================== */

export const exportReimbursements = async (req, res) => {
  try {
    const user = req.user;
    let { start, end, userId, departmentId, format } = req.query;
    if (!format) format = "csv";

    const BASE_URL = "https://www.agilityai.in"; // LIVE DOMAIN

    const formatUrl = (url) => {
      if (!url) return "";
      return url.replace("http://localhost:4000", BASE_URL);
    };

    const where = { isAdminDeleted: false };

    // Role based filter
    if (user.role !== "ADMIN") where.userId = user.id;
    else if (userId) where.userId = userId;

    // Date filter
    if (start && end) {
      where.createdAt = { gte: new Date(start), lte: new Date(end) };
    }

    // Department filter
    if (departmentId) {
      where.user = { departments: { some: { departmentId } } };
    }

    const rows = await prisma.reimbursement.findMany({
      where,
      include: { user: true, bills: true },
      orderBy: { createdAt: "desc" },
    });

    /* ================= CSV EXPORT ================= */
    if (format === "csv") {
      const parser = new Parser({
        fields: ["employee", "title", "totalAmount", "status", "billUrls", "createdAt"]
      });

      const csv = parser.parse(
        rows.map((r) => ({
          employee: `${r.user.firstName} ${r.user.lastName}`,
          title: r.title,
          totalAmount: r.totalAmount,
          status: r.status,
          billUrls: r.bills.map(b => formatUrl(b.fileUrl)).join(" | "),
          createdAt: r.createdAt.toISOString().split("T")[0]
        }))
      );

      res.header("Content-Type", "text/csv");
      res.attachment("reimbursements.csv");
      return res.send(csv);
    }

    /* ================= EXCEL EXPORT (CLICKABLE LINKS) ================= */
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Reimbursements");

    sheet.columns = [
      { header: "Employee", key: "employee", width: 25 },
      { header: "Title", key: "title", width: 25 },
      { header: "Total Amount", key: "amount", width: 15 },
      { header: "Status", key: "status", width: 15 },
      { header: "Bills Count", key: "bills", width: 12 },
      { header: "Bill URLs", key: "billUrls", width: 45 },
      { header: "Date", key: "date", width: 15 },
    ];

    rows.forEach((r) => {
      const row = sheet.addRow({
        employee: `${r.user.firstName} ${r.user.lastName}`,
        title: r.title,
        amount: r.totalAmount,
        status: r.status,
        bills: r.bills.length,
        date: r.createdAt.toISOString().split("T")[0],
      });

      const cell = row.getCell("billUrls");

      // SINGLE BILL
      if (r.bills.length === 1) {
        cell.value = {
          formula: `HYPERLINK("${formatUrl(r.bills[0].fileUrl)}","Open Bill")`,
          result: "Open Bill"
        };
      }

      // MULTIPLE BILLS
      if (r.bills.length > 1) {
        const formulas = r.bills
          .map((b, i) => `HYPERLINK("${formatUrl(b.fileUrl)}","Bill ${i + 1}")`)
          .join('&CHAR(10)&');

        cell.value = { formula: formulas, result: r.bills.map((b, i) => `Bill ${i + 1}`).join("\n") };
        cell.alignment = { wrapText: true };
      }
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=reimbursements.xlsx");

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error("[exportReimbursements ERROR]", err);
    return res.status(500).json({ success: false, message: "Export failed" });
  }
};
