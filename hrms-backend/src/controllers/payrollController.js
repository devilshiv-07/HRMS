// controllers/payrollController.js
import prisma from "../prismaClient.js";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import multer from "multer";

/* ============================================================
   STORAGE (uploads/slips)
============================================================ */
const uploadDir = path.join(process.cwd(), "uploads", "slips");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

/* Multer Setup */
export const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const ext = file.originalname.split(".").pop();
      cb(null, `slip-${Date.now()}.${ext}`);
    }
  })
});

/* ============================================================
   FIXED — Full URL Generator (No Double Slashes)
============================================================ */
const getFullUrl = (file) => {
  const base = process.env.BASE_URL || "http://localhost:4000";
  // remove double slashes except after "http:"
  return `${base}/${file}`.replace(/([^:]\/)\/+/g, "$1");
};

/* ============================================================
   GET PAYROLLS (Admin: all, Employee: own)
============================================================ */
export const getPayrolls = async (req, res) => {
  try {
    const isAdmin = req.user.role === "ADMIN";

    const payrolls = await prisma.payroll.findMany({
      where: isAdmin ? {  user: { isActive: true } } : { userId: req.user.id },
      include: { user: true },
      orderBy: { salaryMonth: "desc" }
    });

    // Convert slip path → full URL
    payrolls.forEach((p) => {
      if (p.slipUrl) p.slipUrl = getFullUrl(p.slipUrl);
    });

    return res.json({ success: true, payrolls });

  } catch (err) {
    console.error("[getPayrolls ERROR]", err);
    return res.status(500).json({ message: "Failed to load payrolls" });
  }
};

/* ============================================================
   CREATE PAYROLL (ADMIN)
============================================================ */
export const createPayroll = async (req, res) => {
  try {
    const { userId, salaryMonth, baseSalary, bonus, deductions } = req.body;

    const netSalary =
      Number(baseSalary) + Number(bonus || 0) - Number(deductions || 0);

    const payroll = await prisma.payroll.create({
      data: {
        userId,
        salaryMonth: new Date(salaryMonth),
        baseSalary: Number(baseSalary),
        bonus: Number(bonus),
        deductions: Number(deductions),
        netSalary
      }
    });

    return res.json({ success: true, payroll });

  } catch (err) {
    console.error("[createPayroll ERROR]", err);
    return res.status(500).json({ message: "Failed to create payroll" });
  }
};

/* ============================================================
   DELETE PAYROLL
============================================================ */
export const deletePayroll = async (req, res) => {
  try {
    await prisma.payroll.delete({ where: { id: req.params.id } });
    return res.json({ success: true, message: "Payroll deleted" });

  } catch (err) {
    console.error("[deletePayroll ERROR]", err);
    return res.status(500).json({ message: "Failed to delete payroll" });
  }
};
/* ============================================================
   GENERATE PAYROLL FOR ALL EMPLOYEES (FINAL FIXED)
============================================================ */
export const generatePayrollForAll = async (req, res) => {
  try {
    // Current month ka 1st date
    const today = new Date();
    const salaryMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // All employees
    const employees = await prisma.user.findMany({
      where: {
        role: { in: ["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"] }
      },
      include: { salary: true }, // baseSalary/bonus/deductions
    });

    if (!employees.length)
      return res.status(400).json({ message: "No employees found" });

    let count = 0;

    for (const emp of employees) {
      if (!emp.salary) continue;

      const baseSalary = emp.salary.base || 0;
      const bonus = emp.salary.bonus || 0;
      const deductions = emp.salary.deductions || 0;
      const netSalary = baseSalary + bonus - deductions;

      // Prevent duplicate payroll
      const exists = await prisma.payroll.findFirst({
        where: { userId: emp.id, salaryMonth },
      });
      if (exists) continue;

      // Create payroll
      const payroll = await prisma.payroll.create({
        data: {
          userId: emp.id,
          salaryMonth,
          baseSalary,
          bonus,
          deductions,
          netSalary,
        },
      });

      // Auto-generate PDF
      await generateAutoSlip(payroll.id);

      count++;
    }

    return res.json({
      success: true,
      message: "Payroll generated successfully",
      created: count,
    });

  } catch (err) {
    console.error("[generatePayrollForAll ERROR]", err);
    return res.status(500).json({ message: "Payroll generation failed" });
  }
};


