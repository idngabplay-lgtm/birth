const { supabase } = require('../config/database');

class EmployeeService {
  async getAll() {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data;
  }

  async getByDepartment(department) {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .ilike('department', `%${department}%`)
      .order('name');
    
    if (error) throw error;
    return data;
  }

  async addEmployee(name, position, department, joinDate) {
    const { data, error } = await supabase
      .from('employees')
      .insert({
        name,
        position,
        department,
        join_date: joinDate,
        created_at: new Date()
      })
      .select();
    
    if (error) throw error;
    return data;
  }

  async deleteEmployee(name) {
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('name', name);
    
    if (error) throw error;
    return true;
  }

  async getStats() {
    const all = await this.getAll();
    const departments = {};
    
    all.forEach(emp => {
      if (!departments[emp.department]) {
        departments[emp.department] = 0;
      }
      departments[emp.department]++;
    });
    
    return {
      total: all.length,
      departments
    };
  }

  calculateTenure(joinDate) {
    const join = new Date(joinDate);
    const now = new Date();
    const diffTime = Math.abs(now - join);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    
    return { years, months, totalDays: diffDays };
  }

  async getWorkAnniversary(month) {
    const all = await this.getAll();
    const now = new Date();
    const targetMonth = month || now.getMonth() + 1;
    
    const anniversary = all.filter(emp => {
      const join = new Date(emp.join_date);
      return join.getMonth() + 1 === targetMonth;
    });
    
    return anniversary.map(emp => ({
      ...emp,
      tenure: this.calculateTenure(emp.join_date)
    }));
  }
}

module.exports = new EmployeeService();