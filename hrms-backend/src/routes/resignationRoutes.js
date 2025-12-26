// import express from "express";
// import {
//   applyResignation,
//   approveResignation,
//   rejectResignation,
//   listResignations,
// } from "../controllers/resignationController.js";

// import { requireAuth } from "../middlewares/auth.js"; // same as userRoutes

// const router = express.Router();

// /* -----------------------------------------------------------
//    APPLY RESIGNATION (EMPLOYEE)
// ------------------------------------------------------------ */
// router.post(
//   "/apply",
//   requireAuth(["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
//   applyResignation
// );

// /* -----------------------------------------------------------
//    LIST ALL REQUESTS (ADMIN + MANAGER)
// ------------------------------------------------------------ */
// router.get(
//   "/list",
//   requireAuth(["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
//   listResignations
// );

// /* -----------------------------------------------------------
//    APPROVE RESIGNATION (ADMIN / MANAGER)
// ------------------------------------------------------------ */
// router.post(
//   "/:id/approve",
//   requireAuth(["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
//   approveResignation
// );

// /* -----------------------------------------------------------
//    REJECT RESIGNATION (ADMIN / MANAGER)
// ------------------------------------------------------------ */
// router.post(
//   "/:id/reject",
//   requireAuth(["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
//   rejectResignation
// );

// export default router;
