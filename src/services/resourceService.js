const { supabase } = require("../config/database");

class ResourceService {
  // Get all categories with their folders
  async getAllCategories() {
    const { data, error } = await supabase
      .from("resource_categories")
      .select("*")
      .order("name");

    if (error) throw error;
    return data;
  }

  async getFoldersByCategory(categoryId) {
    const { data, error } = await supabase
      .from("resource_folders")
      .select("*")
      .eq("category_id", categoryId)
      .order("name");

    if (error) throw error;
    return data;
  }

  async getFolderWithPIC(folderId) {
    const { data, error } = await supabase
      .from("resource_folders")
      .select(
        `
        *,
        resource_pics (*)
      `,
      )
      .eq("id", folderId)
      .single();

    if (error) throw error;
    return data;
  }

  // ===== GET PEOPLE LIST =====
  async getPeopleList() {
    // People data from the image
    const people = {
      head: ["Reynaldo Lamhot Silalahi"],
      internal: [
        "Michelle Alberta Ng",
        "Natasha Tessica",
        "Shariell Aditya I.",
      ],
      external: [
        "Andrew Marcello H.",
        "Athanasia Laras H.",
        "Edelweiss S. Priyono",
      ],
      sponsorship: ["Arya Sheva Satyatama", "Ivan Yudhistira"],
      business_capital: ["Raka Priyahita P.", "Ridhwan Fadhilah S."],
    };

    // Flatten all names
    const allNames = [
      ...people.head,
      ...people.internal,
      ...people.external,
      ...people.sponsorship,
      ...people.business_capital,
    ];

    return { people, allNames };
  }

  // ===== SEARCH & VALIDATE NAME =====
  async searchName(query) {
    const { allNames } = await this.getPeopleList();
    const queryLower = query.toLowerCase().trim();

    // Exact match
    const exactMatch = allNames.find(
      (name) => name.toLowerCase() === queryLower,
    );

    if (exactMatch) {
      return { matches: [exactMatch], exact: true };
    }

    // Partial match
    const partialMatches = allNames.filter(
      (name) =>
        name.toLowerCase().includes(queryLower) ||
        queryLower.includes(name.toLowerCase().split(" ")[0]),
    );

    return { matches: partialMatches, exact: false };
  }

  async assignPIC(folderId, picName, picWhatsapp = null) {
    // Check if already assigned
    const { data: existing } = await supabase
      .from("resource_pics")
      .select("*")
      .eq("folder_id", folderId)
      .eq("status", "active")
      .single();

    if (existing) {
      // Update existing PIC
      const { data, error } = await supabase
        .from("resource_pics")
        .update({
          pic_name: picName,
          pic_whatsapp: picWhatsapp,
          assigned_at: new Date(),
        })
        .eq("id", existing.id)
        .select();

      if (error) throw error;
      return data;
    }

    // Insert new PIC
    const { data, error } = await supabase
      .from("resource_pics")
      .insert({
        folder_id: folderId,
        pic_name: picName,
        pic_whatsapp: picWhatsapp,
        assigned_at: new Date(),
      })
      .select();

    if (error) throw error;
    return data;
  }

  // ===== DELETE ASSIGNMENT =====
  async deleteAssignment(folderId, password) {
    const PASSWORD = "070513";

    if (password !== PASSWORD) {
      return { success: false, message: "❌ Password salah!" };
    }

    const { data, error } = await supabase
      .from("resource_pics")
      .update({
        status: "inactive",
        deleted_at: new Date(),
      })
      .eq("folder_id", folderId)
      .eq("status", "active")
      .select();

    if (error) throw error;

    if (data.length === 0) {
      return {
        success: false,
        message: "❌ Tidak ada PIC aktif untuk folder ini.",
      };
    }

    return { success: true, message: `✅ PIC berhasil dihapus!`, data };
  }

  async getAllAssignments() {
    const { data, error } = await supabase
      .from("resource_pics")
      .select(
        `
        *,
        resource_folders (
          name,
          resource_categories (
            name,
            type
          )
        )
      `,
      )
      .eq("status", "active")
      .order("assigned_at", { ascending: false });

    if (error) throw error;
    return data;
  }

