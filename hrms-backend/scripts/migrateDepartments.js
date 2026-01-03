// import prisma from "../src/prismaClient.js";

// async function migrateDepartments() {
//   console.log("🚀 Starting department data migration...");

//   /**
//    * STEP 1:
//    * OLD DATA → NEW JOIN TABLE
//    * User.departmentId  →  user_departments
//    */
//   const users = await prisma.user.findMany({
//     where: {
//       departmentId: { not: null },
//     },
//     select: {
//       id: true,
//       departmentId: true,
//     },
//   });

//   let count = 0;

//   for (const u of users) {
//     try {
//       await prisma.userDepartment.upsert({
//         where: {
//           userId_departmentId: {
//             userId: u.id,
//             departmentId: u.departmentId,
//           },
//         },
//         update: {},
//         create: {
//           userId: u.id,
//           departmentId: u.departmentId,
//         },
//       });
//       count++;
//     } catch (err) {
//       console.error("❌ UserDepartment error for user:", u.id, err.message);
//     }
//   }

//   console.log(`✅ Migrated ${count} user → department links`);
//   console.log("🎉 Department migration completed successfully");
// }

// migrateDepartments()
//   .catch((err) => {
//     console.error("🔥 Migration failed:", err);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });
