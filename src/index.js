const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const QRCode = require("qrcode-terminal");
require("dotenv").config();

// Import services
const adminService = require("./services/adminService");
const birthdateService = require("./services/birthdateService");
const employeeService = require("./services/employeeService");

// Import commands
const birthdateCommand = require("./commands/birthdate");
const employeeCommand = require("./commands/employee");
const adminCommand = require("./commands/admin");

// Import resource command (dengan fallback)
let resourceCommand;
try {
  resourceCommand = require("./commands/resourceCommand");
} catch (error) {
  console.log("⚠️ resourceCommand not found, creating dummy...");
  resourceCommand = {
    handleShowCategories: async (sock, sender) => {
      await sock.sendMessage(sender, {
        text: "❌ Resource Center belum di-setup. Jalankan SQL di Supabase terlebih dahulu.",
      });
    },
    handleAssignPIC: async (sock, sender, messageText, isAdmin) => {
      await sock.sendMessage(sender, {
        text: "❌ Fitur assignPIC belum di-setup.",
      });
    },
    handleFolderDetail: async (sock, sender, folderId) => {
      await sock.sendMessage(sender, {
        text: "❌ Fitur folderDetail belum di-setup.",
      });
    },
    handleAddTask: async (sock, sender, messageText, isAdmin) => {
      await sock.sendMessage(sender, {
        text: "❌ Fitur addTask belum di-setup.",
      });
    },
    handleUpdateTask: async (sock, sender, messageText, isAdmin) => {
      await sock.sendMessage(sender, {
        text: "❌ Fitur updateTask belum di-setup.",
      });
    },
    handleReport: async (sock, sender, isAdmin) => {
      await sock.sendMessage(sender, {
        text: "❌ Fitur report belum di-setup.",
      });
    },
  };
}

// Import birthday wisher
const birthdayWisher = require("./services/birthdayWisher");

// Global error handler
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise);
  console.error("📝 Reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
});

// ===== VARIABLES =====
let pairingCodeRequested = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

