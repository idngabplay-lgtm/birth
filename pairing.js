// pairing.js
const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason } = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const QRCode = require("qrcode-terminal");
require('dotenv').config();

async function startPairing() {
    console.log("🔑 Mencoba Pairing Code...\n");
    
    const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
    
    const sock = makeWASocket({
        auth: state,
        browser: Browsers.macOS("Desktop"), // Pake macOS biar beda
        syncFullHistory: false,
        markOnlineOnConnect: true,
        printQRInTerminal: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr, pairingCode } = update;

        // PAIRING CODE (ini yang kita mau!)
        if (pairingCode) {
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

        // QR Code (backup)
        if (qr) {
            console.log("\n📱 ATAU SCAN QR CODE:");
            QRCode.generate(qr, { small: true });
        }

        if (connection === "close") {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log("Connection closed, reconnecting:", shouldReconnect);
            if (shouldReconnect) {
                setTimeout(startPairing, 5000);
            } else {
                console.log("Logged out, delete auth_info_baileys and try again");
            }
        } else if (connection === "open") {
            console.log("\n✅ BERHASIL! WhatsApp Connected!");
            console.log("📱 Bot siap digunakan!\n");
            process.exit(0);
        }
    });
}

startPairing().catch(console.error);