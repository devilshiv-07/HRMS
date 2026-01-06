import express from "express";
import {
  listHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  upcomingHolidays,
  bulkSeedHolidays
} from "../controllers/holidayController.js";

import { requireAuth } from "../middlewares/auth.js";

const router = express.Router();

/* ----------------------------------------------
   LIST ALL HOLIDAYS
   ADMIN + EMPLOYEES → ALL CAN VIEW
---------------------------------------------- */
router.get(
  "/",
  requireAuth(["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
  listHolidays
);

/* ----------------------------------------------
   UPCOMING HOLIDAYS (Dashboard widget)
---------------------------------------------- */
router.get(
  "/upcoming",
  requireAuth(["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]),
  upcomingHolidays
);

/* ----------------------------------------------
   CREATE HOLIDAY (ADMIN ONLY)
---------------------------------------------- */
router.post(
  "/",
  requireAuth(["ADMIN"]),
  createHoliday
);

/* ----------------------------------------------
   UPDATE HOLIDAY (ADMIN ONLY)
---------------------------------------------- */
router.put(
  "/:id",
  requireAuth(["ADMIN"]),
  updateHoliday
);

/* ----------------------------------------------
   DELETE HOLIDAY (ADMIN ONLY)
---------------------------------------------- */
router.delete(
  "/:id",
  requireAuth(["ADMIN"]),
  deleteHoliday
);

/* ----------------------------------------------
   BULK SEED HOLIDAYS ONE TIME (ADMIN ONLY)
---------------------------------------------- */
router.post(
  "/seed",
  requireAuth(["ADMIN"]),
  bulkSeedHolidays
);

export default router;
