// src/services/birthdayWisher.js
const { supabase } = require("../config/database");
const birthdateService = require("./birthdateService");
const employeeService = require("./employeeService");
const adminService = require("./adminService");

class BirthdayWisher {
  constructor() {
    this.isRunning = false;
    this.lastRunDate = null;
  }

  async getTodayBirthdaysWithDetails() {
    try {
      const todayBirthdays = await birthdateService.getToday();
      const employees = await employeeService.getAll();
      
      const results = [];
      for (const birthday of todayBirthdays) {
        const employee = employees.find(e => e.name === birthday.name);
        results.push({
          name: birthday.name,
          birthdate: birthday.birthdate,
          phone: employee?.phone || null,
          whatsapp_id: employee?.whatsapp_id || null,
          position: employee?.position || 'Unknown',
          department: employee?.department || 'Unknown',
          age: birthdateService.calculateAge(birthday.birthdate)
        });
      }
      return results;
    } catch (error) {
      console.error('Error in getTodayBirthdaysWithDetails:', error);
      return [];
    }
  }

  generateBirthdayMessage(person) {
    const messages = [
      `🎉 *HAPPY BIRTHDAY!* 🎉\n\nSelamat ulang tahun yang ke-${person.age}, *${person.name}*! 🥳\n\nSemoga di usia yang baru ini, karir dan kebahagiaan selalu menyertaimu. Terima kasih atas dedikasi dan kerja kerasmu selama ini di tim *${person.department}*.\n\n~ *Tim HR & Management* 💝`,
      
      `🎂 *SELAMAT ULANG TAHUN!* 🎂\n\n*${person.name}* dari departemen *${person.department}* hari ini berulang tahun yang ke-${person.age}! 🎊\n\nTerima kasih atas kontribusi luar biasa yang telah diberikan. Semoga sukses selalu! ✨\n\n~ *People Team*`,
      
      `🌟 *HAPPY BIRTHDAY!* 🌟\n\nMerayakan hari spesial *${person.name}* yang ke-${person.age} tahun! 🎉\n\nKami sangat menghargai semua yang telah Anda berikan untuk tim *${person.department}*. Semoga hari ini penuh dengan kebahagiaan! 🎈\n\n~ *HR Department*`
    ];

    return messages[Math.floor(Math.random() * messages.length)];
  }

  async sendBirthdayWish(sock, person) {
    try {
      const message = this.generateBirthdayMessage(person);
      
      let targetJid = null;
      
      if (person.whatsapp_id) {
        targetJid = person.whatsapp_id + '@lid';
      } else if (person.phone) {
        const cleanPhone = person.phone.replace(/\D/g, '');
        if (cleanPhone.startsWith('0')) {
          targetJid = '62' + cleanPhone.substring(1) + '@s.whatsapp.net';
        } else if (cleanPhone.startsWith('62')) {
          targetJid = cleanPhone + '@s.whatsapp.net';
        } else {
          targetJid = cleanPhone + '@s.whatsapp.net';
        }
      }
      
      if (!targetJid) {
        console.log(`⚠️ No contact info for ${person.name}`);
        return { success: false, error: 'No contact info' };
      }

      console.log(`📤 Sending birthday wish to ${person.name} (${targetJid})...`);
      
      await sock.sendMessage(targetJid, {
        text: message,
        contextInfo: {
          mentionedJid: [targetJid]
        }
      });

      console.log(`✅ Birthday wish sent to ${person.name}`);
      return { success: true };
      
    } catch (error) {
      console.error(`❌ Error sending birthday wish to ${person.name}:`, error);
      return { success: false, error: error.message };
    }
  }

  async notifyAdmins(sock, birthdayPeople) {
    try {
      const admins = await adminService.getAdmins();
      
      if (admins.length === 0 || birthdayPeople.length === 0) return;

      const message = `🎂 *BIRTHDAY UPDATE* 🎂\n\nHari ini ada ${birthdayPeople.length} orang berulang tahun:\n\n` +
        birthdayPeople.map((p, i) => 
          `${i + 1}. *${p.name}* (${p.age} tahun) - ${p.department}`
        ).join('\n') +
        `\n\n🎉 Jangan lupa ucapkan selamat! 🎉`;

      for (const admin of admins) {
        try {
          const adminJid = admin.includes('lid_') 
            ? admin.replace('lid_', '') + '@lid'
            : admin + '@s.whatsapp.net';
          
          await sock.sendMessage(adminJid, { text: message });
        } catch (error) {
          console.log(`Failed to notify admin ${admin}:`, error.message);
        }
      }
    } catch (error) {
      console.error('Error notifying admins:', error);
    }
  }

  async checkAndSendBirthdayWishes(sock) {
    try {
      if (this.isRunning) {
        console.log('⏳ Birthday Wisher is already running');
        return;
      }

      this.isRunning = true;
      console.log('🎂 Running Birthday Wisher...');

      const birthdayPeople = await this.getTodayBirthdaysWithDetails();
      
      if (birthdayPeople.length === 0) {
        console.log('🎂 No birthdays today');
        this.isRunning = false;
        return;
      }

      console.log(`🎂 Found ${birthdayPeople.length} birthday(s) today`);
      
      let successCount = 0;

      for (const person of birthdayPeople) {
        const result = await this.sendBirthdayWish(sock, person);
        if (result.success) {
          successCount++;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      await this.notifyAdmins(sock, birthdayPeople);

      console.log(`🎂 Birthday Wisher completed: ${successCount} sent`);
      this.lastRunDate = new Date();
      
    } catch (error) {
      console.error('❌ Error in Birthday Wisher:', error);
    } finally {
      this.isRunning = false;
    }
  }

  async scheduleBirthdayWishes(sock) {
    console.log('🎂 Birthday Wisher scheduled!');
    
    setTimeout(async () => {
      await this.checkAndSendBirthdayWishes(sock);
    }, 5000);

    setInterval(async () => {
      const now = new Date();
      const hour = now.getHours();
      
      if (hour >= 7 && hour <= 10) {
        if (this.lastRunDate) {
          const lastRun = new Date(this.lastRunDate);
          if (lastRun.getDate() === now.getDate() && 
              lastRun.getMonth() === now.getMonth() && 
              lastRun.getFullYear() === now.getFullYear()) {
            console.log('⏭️ Birthday Wisher already ran today');
            return;
          }
        }
        await this.checkAndSendBirthdayWishes(sock);
      }
    }, 3600000);
  }
}

module.exports = new BirthdayWisher();