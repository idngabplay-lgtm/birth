const birthdateService = require("../services/birthdateService");
const adminService = require("../services/adminService");
const {
  formatDate,
  formatBirthdate,
  formatDaysRemaining,
} = require("../utils/formatter");

class BirthdateCommand {
  async handleSetBirth(sock, sender, message) {
    const parts = message
      .substring(10)
      .trim()
      .split("|")
      .map((p) => p.trim());

    if (parts.length !== 2) {
      await sock.sendMessage(sender, {
        text: "❌ Format salah!\n\nGunakan:\n/setBirth Nama | YYYY-MM-DD\nContoh: /setBirth Reynaldo | 2007-05-13",
      });
      return;
    }

    const [name, birthdate] = parts;

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(birthdate)) {
      await sock.sendMessage(sender, {
        text: "❌ Format tanggal salah! Gunakan YYYY-MM-DD\nContoh: 2007-05-13",
      });
      return;
    }

    try {
      await birthdateService.save(name, birthdate);
      const age = birthdateService.calculateAge(birthdate);

      await sock.sendMessage(sender, {
        text: `✅ Data berhasil disimpan!\n\n📝 Nama: ${name}\n📅 Tanggal Lahir: ${formatDate(birthdate)}\n🎂 Umur: ${age} tahun`,
      });
    } catch (error) {
      await sock.sendMessage(sender, {
        text: `❌ Gagal menyimpan data: ${error.message}`,
      });
    }
  }

  async handleListBirth(sock, sender) {
    const data = await birthdateService.getAll();

    if (data.length === 0) {
      await sock.sendMessage(sender, {
        text: "📭 Belum ada data birthdate.\nGunakan /setBirth untuk menambah data.",
      });
      return;
    }

    let message = "📋 **DAFTAR BIRTHDATE**\n\n";
    data.forEach((item) => {
      const age = birthdateService.calculateAge(item.birthdate);
      message += `👤 ${item.name}\n📅 ${formatDate(item.birthdate)}\n🎂 ${age} tahun\n\n`;
    });
    message += `📁 Total: ${data.length} data`;

    await sock.sendMessage(sender, { text: message });
  }

  async handleSearchBirth(sock, sender, keyword) {
    if (!keyword) {
      await sock.sendMessage(sender, {
        text: "❌ Masukkan keyword pencarian!\nContoh: /searchBirth Reynaldo",
      });
      return;
    }

    const results = await birthdateService.getByName(keyword);

    if (results.length === 0) {
      await sock.sendMessage(sender, {
        text: `🔍 Tidak ditemukan data untuk: "${keyword}"`,
      });
      return;
    }

    let message = `🔍 **HASIL PENCARIAN: "${keyword}"**\n\n`;
    results.forEach((item) => {
      const age = birthdateService.calculateAge(item.birthdate);
      message += `👤 ${item.name}\n📅 ${formatDate(item.birthdate)}\n🎂 ${age} tahun\n\n`;
    });
    message += `📁 Ditemukan: ${results.length} data`;

    await sock.sendMessage(sender, { text: message });
  }

  async handleBirthToday(sock, sender) {
    const today = await birthdateService.getToday();

    if (today.length === 0) {
      await sock.sendMessage(sender, {
        text: "📭 Tidak ada yang berulang tahun hari ini.",
      });
      return;
    }

    let message = "🎂 **ULANG TAHUN HARI INI!** 🎉\n\n";
    today.forEach((item) => {
      const age = birthdateService.calculateAge(item.birthdate);
      message += `👤 ${item.name}\n🎂 ${age} tahun\n\n`;
    });
    message += "🎊 Selamat ulang tahun! 🎊";

    await sock.sendMessage(sender, { text: message });
  }

  async handleBirthMonth(sock, sender) {
    const thisMonth = await birthdateService.getThisMonth();

    if (thisMonth.length === 0) {
      await sock.sendMessage(sender, {
        text: "📭 Tidak ada yang berulang tahun bulan ini.",
      });
      return;
    }

    let message = "📅 **ULANG TAHUN BULAN INI**\n\n";
    thisMonth.forEach((item) => {
      const age = birthdateService.calculateAge(item.birthdate);
      message += `👤 ${item.name}\n📅 ${formatDate(item.birthdate)}\n🎂 ${age} tahun\n\n`;
    });
    message += `📁 Total: ${thisMonth.length} orang`;

    await sock.sendMessage(sender, { text: message });
  }

  async handleUpcomingBirth(sock, sender) {
    const upcoming = await birthdateService.getUpcoming(10);

    if (upcoming.length === 0) {
      await sock.sendMessage(sender, {
        text: "📭 Tidak ada data untuk ditampilkan.",
      });
      return;
    }

    let message = "⏰ **10 ULANG TAHUN TERDEKAT**\n\n";
    upcoming.forEach((item, index) => {
      message += `${index + 1}. ${item.name}\n`;
      message += `   📅 ${formatDate(item.birthdate)}\n`;
      message += `   ⏳ ${formatDaysRemaining(item.daysRemaining)}\n`;
      message += `   🎂 ${item.age} tahun\n\n`;
    });

    await sock.sendMessage(sender, { text: message });
  }

  async handleCountBirth(sock, sender) {
    const stats = await birthdateService.getStats();
    const upcoming = await birthdateService.getUpcoming(3);

    let message = "📊 **STATISTIK BIRTHDATE**\n\n";
    message += `📁 Total Data: ${stats.total}\n`;
    message += `🎂 Ulang tahun hari ini: ${stats.today}\n`;
    message += `📅 Ulang tahun bulan ini: ${stats.thisMonth}\n`;

    if (upcoming.length > 0) {
      message += "\n⏰ **3 Terdekat:**\n";
      upcoming.forEach((item) => {
        message += `   • ${item.name} (${item.daysRemaining} hari lagi)\n`;
      });
    }

    await sock.sendMessage(sender, { text: message });
  }

  // Admin commands
  async handleEditBirth(sock, sender, message, isAdmin) {
    if (!isAdmin) {
      await sock.sendMessage(sender, {
        text: "❌ Akses ditolak! Hanya admin yang bisa mengedit data.",
      });
      return;
    }

    const parts = message
      .substring(11)
      .trim()
      .split("|")
      .map((p) => p.trim());

    if (parts.length !== 2) {
      await sock.sendMessage(sender, {
        text: "❌ Format salah!\nGunakan: /editBirth Nama | YYYY-MM-DD",
      });
      return;
    }

    const [name, birthdate] = parts;

    try {
      await birthdateService.save(name, birthdate);
      await sock.sendMessage(sender, {
        text: `✅ Data berhasil diupdate!\n📝 Nama: ${name}\n📅 Tanggal Lahir: ${formatDate(birthdate)}`,
      });
    } catch (error) {
      await sock.sendMessage(sender, {
        text: `❌ Gagal mengupdate data: ${error.message}`,
      });
    }
  }

  async handleDeleteBirth(sock, sender, name, isAdmin) {
    if (!isAdmin) {
      await sock.sendMessage(sender, {
        text: "❌ Akses ditolak! Hanya admin yang bisa menghapus data.",
      });
      return;
    }

    if (!name) {
      await sock.sendMessage(sender, {
        text: "❌ Masukkan nama yang akan dihapus!\nContoh: /deleteBirth Reynaldo",
      });
      return;
    }

    try {
      await birthdateService.delete(name);
      await sock.sendMessage(sender, {
        text: `✅ Data berhasil dihapus!\n📝 Nama: ${name}`,
      });
    } catch (error) {
      await sock.sendMessage(sender, {
        text: `❌ Gagal menghapus data: ${error.message}`,
      });
    }
  }
}

module.exports = new BirthdateCommand();
