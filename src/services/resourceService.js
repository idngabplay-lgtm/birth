const { supabase } = require("../config/database");

class ResourceService {
  // Get all categories with their folders
  async getAllCategories() {
    const { data, error } = await supabase
      .from('resource_categories')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data;
  }

  async getFoldersByCategory(categoryId) {
    const { data, error } = await supabase
      .from('resource_folders')
      .select('*')
      .eq('category_id', categoryId)
      .order('name');
    
    if (error) throw error;
    return data;
  }

  async getFolderWithPIC(folderId) {
    const { data, error } = await supabase
      .from('resource_folders')
      .select(`
        *,
        resource_pics (*)
      `)
      .eq('id', folderId)
      .single();
    
    if (error) throw error;
    return data;
  }

  async assignPIC(folderId, picName, picWhatsapp = null) {
    // Check if already assigned
    const { data: existing } = await supabase
      .from('resource_pics')
      .select('*')
      .eq('folder_id', folderId)
      .eq('status', 'active')
      .single();

    if (existing) {
      // Update existing PIC
      const { data, error } = await supabase
        .from('resource_pics')
        .update({
          pic_name: picName,
          pic_whatsapp: picWhatsapp,
          assigned_at: new Date()
        })
        .eq('id', existing.id)
        .select();
      
      if (error) throw error;
      return data;
    }

    // Insert new PIC
    const { data, error } = await supabase
      .from('resource_pics')
      .insert({
        folder_id: folderId,
        pic_name: picName,
        pic_whatsapp: picWhatsapp,
        assigned_at: new Date()
      })
      .select();
    
    if (error) throw error;
    return data;
  }

  async getAllAssignments() {
    const { data, error } = await supabase
      .from('resource_pics')
      .select(`
        *,
        resource_folders (
          name,
          resource_categories (
            name,
            type
          )
        )
      `)
      .eq('status', 'active')
      .order('assigned_at', { ascending: false });
    
    if (error) throw error;
    return data;
  }

  async getAssignmentsByCategory(categoryType) {
    const { data, error } = await supabase
      .from('resource_pics')
      .select(`
        *,
        resource_folders (
          name,
          resource_categories (
            name,
            type
          )
        )
      `)
      .eq('resource_folders.resource_categories.type', categoryType)
      .eq('status', 'active');
    
    if (error) throw error;
    return data;
  }

  // Create task for a folder
  async createTask(folderId, taskName, description, priority = 'medium', assignedTo = null, dueDate = null) {
    const { data, error } = await supabase
      .from('resource_tasks')
      .insert({
        folder_id: folderId,
        task_name: taskName,
        description,
        priority,
        assigned_to: assignedTo,
        due_date: dueDate,
        created_at: new Date()
      })
      .select();
    
    if (error) throw error;
    return data;
  }

  async updateTaskStatus(taskId, status) {
    const { data, error } = await supabase
      .from('resource_tasks')
      .update({
        status,
        updated_at: new Date()
      })
      .eq('id', taskId)
      .select();
    
    if (error) throw error;
    return data;
  }

  async getTasksByFolder(folderId) {
    const { data, error } = await supabase
      .from('resource_tasks')
      .select('*')
      .eq('folder_id', folderId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  }
}

module.exports = new ResourceService();