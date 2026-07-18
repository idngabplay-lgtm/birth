const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const QRCode = require("qrcode-terminal");
require("dotenv").config();

// Import services
const adminService = require("./services/adminService");
const birthdateService = require("./services/birthdateService");

// Import commands
const birthdateCommand = require("./commands/birthdate");
const employeeCommand = require("./commands/employee");
const adminCommand = require("./commands/admin");

// Global error handler untuk unhandled rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise);
  console.error("📝 Reason:", reason);
  // Don't crash the bot
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  // Don't crash the bot
});

async function startSock() {
  try {
    const { state, saveCreds } =
      await useMultiFileAuthState("auth_info_baileys");

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: ["WhatsApp Bot", "Chrome", "120.0.0.0"],
      // Add more options for stability
      syncFullHistory: false,
      markOnlineOnConnect: true,
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      try {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          console.log("Scan QR Code dengan WhatsApp mu:");
          QRCode.generate(qr, { small: true });
        }

        if (connection === "close") {
          const shouldReconnect =
            (lastDisconnect?.error instanceof Boom)?.output?.statusCode !==
            DisconnectReason.loggedOut;
          console.log(
            "Connection closed due to ",
            lastDisconnect?.error,
            ", reconnecting ",
            shouldReconnect,
          );
          if (shouldReconnect) {
            setTimeout(startSock, 5000);
          } else {
            console.log(
              "Logged out, please delete auth_info_baileys folder and run again",
            );
          }
        } else if (connection === "open") {
          console.log("✅ Connected to WhatsApp!");
          console.log("📱 Bot siap menerima perintah!");
          console.log("💡 Ketik /help untuk melihat daftar perintah");

          // Cek ulang tahun hari ini
          try {
            const todayBirthdays = await birthdateService.getToday();
            if (todayBirthdays.length > 0) {
              console.log(
                `🎂 Hari ini ${todayBirthdays.length} orang berulang tahun!`,
              );
            }
          } catch (error) {
            console.error("Error checking birthdays:", error.message);
          }
        }
      } catch (error) {
        console.error("Error in connection.update handler:", error);
      }
    });

    // ========== HANDLE INCOMING MESSAGES ==========
    // ========== HANDLE INCOMING MESSAGES ==========
    sock.ev.on("messages.upsert", async (m) => {
      try {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const messageText =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          msg.message.imageMessage?.caption ||
          "";

        // Skip empty messages
        if (!messageText) return;

        console.log(
          `📩 Message from ${sender}: ${messageText.substring(0, 50)}...`,
        );

        // ===== IMPORTANT: Clean sender number =====
        // Extract just the number without @s.whatsapp.net or @g.us
        let senderNumber = sender;
        if (sender.includes("@")) {
          senderNumber = sender.split("@")[0];
        }
        // Remove any non-digit characters
        senderNumber = senderNumber.replace(/\D/g, "");

        console.log(`🧹 Clean sender: ${senderNumber}`);

        // Check if admin with cleaned number
        let isAdmin = false;
        try {
          isAdmin = await adminService.isAdmin(senderNumber);
          console.log(`🔑 Admin status for ${senderNumber}: ${isAdmin}`);
        } catch (error) {
          console.error("Error checking admin status:", error.message);
          isAdmin = false;
        }

        // ===== SELF ADMIN COMMANDS =====
        if (messageText.toLowerCase() === "/selfadmin") {
          await adminCommand.handleSelfAdmin(sock, sender, isAdmin);
          return;
        }

        if (messageText.toLowerCase() === "/listrequests") {
          await adminCommand.handleListRequests(sock, sender, isAdmin);
          return;
        }

        if (messageText.startsWith("/acceptAdmin")) {
          await adminCommand.handleAcceptAdmin(
            sock,
            sender,
            messageText,
            isAdmin,
          );
          return;
        }

        if (messageText.startsWith("/rejectAdmin")) {
          await adminCommand.handleRejectAdmin(
            sock,
            sender,
            messageText,
            isAdmin,
          );
          return;
        }

        // ===== BIRTHDATE COMMANDS =====
        if (messageText.startsWith("/setBirth")) {
          await birthdateCommand.handleSetBirth(sock, sender, messageText);
          return;
        }

        if (messageText.toLowerCase() === "/listbirth") {
          await birthdateCommand.handleListBirth(sock, sender);
          return;
        }

        if (messageText.startsWith("/searchBirth")) {
          const keyword = messageText.substring(13).trim();
          await birthdateCommand.handleSearchBirth(sock, sender, keyword);
          return;
        }

        if (messageText.toLowerCase() === "/birthtoday") {
          await birthdateCommand.handleBirthToday(sock, sender);
          return;
        }

        if (messageText.toLowerCase() === "/birthmonth") {
          await birthdateCommand.handleBirthMonth(sock, sender);
          return;
        }

        if (messageText.toLowerCase() === "/upcomingbirth") {
          await birthdateCommand.handleUpcomingBirth(sock, sender);
          return;
        }

        if (messageText.toLowerCase() === "/countbirth") {
          await birthdateCommand.handleCountBirth(sock, sender);
          return;
        }

        if (messageText.startsWith("/editBirth")) {
          await birthdateCommand.handleEditBirth(
            sock,
            sender,
            messageText,
            isAdmin,
          );
          return;
        }

        if (messageText.startsWith("/deleteBirth")) {
          const name = messageText.substring(13).trim();
          await birthdateCommand.handleDeleteBirth(sock, sender, name, isAdmin);
          return;
        }

        // ===== EMPLOYEE COMMANDS =====
        if (messageText.startsWith("/addEmployee")) {
          await employeeCommand.handleAddEmployee(
            sock,
            sender,
            messageText,
            isAdmin,
          );
          return;
        }

        if (messageText.toLowerCase() === "/listemployee") {
          await employeeCommand.handleListEmployees(sock, sender);
          return;
        }

        if (messageText.toLowerCase() === "/employeestats") {
          await employeeCommand.handleEmployeeStats(sock, sender);
          return;
        }

        if (messageText.toLowerCase() === "/workanniversary") {
          await employeeCommand.handleWorkAnniversary(sock, sender);
          return;
        }

        if (messageText.startsWith("/searchEmployee")) {
          const keyword = messageText.substring(16).trim();
          await employeeCommand.handleSearchEmployee(sock, sender, keyword);
          return;
        }

        // ===== ADMIN COMMANDS =====
        if (messageText.startsWith("/addAdmin")) {
          const number = messageText.substring(10).trim();
          await adminCommand.handleAddAdmin(sock, sender, number, isAdmin);
          return;
        }

        if (messageText.toLowerCase() === "/listadmin") {
          await adminCommand.handleListAdmin(sock, sender, isAdmin);
          return;
        }

        if (messageText.startsWith("/removeAdmin")) {
          const number = messageText.substring(13).trim();
          await adminCommand.handleRemoveAdmin(sock, sender, number, isAdmin);
          return;
        }

        // ===== GENERAL COMMANDS =====
        if (messageText.toLowerCase() === "/status") {
          await adminCommand.handleStatus(sock, sender, isAdmin);
          return;
        }

        if (messageText.toLowerCase() === "/help") {
          await adminCommand.handleHelp(sock, sender, isAdmin);
          return;
        }

        // Optional: Reply to unknown commands
        if (messageText.startsWith("/")) {
          await sock.sendMessage(sender, {
            text: "❓ Perintah tidak dikenal. Ketik /help untuk melihat daftar perintah.",
          });
        }
      } catch (error) {
        console.error("❌ Error processing message:", error);
        // Try to send error message to user
        try {
          const sender = m.messages[0]?.key?.remoteJid;
          if (sender) {
            await sock.sendMessage(sender, {
              text: "❌ Terjadi error saat memproses pesan. Silakan coba lagi.",
            });
          }
        } catch (sendError) {
          console.error("Error sending error message:", sendError);
        }
      }
    });
  } catch (error) {
    console.error("❌ Fatal error in startSock:", error);
    // Restart after 5 seconds
    setTimeout(startSock, 5000);
  }
}

// Start the bot
startSock().catch((err) => {
  console.error("❌ Bot crashed:", err);
  setTimeout(startSock, 5000);
});
