import express from "express";
import { requireAuth } from "../middlewares/auth.js";

import {
  applyCompOffLeave,   // Employee applies Comp-Off as leave
  approveCompOffLeave, // Admin/Manager approve/reject
  grantCompOff,        // Admin adds comp-off balance
  listCompOffRecords,  // Admin view logs
  deleteCompOff        // Admin remove + revert balance
} from "../controllers/compOffController.js";

const router = express.Router();


/* =====================================================
   1️⃣ EMPLOYEE - APPLY COMP-OFF AS LEAVE
===================================================== */
router.post(
  "/apply",
  requireAuth(["AGILITY_EMPLOYEE", "LYF_EMPLOYEE", "ADMIN"]),
  applyCompOffLeave
);


/* =====================================================
   2️⃣ ADMIN/MANAGER - APPROVE / REJECT COMP-OFF LEAVE
===================================================== */
router.patch(
  "/approve/:id",
  requireAuth(["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]), 
  // (Controller already checks manager dept authority)
  approveCompOffLeave
);


/* =====================================================
   3️⃣ ADMIN - GRANT COMP-OFF BALANCE (EXTRA WORK)
===================================================== */
router.post(
  "/grant",
  requireAuth(["ADMIN"]),
  grantCompOff
);


/* =====================================================
   4️⃣ ADMIN - ALL COMP-OFF RECORDS
===================================================== */
router.get(
  "/",
  requireAuth(["ADMIN"]),
  listCompOffRecords
);


/* =====================================================
   5️⃣ ADMIN - DELETE COMP-OFF RECORD (BALANCE REVERT)
===================================================== */
router.delete(
  "/:id",
  requireAuth(["ADMIN"]),
  deleteCompOff
);

export default router;