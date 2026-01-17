import prisma from "../prismaClient.js";

/* ====================================================
   COMMON INCLUDE (SINGLE SOURCE OF TRUTH)
==================================================== */
const departmentInclude = {
  members: {
        where: {
      user: { isActive: true }   // 🔥 ADD THIS
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true
        }
      }
    }
  },
  managers: {
      where: {
      isActive: true  // 🔥 ADD THIS
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true
    }
  }
};

/* ====================================================
   LIST DEPARTMENTS
==================================================== */
export const listDepartments = async (req, res) => {
  try {
    const user = req.user;

    const where =
      user.role === "ADMIN"
        ? {}
        : {
            OR: [
              { members: { some: { userId: user.id } } },
              { managers: { some: { id: user.id } } }
            ]
          };

    const departments = await prisma.department.findMany({
      where,
      include: departmentInclude,
      orderBy: { name: "asc" }
    });

    return res.json({ success: true, departments });
  } catch (error) {
    console.error("listDepartments ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load departments"
    });
  }
};

/* ====================================================
   CREATE DEPARTMENT
==================================================== */
export const createDepartment = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only admin can create departments"
      });
    }

    let { name, managerIds = [] } = req.body;
    name = name?.trim();

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Department name is required"
      });
    }

    // remove duplicate manager ids
    managerIds = [...new Set(managerIds)];

    // validate managers
    for (const id of managerIds) {
      const manager = await prisma.user.findUnique({
        where: { id,  isActive: true, }
      });

      if (!manager || manager.role === "ADMIN") {
        return res.status(400).json({
          success: false,
          message: "Invalid manager selected"
        });
      }
    }

    const department = await prisma.department.create({
      data: {
        name,
        managers: {
          connect: managerIds.map((id) => ({ id }))
        }
      },
      include: departmentInclude
    });

    return res.json({
      success: true,
      message: "Department created successfully",
      department
    });

  } catch (error) {
    console.error("createDepartment ERROR:", error);

    if (error.code === "P2002") {
      return res.status(400).json({
        success: false,
        message: "Department name already exists"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

/* ====================================================
   UPDATE DEPARTMENT
==================================================== */
export const updateDepartment = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Admin only"
      });
    }

    const { id } = req.params;
    let { name, managerIds = [] } = req.body;
    name = name?.trim();

    const existing = await prisma.department.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Department not found"
      });
    }

    managerIds = [...new Set(managerIds)];

    await prisma.department.update({
      where: { id },
      data: {
        ...(name && { name }),
        managers: {
          set: managerIds.map((id) => ({ id }))
        }
      }
    });

    const department = await prisma.department.findUnique({
      where: { id },
      include: departmentInclude
    });

    return res.json({
      success: true,
      message: "Department updated successfully",
      department
    });

  } catch (error) {
    console.error("updateDepartment ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

/* ====================================================
   DELETE DEPARTMENT
==================================================== */
export const deleteDepartment = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Admin only"
      });
    }

    const { id } = req.params;

    const existing = await prisma.department.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Department not found"
      });
    }

    // 🟢 CLEAN JOIN TABLE (VERY IMPORTANT)
    await prisma.userDepartment.deleteMany({
      where: { departmentId: id }
    });

    await prisma.department.delete({
      where: { id }
    });

    return res.json({
      success: true,
      message: "Department deleted successfully"
    });
  } catch (error) {
    console.error("deleteDepartment ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};
