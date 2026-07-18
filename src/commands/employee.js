const employeeService = require('../services/employeeService');
const { formatDate } = require('../utils/formatter');

class EmployeeCommand {
  async handleAddEmployee(sock, sender, message, isAdmin) {
    try {
      if (!isAdmin) {
        await sock.sendMessage(sender, {
          text: '❌ Akses ditolak! Hanya admin yang bisa menambah karyawan.'
        });
        return;
      }

      const parts = message.substring(13).trim().split('|').map(p => p.trim());
      
      if (parts.length !== 4) {
        await sock.sendMessage(sender, {
          text: '❌ Format salah!\n\nGunakan:\n/addEmployee Nama | Posisi | Departemen | YYYY-MM-DD\n\nContoh:\n/addEmployee Reynaldo | HR Manager | Human Resources | 2020-05-13'
        });
        return;
      }

      const [name, position, department, joinDate] = parts;
      
      await employeeService.addEmployee(name, position, department, joinDate);
      await sock.sendMessage(sender, {
        text: `✅ Karyawan berhasil ditambahkan!\n\n👤 Nama: ${name}\n💼 Posisi: ${position}\n🏢 Departemen: ${department}\n📅 Bergabung: ${formatDate(joinDate)}`
      });
    } catch (error) {
      console.error('Error in handleAddEmployee:', error);
      await sock.sendMessage(sender, {
        text: `❌ Gagal menambah karyawan: ${error.message}`
      });
    }
  }

  async handleListEmployees(sock, sender) {
    try {
      const employees = await employeeService.getAll();
      
      if (employees.length === 0) {
        await sock.sendMessage(sender, {
          text: '📭 Belum ada data karyawan.'
        });
        return;
      }

      let message = '👥 **DAFTAR KARYAWAN**\n\n';
      employees.forEach(emp => {
        const tenure = employeeService.calculateTenure(emp.join_date);
        message += `👤 ${emp.name}\n`;
        message += `💼 ${emp.position}\n`;
        message += `🏢 ${emp.department}\n`;
        message += `📅 Bergabung: ${formatDate(emp.join_date)}\n`;
        message += `⏳ Masa kerja: ${tenure.years} tahun ${tenure.months} bulan\n\n`;
      });
      message += `📁 Total: ${employees.length} karyawan`;

      await sock.sendMessage(sender, { text: message });
    } catch (error) {
      console.error('Error in handleListEmployees:', error);
      await sock.sendMessage(sender, {
        text: `❌ Gagal mengambil data: ${error.message}`
      });
    }
  }

  async handleEmployeeStats(sock, sender) {
    try {
      const stats = await employeeService.getStats();
      
      let message = '📊 **STATISTIK KARYAWAN**\n\n';
      message += `👥 Total Karyawan: ${stats.total}\n\n`;
      message += '🏢 **Per Departemen:**\n';
      
      if (Object.keys(stats.departments).length === 0) {
        message += '   • Belum ada data departemen\n';
      } else {
        Object.entries(stats.departments).forEach(([dept, count]) => {
          message += `   • ${dept}: ${count} orang\n`;
        });
      }

      await sock.sendMessage(sender, { text: message });
    } catch (error) {
      console.error('Error in handleEmployeeStats:', error);
      await sock.sendMessage(sender, {
        text: `❌ Gagal mengambil statistik: ${error.message}`
      });
    }
  }

  async handleWorkAnniversary(sock, sender) {
    try {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const anniversary = await employeeService.getWorkAnniversary(currentMonth);
      
      if (anniversary.length === 0) {
        await sock.sendMessage(sender, {
          text: `📭 Tidak ada karyawan yang merayakan masa kerja bulan ini.`
        });
        return;
      }

      let message = `🎉 **MASA KERJA BULAN INI**\n\n`;
      anniversary.forEach(emp => {
        message += `👤 ${emp.name}\n`;
        message += `💼 ${emp.position}\n`;
        message += `🏢 ${emp.department}\n`;
        message += `⏳ ${emp.tenure.years} tahun ${emp.tenure.months} bulan\n\n`;
      });

      await sock.sendMessage(sender, { text: message });
    } catch (error) {
      console.error('Error in handleWorkAnniversary:', error);
      await sock.sendMessage(sender, {
        text: `❌ Gagal mengambil data: ${error.message}`
      });
    }
  }

  async handleSearchEmployee(sock, sender, keyword) {
    try {
      if (!keyword) {
        await sock.sendMessage(sender, {
          text: '❌ Masukkan keyword pencarian!\nContoh: /searchEmployee Reynaldo'
        });
        return;
      }

      const employees = await employeeService.getByDepartment(keyword);
      
      if (employees.length === 0) {
        await sock.sendMessage(sender, {
          text: `🔍 Tidak ditemukan karyawan di departemen: "${keyword}"`
        });
        return;
      }

      let message = `🔍 **KARYAWAN DI DEPARTEMEN: "${keyword.toUpperCase()}"**\n\n`;
      employees.forEach(emp => {
        const tenure = employeeService.calculateTenure(emp.join_date);
        message += `👤 ${emp.name}\n`;
        message += `💼 ${emp.position}\n`;
        message += `⏳ ${tenure.years} tahun ${tenure.months} bulan\n\n`;
      });
      message += `📁 Total: ${employees.length} karyawan`;

      await sock.sendMessage(sender, { text: message });
    } catch (error) {
      console.error('Error in handleSearchEmployee:', error);
      await sock.sendMessage(sender, {
        text: `❌ Gagal mencari karyawan: ${error.message}`
      });
    }
  }
}

module.exports = new EmployeeCommand();