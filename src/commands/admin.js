const adminService = require("../services/adminService");
const birthdateService = require("../services/birthdateService");
const employeeService = require("../services/employeeService");

class AdminCommand {
  async handleSelfAdmin(sock, sender, isAdmin) {
    try {
      if (isAdmin) {
        await sock.sendMessage(sender, {
          text: "✅ Anda sudah menjadi admin!",
        });
        return;
      }

      const result = await adminService.requestSelfAdmin(sender);
      await sock.sendMessage(sender, {
        text: result.message,
      });

      // Notify all admins about new request
      if (result.success) {
        const admins = await adminService.getAdmins();
        const pendingRequests = await adminService.getPendingRequests();

        for (const admin of admins) {
          try {
            // Send to each admin
            const adminJid = admin.includes("lid_")
              ? admin.replace("lid_", "") + "@lid"
              : admin + "@s.whatsapp.net";

            await sock.sendMessage(adminJid, {
              text: `🔔 *NOTIFIKASI ADMIN*\n\nAda permintaan admin baru!\n\n📱 Nomor: ${sender}\n📝 Total pending: ${pendingRequests.length}\n\nGunakan /listRequests untuk melihat semua permintaan.`,
            });
          } catch (e) {
            console.log(`Failed to notify admin ${admin}:`, e.message);
          }
        }
      }
    } catch (error) {
      console.error("Error in handleSelfAdmin:", error);
      await sock.sendMessage(sender, {
        text: `❌ Error: ${error.message}`,
      });
    }
  }

  async handleListRequests(sock, sender, isAdmin) {
    try {
      if (!isAdmin) {
        await sock.sendMessage(sender, {
          text: "❌ Akses ditolak! Hanya admin yang bisa melihat permintaan.",
        });
        return;
      }

      const requests = await adminService.getPendingRequests();

      if (requests.length === 0) {
        await sock.sendMessage(sender, {
          text: "📭 Tidak ada permintaan admin yang pending.",
        });
        return;
      }

      let message = "📋 **DAFTAR PERMINTAAN ADMIN**\n\n";
      requests.forEach((req, index) => {
        const time = new Date(req.requested_at).toLocaleString("id-ID");
        message += `${index + 1}. 📱 Nomor: ${req.number}\n`;
        message += `   🕐 Waktu: ${time}\n`;
        if (req.lid) {
          message += `   🔑 LID: ${req.lid}\n`;
        }
        message += `   📝 ID: ${req.id}\n\n`;
      });
      message += `Total: ${requests.length} permintaan\n\n`;
      message += `Gunakan:\n/acceptAdmin [ID] - Untuk menyetujui\n/rejectAdmin [ID] - Untuk menolak`;

      await sock.sendMessage(sender, { text: message });
    } catch (error) {
      console.error("Error in handleListRequests:", error);
      await sock.sendMessage(sender, {
        text: `❌ Error: ${error.message}`,
      });
    }
  }

