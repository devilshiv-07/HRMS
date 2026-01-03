import prisma from "../prismaClient.js";

/* =================== Helper inside same file =================== */
const getDayName = (date) => {
  return new Date(date).toLocaleDateString("en-US", { weekday: "long" });
};


/* ================= LIST ================= */
export const listHolidays = async (req,res)=>{
  try{
    const holidays = await prisma.holiday.findMany({ orderBy:{date:"asc"} });
    res.json({ total: holidays.length, holidays });
  }catch(err){ res.status(500).json({error:err.message}); }
};


/* ================= CREATE ================= */
export const createHoliday = async (req,res)=>{
  try{
    const {title,date,description} = req.body;
    if(!title || !date) return res.status(400).json({message:"Title & Date required"});

    const holiday = await prisma.holiday.create({
      data:{ 
        title,
        date:new Date(date),
        day:getDayName(date),         // <-- day auto add
        description
      }
    });

    res.status(201).json({message:"Holiday created", holiday});
  }catch(err){ res.status(500).json({error:err.message}); }
};


/* ================= UPDATE ================= */
export const updateHoliday = async (req,res)=>{
  try{
    const {id} = req.params;
    const {title,date,description} = req.body;

    const holiday = await prisma.holiday.update({
      where:{id},
      data:{
        ...(title && {title}),
        ...(date && {date:new Date(date), day:getDayName(date)}), // <-- date change → day update
        ...(description && {description})
      }
    });

    res.json({message:"Holiday updated",holiday});
  }catch(err){ res.status(500).json({error:err.message}); }
};


/* ================= DELETE ================= */
export const deleteHoliday = async (req,res)=>{
  try{
    await prisma.holiday.delete({ where:{id:req.params.id} });
    res.json({message:"Holiday removed"});
  }catch(err){ res.status(500).json({error:err.message}); }
};


/* ================= UPCOMING ================= */
export const upcomingHolidays = async (req,res)=>{
  try{
    const today=new Date();
    const upcoming = await prisma.holiday.findMany({
      where:{date:{gte:today}},
      orderBy:{date:"asc"},
      take:5
    });

    res.json({ upcoming });
  }catch(err){ res.status(500).json({error:err.message}); }
};


/* ================= BULK SEED (AUTO DAY) ================= */
export const bulkSeedHolidays = async (req,res)=>{
  try{
    const list=[
      {title:"Republic Day",date:"2025-01-26"},
      {title:"Holi",date:"2025-03-04"},
      {title:"Independence Day",date:"2025-08-15"},
      {title:"Janmashtami",date:"2025-09-04"},
      {title:"Gandhi Jayanti",date:"2025-10-02"},
      {title:"Dussehra",date:"2025-10-20"},
      {title:"Diwali",date:"2025-11-08"},
      {title:"Bhaidooj",date:"2025-11-10"},
      {title:"Chatt Puja",date:"2025-11-14"},
      {title:"Christmas Day",date:"2025-12-25"},
    ];

    await prisma.holiday.createMany({
      data:list.map(h=>({
        ...h,
        day:getDayName(h.date)   // <- day automatically generated
      })),
      skipDuplicates:true
    });

    res.json({message:"Holiday Seeded Successfully"});
  }catch(err){ res.status(500).json({error:err.message}); }
};
