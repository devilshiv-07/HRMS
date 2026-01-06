// import prisma from "./src/prismaClient.js";

// const getDayName = (date) =>
//   new Date(date).toLocaleDateString("en-US", { weekday: "long" });

// async function seed() {
// const list = [
//   { title:"Republic Day",     date:"2026-01-26" }, // Monday
//   { title:"Holi",             date:"2026-03-04" }, // Wednesday
//   { title:"Independence Day", date:"2026-08-15" }, // Saturday
//   { title:"Janmashtami",      date:"2026-09-04" }, // Friday
//   { title:"Gandhi Jayanti",   date:"2026-10-02" }, // Friday
//   { title:"Dussehra",         date:"2026-10-20" }, // Tuesday
//   { title:"Diwali",           date:"2026-11-08" }, // Sunday
//   { title:"Bhaidooj",         date:"2026-11-10" }, // Tuesday
//   { title:"Chatt Puja",       date:"2026-11-14" }, // Saturday
//   { title:"Christmas Day",    date:"2026-12-25" }, // Friday
// ];

//   await prisma.holiday.createMany({
//     data: list.map(h => ({
//       title: h.title,
//       date: new Date(h.date),        // ⭐ Mandatory fix
//       day: getDayName(h.date)
//     })),
//     skipDuplicates: true
//   });

//   console.log("🎉 Holidays Seeded Successfully");
//   process.exit(0);
// }

// seed();
