const { supabase } = require("../config/database");

class BirthdateService {
  async getAll() {
    const { data, error } = await supabase
      .from("birthdates")
      .select("*")
      .order("name");

    if (error) throw error;
    return data;
  }

  async getByName(name) {
    const { data, error } = await supabase
      .from("birthdates")
      .select("*")
      .ilike("name", `%${name}%`);

    if (error) throw error;
    return data;
  }

  async save(name, birthdate) {
    const { data, error } = await supabase
      .from("birthdates")
      .upsert(
        { name, birthdate, updated_at: new Date() },
        { onConflict: "name" },
      )
      .select();

    if (error) throw error;
    return data;
  }

  async delete(name) {
    const { error } = await supabase
      .from("birthdates")
      .delete()
      .eq("name", name);

    if (error) throw error;
    return true;
  }

  async clearAll() {
    const { error } = await supabase.from("birthdates").delete().neq("id", 0);

    if (error) throw error;
    return true;
  }

  // ===== FIX: Get today's birthdays using RPC =====
  async getToday() {
    try {
      // Create a PostgreSQL function first (run this in SQL Editor once)
      // Then call it here
      const { data, error } = await supabase.rpc("get_today_birthdays");

      if (error) {
        console.error("Error calling RPC get_today_birthdays:", error);
        // Fallback to manual filtering
        return this.getTodayFallback();
      }

      return data || [];
    } catch (error) {
      console.error("Error in getToday:", error);
      return this.getTodayFallback();
    }
  }

  // Fallback: Manual filtering
  async getTodayFallback() {
    try {
      const all = await this.getAll();
      const today = new Date();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");

      return all.filter((item) => {
        const birth = new Date(item.birthdate);
        const birthMonth = String(birth.getMonth() + 1).padStart(2, "0");
        const birthDay = String(birth.getDate()).padStart(2, "0");
        return birthMonth === month && birthDay === day;
      });
    } catch (error) {
      console.error("Error in getTodayFallback:", error);
      return [];
    }
  }

  // ===== FIX: Get this month's birthdays =====
  async getThisMonth() {
    try {
      const { data, error } = await supabase.rpc("get_month_birthdays", {
        target_month: new Date().getMonth() + 1,
      });

      if (error) {
        console.error("Error calling RPC get_month_birthdays:", error);
        return this.getThisMonthFallback();
      }

      return data || [];
    } catch (error) {
      console.error("Error in getThisMonth:", error);
      return this.getThisMonthFallback();
    }
  }

  async getThisMonthFallback() {
    try {
      const all = await this.getAll();
      const today = new Date();
      const month = String(today.getMonth() + 1).padStart(2, "0");

      return all.filter((item) => {
        const birth = new Date(item.birthdate);
        const birthMonth = String(birth.getMonth() + 1).padStart(2, "0");
        return birthMonth === month;
      });
    } catch (error) {
      console.error("Error in getThisMonthFallback:", error);
      return [];
    }
  }

  calculateAge(birthdate) {
    const birth = new Date(birthdate);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }

  async getUpcoming(limit = 10) {
    const all = await this.getAll();
    const now = new Date();

    const upcoming = all.map((item) => {
      const birth = new Date(item.birthdate);
      const birthThisYear = new Date(
        now.getFullYear(),
        birth.getMonth(),
        birth.getDate(),
      );
      const birthNextYear = new Date(
        now.getFullYear() + 1,
        birth.getMonth(),
        birth.getDate(),
      );

      let nextBirthday = birthThisYear > now ? birthThisYear : birthNextYear;
      const diffDays = Math.ceil((nextBirthday - now) / (1000 * 60 * 60 * 24));

      return {
        ...item,
        nextBirthday,
        daysRemaining: diffDays,
        age: this.calculateAge(item.birthdate),
      };
    });

    return upcoming
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, limit);
  }

  async getStats() {
    const all = await this.getAll();
    const today = await this.getToday();
    const thisMonth = await this.getThisMonth();

    return {
      total: all.length,
      today: today.length,
      thisMonth: thisMonth.length,
    };
  }
}

module.exports = new BirthdateService();