  async getAssignmentsByCategory(categoryType) {
    const { data, error } = await supabase
      .from("resource_pics")
      .select(
        `
        *,
        resource_folders (
          name,
          resource_categories (
            name,
            type
          )
        )
      `,
      )
      .eq("resource_folders.resource_categories.type", categoryType)
      .eq("status", "active");

    if (error) throw error;
    return data;
  }

  async createTask(
    folderId,
    taskName,
    description,
    priority = "medium",
    assignedTo = null,
    dueDate = null,
  ) {
    const { data, error } = await supabase
      .from("resource_tasks")
      .insert({
        folder_id: folderId,
        task_name: taskName,
        description,
        priority,
        assigned_to: assignedTo,
        due_date: dueDate,
        created_at: new Date(),
      })
      .select();

    if (error) throw error;
    return data;
  }

  async updateTaskStatus(taskId, status) {
    const { data, error } = await supabase
      .from("resource_tasks")
      .update({
        status,
        updated_at: new Date(),
      })
      .eq("id", taskId)
      .select();

    if (error) throw error;
    return data;
  }

  async getTasksByFolder(folderId) {
    const { data, error } = await supabase
      .from("resource_tasks")
      .select("*")
      .eq("folder_id", folderId)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  }

  // ===== GET PEOPLE BY ROLE =====
  async getPeopleByRole() {
    const { people } = await this.getPeopleList();
    return people;
  }

  // ===== LOGGING =====
  async logAssignment(folderId, action, picName, performedBy, details = null) {
    const { data, error } = await supabase.rpc("log_assignment", {
      p_folder_id: folderId,
      p_action: action,
      p_pic_name: picName,
      p_performed_by: performedBy,
      p_details: details,
    });

    if (error) throw error;
    return data;
  }

  // ===== GET PASSWORD FROM DB =====
  async getDeletePassword() {
    const { data, error } = await supabase
      .from("resource_settings")
      .select("value")
      .eq("key", "delete_password")
      .single();

    if (error) {
      // If not found, return default
      return "070513";
    }

    return data.value;
  }

  // ===== UPDATE PASSWORD =====
  async updateDeletePassword(newPassword, performedBy) {
    const { data, error } = await supabase
      .from("resource_settings")
      .update({
        value: newPassword,
        updated_at: new Date(),
      })
      .eq("key", "delete_password")
      .select();

    if (error) throw error;

    // Log password change
    await this.logAssignment(null, "update_password", null, performedBy, {
      newPassword,
    });

    return data;
  }

  // ===== GET ASSIGNMENT LOGS =====
  async getAssignmentLogs(folderId = null, limit = 50) {
    let query = supabase
      .from("assignment_logs")
      .select(
        `
      *,
      resource_folders (name)
    `,
      )
      .order("performed_at", { ascending: false })
      .limit(limit);

    if (folderId) {
      query = query.eq("folder_id", folderId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  // ===== UPDATE DELETE ASSIGNMENT =====
  async deleteAssignment(folderId, password, performedBy) {
    // Check password from database
    const correctPassword = await this.getDeletePassword();

    if (password !== correctPassword) {
      return { success: false, message: "❌ Password salah!" };
    }

    // Get current PIC first
    const { data: current } = await supabase
      .from("resource_pics")
      .select("*")
      .eq("folder_id", folderId)
      .eq("status", "active")
      .single();

    if (!current) {
      return {
        success: false,
        message: "❌ Tidak ada PIC aktif untuk folder ini.",
      };
    }

    // Update status
    const { data, error } = await supabase
      .from("resource_pics")
      .update({
        status: "inactive",
        deleted_at: new Date(),
      })
      .eq("id", current.id)
      .select();

    if (error) throw error;

    // Log the deletion
    await this.logAssignment(
      folderId,
      "delete",
      current.pic_name,
      performedBy,
      { deleted_by: performedBy },
    );

    return {
      success: true,
      message: `✅ PIC berhasil dihapus!`,
      data: {
        previous_pic: current.pic_name,
        folder_id: folderId,
      },
    };
  }
}

module.exports = new ResourceService();