  async handleAcceptAdmin(sock, sender, messageText, isAdmin) {
    try {
      if (!isAdmin) {
        await sock.sendMessage(sender, {
          text: "❌ Akses ditolak! Hanya admin yang bisa menyetujui permintaan.",
        });
        return;
      }

      const requestId = messageText.substring(13).trim();
      if (!requestId) {
        await sock.sendMessage(sender, {
          text: "❌ Masukkan ID permintaan!\n\nContoh: /acceptAdmin 1",
        });
        return;
      }

      const result = await adminService.acceptAdminRequest(
        parseInt(requestId),
        sender,
      );

      await sock.sendMessage(sender, {
        text: result.message,
      });

      // Notify the new admin
      if (result.success && result.data) {
        try {
          // Try to send to phone number
          const newAdminJid = result.data.number + "@s.whatsapp.net";
          await sock.sendMessage(newAdminJid, {
            text: `🎉 *SELAMAT!*\n\nPermintaan admin Anda telah DISETUJUI!\n\nAnda sekarang adalah admin bot.\nKetik /help untuk melihat semua perintah admin.`,
          });
        } catch (e) {
          console.log("Failed to notify new admin:", e.message);
          // Try sending via LID if available
          if (result.data.lid) {
            try {
              await sock.sendMessage(result.data.lid + "@lid", {
                text: `🎉 *SELAMAT!*\n\nPermintaan admin Anda telah DISETUJUI!\n\nAnda sekarang adalah admin bot.\nKetik /help untuk melihat semua perintah admin.`,
              });
            } catch (e2) {
              console.log("Failed to notify new admin via LID:", e2.message);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error in handleAcceptAdmin:", error);
      await sock.sendMessage(sender, {
        text: `❌ Error: ${error.message}`,
      });
    }
  }

  async handleRejectAdmin(sock, sender, messageText, isAdmin) {
    try {
      if (!isAdmin) {
        await sock.sendMessage(sender, {
          text: "❌ Akses ditolak! Hanya admin yang bisa menolak permintaan.",
        });
        return;
      }

      const requestId = messageText.substring(13).trim();
      if (!requestId) {
        await sock.sendMessage(sender, {
          text: "❌ Masukkan ID permintaan!\n\nContoh: /rejectAdmin 1",
        });
        return;
      }

      const result = await adminService.rejectAdminRequest(
        parseInt(requestId),
        sender,
      );

      await sock.sendMessage(sender, {
        text: result.message,
      });

      // Notify the rejected user
      if (result.success && result.data) {
        try {
          const rejectedJid = result.data.number + "@s.whatsapp.net";
          await sock.sendMessage(rejectedJid, {
            text: `❌ *MAAF*\n\nPermintaan admin Anda telah DITOLAK.\n\nSilakan hubungi admin untuk informasi lebih lanjut.`,
          });
        } catch (e) {
          console.log("Failed to notify rejected user:", e.message);
          if (result.data.lid) {
            try {
              await sock.sendMessage(result.data.lid + "@lid", {
                text: `❌ *MAAF*\n\nPermintaan admin Anda telah DITOLAK.\n\nSilakan hubungi admin untuk informasi lebih lanjut.`,
              });
            } catch (e2) {
              console.log(
                "Failed to notify rejected user via LID:",
                e2.message,
              );
            }
          }
        }
      }
    } catch (error) {
      console.error("Error in handleRejectAdmin:", error);
      await sock.sendMessage(sender, {
        text: `❌ Error: ${error.message}`,
      });
    }
  }

  async handleAddAdmin(sock, sender, number, isAdmin) {
    try {
      if (!isAdmin) {
        await sock.sendMessage(sender, {
          text: "❌ Akses ditolak! Hanya admin yang bisa menambah admin.",
        });
        return;
      }

      if (!number) {
        await sock.sendMessage(sender, {
          text: "❌ Masukkan nomor!\nContoh: /addAdmin 6281234567890",
        });
        return;
      }

      await adminService.addAdmin(number);
      await sock.sendMessage(sender, {
        text: `✅ Admin berhasil ditambahkan!\n📱 Nomor: ${number}`,
      });
    } catch (error) {
      console.error("Error in handleAddAdmin:", error);
      await sock.sendMessage(sender, {
        text: `❌ Gagal menambahkan admin: ${error.message}`,
      });
    }
  }

  async handleListAdmin(sock, sender, isAdmin) {
    try {
      if (!isAdmin) {
        await sock.sendMessage(sender, {
          text: "❌ Akses ditolak! Hanya admin yang bisa melihat daftar admin.",
        });
        return;
      }

      const admins = await adminService.getAdmins();
      const defaultAdmin = process.env.DEFAULT_ADMIN;

      let message = "🔐 **DAFTAR ADMIN**\n\n";
      admins.forEach((admin, index) => {
        const isDefault =
          admin === defaultAdmin || admin === `lid_${defaultAdmin}`;
        const isLID = admin.startsWith("lid_");
        message += `${index + 1}. ${admin}${isDefault ? " (DEFAULT)" : ""}${isLID ? " 🔑LID" : ""}\n`;
      });
      message += `\n📁 Total: ${admins.length} admin`;

      await sock.sendMessage(sender, { text: message });
    } catch (error) {
      console.error("Error in handleListAdmin:", error);
      await sock.sendMessage(sender, {
        text: `❌ Error: ${error.message}`,
      });
    }
  }

  async handleRemoveAdmin(sock, sender, number, isAdmin) {
    try {
      if (!isAdmin) {
        await sock.sendMessage(sender, {
          text: "❌ Akses ditolak! Hanya admin yang bisa menghapus admin.",
        });
        return;
      }

      if (!number) {
        await sock.sendMessage(sender, {
          text: "❌ Masukkan nomor!\nContoh: /removeAdmin 6281234567890",
        });
        return;
      }

      await adminService.removeAdmin(number);
      await sock.sendMessage(sender, {
        text: `✅ Admin berhasil dihapus!\n📱 Nomor: ${number}`,
      });
    } catch (error) {
      console.error("Error in handleRemoveAdmin:", error);
      await sock.sendMessage(sender, {
        text: `❌ Gagal menghapus admin: ${error.message}`,
      });
    }
  }

  async handleStatus(sock, sender, isAdmin) {
    try {
      const birthStats = await birthdateService.getStats();
      const employeeStats = await employeeService.getStats();
      const admins = await adminService.getAdmins();
      const pendingRequests = await adminService.getPendingRequests();

      const uptime = process.uptime();
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);

      let message = "📊 **STATUS BOT**\n\n";
      message += `✅ Status: Online\n`;
      message += `⏱️ Uptime: ${hours}j ${minutes}m\n`;
      message += `📁 Data Birthdate: ${birthStats.total}\n`;
      message += `👥 Data Karyawan: ${employeeStats.total || 0}\n`;
      message += `🔐 Total Admin: ${admins.length}\n`;
      message += `📝 Pending Requests: ${pendingRequests.length}\n`;
      message += `🔑 Admin: ${isAdmin ? "✅ Ya" : "❌ Bukan"}\n\n`;
      message += `📋 Ketik /help untuk semua perintah`;

      await sock.sendMessage(sender, { text: message });
    } catch (error) {
      console.error("Error in handleStatus:", error);
      await sock.sendMessage(sender, {
        text: `❌ Error: ${error.message}`,
      });
    }
  }

  async handleHelp(sock, sender, isAdmin) {
    try {
      // Double check admin status for display
      const senderNumber = sender.split("@")[0].replace(/\D/g, "");
      const actualAdminStatus = await adminService.isAdmin(senderNumber);

      let helpText =
        `🤖 *DAFTAR PERINTAH*\n\n` +
        `📝 *Birthdate:*\n` +
        `/setBirth Nama | YYYY-MM-DD\n` +
        `   ➜ Tambah data birthdate\n` +
        `/searchBirth Nama\n` +
        `   ➜ Cari data berdasarkan nama\n` +
        `/listBirth\n` +
        `   ➜ Lihat semua data\n` +
        `/birthToday\n` +
        `   ➜ Cek ulang tahun hari ini\n` +
        `/birthMonth\n` +
        `   ➜ Cek ulang tahun bulan ini\n` +
        `/upcomingBirth\n` +
        `   ➜ 10 ulang tahun terdekat\n` +
        `/countBirth\n` +
        `   ➜ Statistik data\n\n` +
        `👥 *Employee (HR):*\n` +
        `/addEmployee Nama | Posisi | Dept | YYYY-MM-DD\n` +
        `/listEmployee\n` +
        `/employeeStats\n` +
        `/workAnniversary\n` +
        `/searchEmployee Dept\n\n` +
        `🔑 **Admin Request:**\n` +
        `/selfAdmin\n` +
        `   ➜ Minta menjadi admin\n`;

      if (actualAdminStatus) {
        helpText +=
          `\n🔐 *Admin (✅ Aktif):*\n` +
          `/listRequests\n` +
          `   ➜ Lihat permintaan admin\n` +
          `/acceptAdmin [ID]\n` +
          `   ➜ Setujui permintaan admin\n` +
          `/rejectAdmin [ID]\n` +
          `   ➜ Tolak permintaan admin\n` +
          `/editBirth Nama | YYYY-MM-DD\n` +
          `   ➜ Edit data birthdate\n` +
          `/deleteBirth Nama\n` +
          `   ➜ Hapus data birthdate\n` +
          `/addAdmin 628XXXXXXXXXX\n` +
          `   ➜ Tambah admin baru\n` +
          `/listAdmin\n` +
          `   ➜ Lihat daftar admin\n` +
          `/removeAdmin 628XXXXXXXXXX\n` +
          `   ➜ Hapus admin\n`;
      } else {
        helpText +=
          `\n🔐 *Admin (❌ Tidak Aktif):*\n` +
          `   Kirim /selfAdmin untuk request\n`;
      }

      helpText +=
        `\nℹ️ *Informasi:*\n` +
        `/status - Status bot\n` +
        `/help - Bantuan ini\n\n` +
        `🔑 Status: ${actualAdminStatus ? "✅ Admin" : "❌ User"}`;

      await sock.sendMessage(sender, { text: helpText });
    } catch (error) {
      console.error("Error in handleHelp:", error);
      await sock.sendMessage(sender, {
        text: `❌ Error: ${error.message}`,
      });
    }
  }
}

module.exports = new AdminCommand();