async function startSock() {
  try {
    console.log("🔄 Starting WhatsApp Bot...");

    const { state, saveCreds } =
      await useMultiFileAuthState("auth_info_baileys");

    const sock = makeWASocket({
      auth: state,
      browser: Browsers.macOS("Desktop"),
      syncFullHistory: false,
      markOnlineOnConnect: true,
      printQRInTerminal: false,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      getMessage: async () => {
        return undefined;
      },
    });
    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      try {
        const { connection, lastDisconnect, qr, pairingCode } = update;

        // ===== PAIRING CODE =====
        if (pairingCode && !pairingCodeRequested) {
          pairingCodeRequested = true;
          console.log("\n🎯 =========================================");
          console.log(`📱 PAIRING CODE: ${pairingCode}`);
          console.log("===========================================");
          console.log("\n📝 CARA:");
          console.log("1. Buka WhatsApp di HP");
          console.log("2. Tap ⋮ (3 dots) → Perangkat Tertaut");
          console.log("3. Tap 'Tautkan Perangkat'");
          console.log("4. Tap 'Tautkan dengan Nomor Telepon'");
          console.log(`5. Masukkan kode: ${pairingCode}`);
          console.log("6. Tunggu koneksi...\n");
        }

        // ===== QR CODE (Backup) =====
        if (qr) {
          console.log("\n📱 ATAU SCAN QR CODE:");
          QRCode.generate(qr, { small: true });
          console.log("");
        }

        // ===== CONNECTION CLOSE =====
        if (connection === "close") {
          const shouldReconnect =
            (lastDisconnect?.error instanceof Boom)?.output?.statusCode !==
            DisconnectReason.loggedOut;

          // Reset pairing code flag
          pairingCodeRequested = false;

          // Check if it's a 405 error (IP/Device blocked)
          const is405Error = lastDisconnect?.error?.data?.reason === "405";

          if (is405Error) {
            reconnectAttempts++;
            console.log(
              `\n🚫 ERROR 405: IP/Device terblokir sementara (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`,
            );
            console.log("💡 SOLUSI:");
            console.log("1. TUNGGU 15-30 MENIT");
            console.log("2. Pakai VPN atau hotspot HP");
            console.log("3. Logout dari WhatsApp Web di HP");
            console.log("4. Hapus folder auth_info_baileys");
            console.log("5. Jalankan ulang\n");

            if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
              console.log(
                "❌ Terlalu banyak percobaan. Silakan tunggu 30 menit dan coba lagi.",
              );
              return;
            }

            // Wait longer for 405 errors (30 seconds)
            setTimeout(startSock, 30000);
          } else {
            console.log(
              "Connection closed due to ",
              lastDisconnect?.error,
              ", reconnecting ",
              shouldReconnect,
            );

            if (shouldReconnect) {
              reconnectAttempts = 0;
              setTimeout(startSock, 5000);
            } else {
              console.log(
                "Logged out, please delete auth_info_baileys folder and run again",
              );
            }
          }
        }
        // ===== CONNECTION OPEN =====
        else if (connection === "open") {
          reconnectAttempts = 0;
          pairingCodeRequested = false;

          console.log("\n✅ Connected to WhatsApp!");
          console.log("📱 Bot siap menerima perintah!");
          console.log("💡 Ketik /help untuk melihat daftar perintah");
          console.log("🎂 Birthday Wisher is active!\n");

          // Start birthday wisher
          try {
            await birthdayWisher.scheduleBirthdayWishes(sock);
          } catch (error) {
            console.error("Error starting birthday wisher:", error.message);
          }

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

        if (!messageText) return;

        console.log(
          `📩 Message from ${sender}: ${messageText.substring(0, 50)}...`,
        );

        // Clean sender number
        let senderNumber = sender;
        if (sender.includes("@")) {
          senderNumber = sender.split("@")[0];
        }
        senderNumber = senderNumber.replace(/\D/g, "");

        console.log(`🧹 Clean sender: ${senderNumber}`);

        // Check if admin
        let isAdmin = false;
        try {
          isAdmin = await adminService.isAdmin(senderNumber);
          console.log(`🔑 Admin status for ${senderNumber}: ${isAdmin}`);
        } catch (error) {
          console.error("Error checking admin status:", error.message);
          isAdmin = false;
        }

        // ===== COMMANDS =====
        const msgLower = messageText.toLowerCase();

        // Self Admin
        if (msgLower === "/selfadmin") {
          await adminCommand.handleSelfAdmin(sock, sender, isAdmin);
          return;
        }

        if (msgLower === "/listrequests") {
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

        // Resource Center
        if (msgLower === "/resource") {
          await resourceCommand.handleShowCategories(sock, sender);
          return;
        }

        if (messageText.startsWith("/assignPIC")) {
          await resourceCommand.handleAssignPIC(
            sock,
            sender,
            messageText,
            isAdmin,
          );
          return;
        }

        if (messageText.startsWith("/folderDetail")) {
          const folderId = messageText.substring(13).trim();
          await resourceCommand.handleFolderDetail(sock, sender, folderId);
          return;
        }

        if (messageText.startsWith("/addTask")) {
          await resourceCommand.handleAddTask(
            sock,
            sender,
            messageText,
            isAdmin,
          );
          return;
        }

        if (messageText.startsWith("/updateTask")) {
          await resourceCommand.handleUpdateTask(
            sock,
            sender,
            messageText,
            isAdmin,
          );
          return;
        }

        if (msgLower === "/report") {
          await resourceCommand.handleReport(sock, sender, isAdmin);
          return;
        }

        // Birthdate
        if (messageText.startsWith("/setBirth")) {
          await birthdateCommand.handleSetBirth(sock, sender, messageText);
          return;
        }

        if (msgLower === "/listbirth") {
          await birthdateCommand.handleListBirth(sock, sender);
          return;
        }

        if (messageText.startsWith("/searchBirth")) {
          const keyword = messageText.substring(13).trim();
          await birthdateCommand.handleSearchBirth(sock, sender, keyword);
          return;
        }

        if (msgLower === "/birthtoday") {
          await birthdateCommand.handleBirthToday(sock, sender);
          return;
        }

        if (msgLower === "/birthmonth") {
          await birthdateCommand.handleBirthMonth(sock, sender);
          return;
        }

        if (msgLower === "/upcomingbirth") {
          await birthdateCommand.handleUpcomingBirth(sock, sender);
          return;
        }

        if (msgLower === "/countbirth") {
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

        // Employee
        if (messageText.startsWith("/addEmployee")) {
          await employeeCommand.handleAddEmployee(
            sock,
            sender,
            messageText,
            isAdmin,
          );
          return;
        }

        if (msgLower === "/listemployee") {
          await employeeCommand.handleListEmployees(sock, sender);
          return;
        }

        if (msgLower === "/employeestats") {
          await employeeCommand.handleEmployeeStats(sock, sender);
          return;
        }

        if (msgLower === "/workanniversary") {
          await employeeCommand.handleWorkAnniversary(sock, sender);
          return;
        }

        if (messageText.startsWith("/searchEmployee")) {
          const keyword = messageText.substring(16).trim();
          await employeeCommand.handleSearchEmployee(sock, sender, keyword);
          return;
        }

        // Admin
        if (messageText.startsWith("/addAdmin")) {
          const number = messageText.substring(10).trim();
          await adminCommand.handleAddAdmin(sock, sender, number, isAdmin);
          return;
        }

        if (msgLower === "/listadmin") {
          await adminCommand.handleListAdmin(sock, sender, isAdmin);
          return;
        }

        if (messageText.startsWith("/removeAdmin")) {
          const number = messageText.substring(13).trim();
          await adminCommand.handleRemoveAdmin(sock, sender, number, isAdmin);
          return;
        }

        // General
        if (msgLower === "/status") {
          await adminCommand.handleStatus(sock, sender, isAdmin);
          return;
        }

        if (msgLower === "/help") {
          await adminCommand.handleHelp(sock, sender, isAdmin);
          return;
        }

        // Unknown command
        if (messageText.startsWith("/")) {
          await sock.sendMessage(sender, {
            text: "❓ Perintah tidak dikenal. Ketik /help untuk melihat daftar perintah.",
          });
        }
      } catch (error) {
        console.error("❌ Error processing message:", error);
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
    setTimeout(startSock, 5000);
  }
}

// Start the bot
console.log("🚀 Starting WhatsApp Bot...");
console.log("📱 Bot akan menampilkan Pairing Code untuk login\n");
startSock().catch((err) => {
  console.error("❌ Bot crashed:", err);
  setTimeout(startSock, 5000);
});