/* ============================================================
   GENERATE PREMIUM PDF SLIP
============================================================ */
export const generateSlip = async (req, res) => {
  try {
    const id = req.params.id;

    const p = await prisma.payroll.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!p) return res.status(404).json({ message: "Not found" });

    const money = (n) => "Rs "+Number(n).toLocaleString("en-IN");
    const file = `uploads/slips/payslip-${p.id}.pdf`;
    const filePath = path.join(process.cwd(), file);

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    doc.pipe(fs.createWriteStream(filePath));

    /* ============================================================
        DYNAMIC COMPANY DETAILS BASED ON ROLE
    ============================================================ */
    let companyName = "Lyfshilp Academy & Agility AI Pvt. Ltd.";
    let companyAddress = "A-2 Suraksha Apartment, Abhay khand-3, Indirapuram, Ghaziabad";
    let companyEmail = "hr@company.com";
    let companyPhone = "+91-9876543210";

    if (p.user.role === "AGILITY_EMPLOYEE") {
      companyName = "Agility AI Pvt. Ltd.";
      companyAddress = "A-2 Suraksha Apartment, Abhay khand-3, Indirapuram, Ghaziabad";
      companyEmail = "hr@agilityai.com";
      companyPhone = "+91-9871860170";
    }

    if (p.user.role === "LYF_EMPLOYEE") {
      companyName = "Lyfshilp Academy Pvt. Ltd.";
      companyAddress = "A-2 Suraksha Apartment, Abhay khand-3, Indirapuram, Ghaziabad";
      companyEmail = "info@lyfshilp.com";
      companyPhone = "+91-8130557100";
    }

    /* ============================================================
        COMPANY HEADER (NO LOGO)
    ============================================================ */

    doc
      .fontSize(22)
      .fill("#4F46E5")
      .text(companyName, 40, 35);

    doc
      .fontSize(10)
      .fill("#444")
      .text(companyAddress, 40, 60)
      .text(`Phone: ${companyPhone} | ${companyEmail}`);

    /* TITLE BAR */
    doc
      .rect(0, 95, doc.page.width, 45)
      .fill("#4F46E5")
      .fillColor("white")
      .fontSize(22)
      .text("SALARY SLIP", 40, 110);

    doc.fillColor("black");

    /* ============================================================
        EMPLOYEE DETAILS
    ============================================================ */
    let y = 170;

    doc
      .fontSize(16)
      .fill("#111")
      .text("Employee Details", 40, y);
    y += 25;

    doc.fontSize(12);
    doc.text(`Name: ${p.user.firstName} ${p.user.lastName}`, 40, y);
    y += 18;

    doc.text(
      `Month: ${new Date(p.salaryMonth).toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
      })}`,
      40,
      y
    );
    y += 35;

    /* ============================================================
        SALARY TABLE
    ============================================================ */
    doc.roundedRect(30, y, 530, 200, 10).stroke("#bbb");

    doc.fontSize(16).text("Salary Breakdown", 40, y + 10);

    const leftX = 50;
    const rightX = 340;
    let cy = y + 50;

    doc.fontSize(13).fill("#000");

    const addRow = (label, value) => {
      doc.text(label, leftX, cy);
      doc.text(value, rightX, cy);
      cy += 25;
    };

    addRow("Base Salary:", money(p.baseSalary));
    addRow("Bonus:", money(p.bonus));
    addRow("Deductions:", money(p.deductions));

    doc.font("Helvetica-Bold").fill("#16A34A");
    addRow("Net Salary:", money(p.netSalary));

    doc.font("Helvetica").fill("#000");

    /* ============================================================
        SIGNATURE (removed image)
    ============================================================ */

    doc.fontSize(12).text("Authorized Signature", 50, cy + 60);

    /* ============================================================
        FOOTER
    ============================================================ */
    doc
      .fontSize(10)
      .fill("#555")
      .text(
        "This is a computer-generated salary slip and does not require a physical signature.",
        40,
        760
      );

    doc
      .fontSize(10)
      .fill("#999")
      .text(`© 2025 ${companyName} | All Rights Reserved`, 40, 775);

    doc.end();

    await prisma.payroll.update({
      where: { id },
      data: { slipUrl: file },
    });

    return res.json({ success: true, slipUrl: getFullUrl(file) });

  } catch (err) {
    console.error("[generateSlip ERROR]", err);
    return res.status(500).json({ message: "Failed to generate slip" });
  }
};
// Helper: Call generateSlip internally
const generateAutoSlip = async (id) => {
  try {
    await generateSlip(
      { params: { id } },
      {
        json: () => {},
        status: () => ({ json: () => {} }),
      }
    );
  } catch (err) {
    console.error("AutoSlip Error:", err);
  }
};



/* ============================================================
   UPLOAD SLIP (ADMIN)
============================================================ */
export const uploadSlip = async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ message: "No file uploaded" });

    const id = req.params.id;
    const file = `uploads/slips/${req.file.filename}`;

    await prisma.payroll.update({
      where: { id },
      data: { slipUrl: file }
    });

    return res.json({ success: true, slipUrl: getFullUrl(file) });

  } catch (err) {
    console.error("[uploadSlip ERROR]", err);
    return res.status(500).json({ message: "Upload failed" });
  }
};

/* ============================================================
   DOWNLOAD PDF SLIP
============================================================ */
export const downloadSlip = async (req, res) => {
  try {
    const id = req.params.id;

    const p = await prisma.payroll.findUnique({ where: { id } });
    if (!p?.slipUrl)
      return res.status(404).json({ message: "Slip not found" });

    const fullPath = path.join(process.cwd(), p.slipUrl);
    return res.download(fullPath);

  } catch (err) {
    console.error("[downloadSlip ERROR]", err);
    return res.status(500).json({ message: "Download failed" });
  }
};
