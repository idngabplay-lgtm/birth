const { supabase } = require("../config/database");

class AdminService {
  async getAdmins() {
    try {
      console.log("📝 getAdmins() called");
      const { data, error } = await supabase
        .from("admins")
        .select("number")
        .order("number");

      if (error) {
        console.error("❌ Error getAdmins:", error);
        throw error;
      }

      console.log("📊 Admins from DB:", data);

      if (!data || data.length === 0) {
        console.log("⚠️ No admins found, using default");
        const defaultAdmin = process.env.DEFAULT_ADMIN || "6282114499617";
        await this.addAdmin(defaultAdmin);
        return [defaultAdmin];
      }

      return data.map((item) => item.number);
    } catch (error) {
      console.error("❌ Error getting admins:", error);
      return [process.env.DEFAULT_ADMIN || "6282114499617"];
    }
  }

  async isAdmin(number) {
    try {
      console.log(`🔍 isAdmin() checking: ${number}`);

      let lidNumber = number;
      let phoneNumber = number;

      if (number.includes("@lid")) {
        lidNumber = number.split("@")[0];
        phoneNumber = process.env.DEFAULT_ADMIN || "6282114499617";
      }

      const cleanPhone = this.cleanNumber(phoneNumber);
      const isLID = lidNumber.length >= 12 && lidNumber.startsWith("1229");
      const lidToCheck = isLID ? `lid_${lidNumber}` : lidNumber;

      // Check LID
      const { data: lidData, error: lidError } = await supabase
        .from("admins")
        .select("number")
        .eq("number", lidToCheck)
        .single();

      if (!lidError && lidData) {
        return true;
      }

      // Check Phone
      const { data: phoneData, error: phoneError } = await supabase
        .from("admins")
        .select("number")
        .eq("number", cleanPhone)
        .single();

      if (!phoneError && phoneData) {
        if (isLID && lidToCheck !== cleanPhone) {
          await this.addAdmin(lidToCheck);
        }
        return true;
      }

      const defaultAdmin = process.env.DEFAULT_ADMIN || "6282114499617";
      if (cleanPhone === defaultAdmin) {
        await this.addAdmin(defaultAdmin);
        if (isLID && lidToCheck !== defaultAdmin) {
          await this.addAdmin(lidToCheck);
        }
        return true;
      }

      return false;
    } catch (error) {
      console.error("❌ Error checking admin:", error);
      const defaultAdmin = process.env.DEFAULT_ADMIN || "6282114499617";
      const cleanNumber = this.cleanNumber(number);
      return cleanNumber === defaultAdmin || number.includes("122917836841193");
    }
  }

  async addAdmin(number) {
    try {
      let valueToStore = number;
      let isLID = false;

      if (number.includes("@lid")) {
        const extracted = number.split("@")[0];
        if (extracted.length >= 12 && extracted.startsWith("1229")) {
          valueToStore = `lid_${extracted}`;
          isLID = true;
        } else {
          valueToStore = this.cleanNumber(extracted);
        }
      } else if (number.length >= 12 && number.startsWith("1229")) {
        valueToStore = `lid_${number}`;
        isLID = true;
      } else {
        valueToStore = this.cleanNumber(number);
      }

      const { data: existing } = await supabase
        .from("admins")
        .select("number")
        .eq("number", valueToStore)
        .single();

      if (existing) {
        return true;
      }

      const { error } = await supabase
        .from("admins")
        .insert({ number: valueToStore });

      if (error) throw error;
      console.log(`✅ Admin added: ${valueToStore}`);
      return true;
    } catch (error) {
      console.error("❌ Error adding admin:", error);
      return false;
    }
  }

  async removeAdmin(number) {
    try {
      let valueToRemove = number;

      if (number.includes("@lid")) {
        const extracted = number.split("@")[0];
        if (extracted.length >= 12 && extracted.startsWith("1229")) {
          valueToRemove = `lid_${extracted}`;
        }
      } else if (number.length >= 12 && number.startsWith("1229")) {
        valueToRemove = `lid_${number}`;
      } else {
        valueToRemove = this.cleanNumber(number);
      }

      const defaultAdmin = process.env.DEFAULT_ADMIN || "6282114499617";
      if (
        valueToRemove === defaultAdmin ||
        valueToRemove === `lid_${defaultAdmin}`
      ) {
        throw new Error("Cannot remove default admin");
      }

      const { error } = await supabase
        .from("admins")
        .delete()
        .eq("number", valueToRemove);

      if (error) throw error;
      console.log(`✅ Admin removed: ${valueToRemove}`);
      return true;
    } catch (error) {
      console.error("Error removing admin:", error);
      return false;
    }
  }

