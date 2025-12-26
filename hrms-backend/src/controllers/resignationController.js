// import prisma from "../prismaClient.js";
// import { sendMail } from "../utils/mail.js"; // smtp mail function (below provided)

// /**
//  * Employee Apply for resignation
//  * POST /resignation/apply
//  */
// export const applyResignation = async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const { lastWorking, reason } = req.body;

//     const exist = await prisma.resignation.findFirst({
//       where: { userId, status: "PENDING" },
//     });

//     if (exist) {
//       return res.status(400).json({
//         success: false,
//         message: "You already have a pending resignation request",
//       });
//     }

//     const resign = await prisma.resignation.create({
//       data: {
//         userId,
//         lastWorking: new Date(lastWorking),
//         reason,
//       },
//       include: {
//         user: true,
//       }
//     });

//     // email admins + managers
//     const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive:true } });

//     const managers = await prisma.user.findMany({
//       where: {
//         managedDepartments: {
//           some: {
//             users: { some: { id: userId } }
//           }
//         }
//       }
//     });

//     const notifyTo = [...admins, ...managers];

//     notifyTo.forEach(u => {
//       sendMail({
//         to: u.email,
//         subject: `Resignation Request - ${resign.user.firstName}`,
//         html: `
//           <h3>New Resignation Request</h3>
//           <p><b>Employee:</b> ${resign.user.firstName} ${resign.user.lastName}</p>
//           <p><b>Last Working Day:</b> ${new Date(lastWorking).toDateString()}</p>
//           <p><b>Reason:</b> ${reason || "Not Provided"}</p>
//         `
//       });
//     });

//     return res.json({
//       success: true,
//       message: "Resignation request submitted",
//       resignation: resign,
//     });

//   } catch (err) {
//     console.log(err);
//     res.status(500).json({ success: false, message: "Something went wrong" });
//   }
// };


// /**
//  * Approve Request (ADMIN or Manager)
//  * POST /resignation/:id/approve
//  */
// export const approveResignation = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const resign = await prisma.resignation.update({
//       where: { id },
//       data: { status: "APPROVED" },
//       include:{ user:true }
//     });

//     // Auto deactivate employee
//     await prisma.user.update({
//       where:{ id: resign.userId },
//       data:{ isActive:false }
//     });

//     // send email to user
//     sendMail({
//       to: resign.user.email,
//       subject:"Resignation Approved",
//       html:`<p>Your resignation request has been <b>Approved</b>.</p>`
//     });

//     return res.json({
//       success: true,
//       message: "Resignation approved & user deactivated",
//       resignation: resign,
//     });

//   } catch (err) {
//     console.log(err);
//     res.status(500).json({ message:"Something went wrong" });
//   }
// };


// /**
//  * Reject Resignation
//  * POST /resignation/:id/reject
//  */
// export const rejectResignation = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { reason } = req.body;

//     const resign = await prisma.resignation.update({
//       where: { id },
//       data: { status: "REJECTED", reason },
//       include:{ user:true }
//     });

//     sendMail({
//       to: resign.user.email,
//       subject:"Resignation Rejected",
//       html:`<p>Your resignation request was <b>Rejected</b>.<br/>Reason: ${reason}</p>`
//     });

//     return res.json({
//       success: true,
//       message: "Resignation rejected",
//       resignation: resign,
//     });

//   } catch (err) {
//     console.log(err);
//     res.status(500).json({ message:"Something went wrong" });
//   }
// };


// /**
//  * List Requests
//  * GET /resignation/list
//  * Admin/Manager only
//  */
// export const listResignations = async (req, res) => {
//   try {
//     const data = await prisma.resignation.findMany({
//       orderBy:{ createdAt:"desc" },
//       include:{
//         user:{
//           select:{ firstName:true,lastName:true,email:true,role:true }
//         }
//       }
//     });

//     res.json({ success:true, resignations:data });
//   } catch(err){
//     console.log(err)
//     res.status(500).json({ message:"Error fetching data" });
//   }
// };