  // ===== NEW: Self Admin Request System =====
  async requestSelfAdmin(number) {
    try {
      const cleanNumber = this.cleanNumber(number);

      // Check if already admin
      const isAdmin = await this.isAdmin(number);
      if (isAdmin) {
        return { success: false, message: "Anda sudah menjadi admin!" };
      }

      // Check if already requested
      const { data: existing } = await supabase
        .from("admin_requests")
        .select("*")
        .eq("number", cleanNumber)
        .eq("status", "pending")
        .single();

      if (existing) {
        return {
          success: false,
          message: "Permintaan sudah terkirim! Tunggu persetujuan admin.",
        };
      }

      // Create request
      const { error } = await supabase.from("admin_requests").insert({
        number: cleanNumber,
        status: "pending",
        requested_at: new Date(),
        lid: number.includes("@lid") ? number.split("@")[0] : null,
      });

      if (error) throw error;

      return {
        success: true,
        message:
          "✅ Permintaan menjadi admin telah dikirim! Tunggu persetujuan dari admin lain.",
      };
    } catch (error) {
      console.error("Error requesting admin:", error);
      return { success: false, message: `❌ Error: ${error.message}` };
    }
  }

  async getPendingRequests() {
    try {
      const { data, error } = await supabase
        .from("admin_requests")
        .select("*")
        .eq("status", "pending")
        .order("requested_at", { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error getting pending requests:", error);
      return [];
    }
  }

  async acceptAdminRequest(requestId, approverNumber) {
    try {
      // Check if approver is admin
      const isAdmin = await this.isAdmin(approverNumber);
      if (!isAdmin) {
        return {
          success: false,
          message: "❌ Hanya admin yang bisa menyetujui permintaan!",
        };
      }

      // Get request
      const { data: request, error: getError } = await supabase
        .from("admin_requests")
        .select("*")
        .eq("id", requestId)
        .single();

      if (getError || !request) {
        return { success: false, message: "❌ Permintaan tidak ditemukan!" };
      }

      if (request.status !== "pending") {
        return {
          success: false,
          message: `❌ Permintaan sudah ${request.status}!`,
        };
      }

      // Add as admin
      const addResult = await this.addAdmin(request.number);
      if (!addResult) {
        return { success: false, message: "❌ Gagal menambahkan admin!" };
      }

      // Update request status
      const { error: updateError } = await supabase
        .from("admin_requests")
        .update({
          status: "approved",
          approved_at: new Date(),
          approved_by: this.cleanNumber(approverNumber),
        })
        .eq("id", requestId);

      if (updateError) throw updateError;

      return {
        success: true,
        message: `✅ Admin berhasil ditambahkan! Nomor: ${request.number}`,
        data: request,
      };
    } catch (error) {
      console.error("Error accepting admin request:", error);
      return { success: false, message: `❌ Error: ${error.message}` };
    }
  }

  async rejectAdminRequest(requestId, approverNumber) {
    try {
      const isAdmin = await this.isAdmin(approverNumber);
      if (!isAdmin) {
        return {
          success: false,
          message: "❌ Hanya admin yang bisa menolak permintaan!",
        };
      }

      const { data: request, error: getError } = await supabase
        .from("admin_requests")
        .select("*")
        .eq("id", requestId)
        .single();

      if (getError || !request) {
        return { success: false, message: "❌ Permintaan tidak ditemukan!" };
      }

      if (request.status !== "pending") {
        return {
          success: false,
          message: `❌ Permintaan sudah ${request.status}!`,
        };
      }

      const { error: updateError } = await supabase
        .from("admin_requests")
        .update({
          status: "rejected",
          approved_at: new Date(),
          approved_by: this.cleanNumber(approverNumber),
        })
        .eq("id", requestId);

      if (updateError) throw updateError;

      return {
        success: true,
        message: `✅ Permintaan admin ditolak! Nomor: ${request.number}`,
        data: request,
      };
    } catch (error) {
      console.error("Error rejecting admin request:", error);
      return { success: false, message: `❌ Error: ${error.message}` };
    }
  }

  cleanNumber(number) {
    if (!number) return "";
    let clean = number.replace(/\s/g, "").replace(/^\+/, "");
    clean = clean.replace(/\D/g, "");
    return clean;
  }
}

module.exports = new AdminService();
