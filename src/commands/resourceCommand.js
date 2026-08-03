const resourceService = require("../services/resourceService");

class ResourceCommand {
  // Show all categories
  async handleShowCategories(sock, sender) {
    try {
      const categories = await resourceService.getAllCategories();
      
      let message = "📁 **BRAIN RESOURCE CENTER**\n\n";
      
      const typeMap = {
        'internal': '📂 INTERNAL',
        'external': '🌐 EXTERNAL',
        'sponsorship': '🤝 SPONSORSHIP',
        'business_capital': '💰 BUSINESS CAPITAL'
      };

      for (const cat of categories) {
        const folders = await resourceService.getFoldersByCategory(cat.id);
        message += `*${typeMap[cat.type] || cat.name}*\n`;
        for (const folder of folders) {
          const pic = await resourceService.getFolderWithPIC(folder.id);
          const picName = pic.resource_pics?.[0]?.pic_name || 'Belum diassign';
          message += `   📁 ${folder.name}\n`;
          message += `      👤 PIC: ${picName}\n`;
        }
        message += '\n';
      }

      message += `\n📝 *Cara Assign PIC:*\n`;
      message += `/assignPIC [Folder ID] | [Nama PIC] | [No WhatsApp]\n\n`;
      message += `📋 *Lihat Detail Folder:*\n`;
      message += `/folderDetail [Folder ID]`;

      await sock.sendMessage(sender, { text: message });
    } catch (error) {
      await sock.sendMessage(sender, {
        text: `❌ Error: ${error.message}`
      });
    }
  }

  // Assign PIC to a folder
  async handleAssignPIC(sock, sender, messageText, isAdmin) {
    if (!isAdmin) {
      await sock.sendMessage(sender, {
        text: "❌ Akses ditolak! Hanya admin yang bisa assign PIC."
      });
      return;
    }

    const parts = messageText.substring(11).trim().split('|').map(p => p.trim());
    
    if (parts.length < 2) {
      await sock.sendMessage(sender, {
        text: "❌ Format salah!\n\nGunakan:\n/assignPIC [Folder ID] | [Nama PIC] | [No WhatsApp]\n\nContoh:\n/assignPIC 1 | Reynaldo | 6281234567890\n\nUntuk melihat folder ID, gunakan /resource"
      });
      return;
    }

    const [folderId, picName, picWhatsapp] = parts;
    
    try {
      const result = await resourceService.assignPIC(
        parseInt(folderId),
        picName,
        picWhatsapp || null
      );
      
      // Get folder details
      const folder = await resourceService.getFolderWithPIC(parseInt(folderId));
      
      await sock.sendMessage(sender, {
        text: `✅ PIC berhasil diassign!\n\n📁 Folder: ${folder.name}\n👤 PIC: ${picName}\n📱 WhatsApp: ${picWhatsapp || '-'}\n\n📋 Jangan lupa untuk mengerjakan file sesuai folder yang menjadi tanggung jawab.`
      });
      
      // Notify the PIC if WhatsApp number provided
      if (picWhatsapp) {
        try {
          const cleanPhone = picWhatsapp.replace(/\D/g, '');
          const jid = cleanPhone.startsWith('0') 
            ? '62' + cleanPhone.substring(1) + '@s.whatsapp.net'
            : cleanPhone + '@s.whatsapp.net';
          
          await sock.sendMessage(jid, {
            text: `📢 *ASSIGNMENT NOTIFICATION*\n\nHalo *${picName}*! 👋\n\nAnda ditunjuk sebagai PIC untuk folder:\n\n📁 *${folder.name}*\n\nSilakan mulai mengerjakan dokumen sesuai dengan folder tersebut. Jika ada pertanyaan, bisa langsung hubungi admin.\n\nTerima kasih! 🧠`
          });
        } catch (e) {
          console.log('Failed to notify PIC:', e.message);
        }
      }
      
    } catch (error) {
      await sock.sendMessage(sender, {
        text: `❌ Gagal assign PIC: ${error.message}`
      });
    }
  }

  // Show folder details
  async handleFolderDetail(sock, sender, folderId) {
    try {
      if (!folderId) {
        await sock.sendMessage(sender, {
          text: "❌ Masukkan Folder ID!\n\nContoh: /folderDetail 1\n\nUntuk melihat semua folder, gunakan /resource"
        });
        return;
      }

      const folder = await resourceService.getFolderWithPIC(parseInt(folderId));
      
      if (!folder) {
        await sock.sendMessage(sender, {
          text: "❌ Folder tidak ditemukan!"
        });
        return;
      }

      const pic = folder.resource_pics?.[0];
      const tasks = await resourceService.getTasksByFolder(parseInt(folderId));

      let message = `📁 *FOLDER DETAIL*\n\n`;
      message += `📂 Nama: ${folder.name}\n`;
      message += `📝 Deskripsi: ${folder.description || '-'}\n`;
      message += `👤 PIC: ${pic?.pic_name || 'Belum diassign'}\n`;
      message += `📱 WhatsApp: ${pic?.pic_whatsapp || '-'}\n`;
      message += `🕐 Diassign: ${pic?.assigned_at ? new Date(pic.assigned_at).toLocaleString('id-ID') : '-'}\n\n`;

      if (tasks.length > 0) {
        message += `📋 *TASKS:*\n`;
        for (const task of tasks) {
          const statusEmoji = {
            'pending': '⏳',
            'in_progress': '🔄',
            'completed': '✅',
            'review': '📝'
          }[task.status] || '📌';
          
          const priorityEmoji = {
            'high': '🔴',
            'medium': '🟡',
            'low': '🟢'
          }[task.priority] || '⚪';
          
          message += `${statusEmoji} ${task.task_name}\n`;
          message += `   ${priorityEmoji} ${task.priority} | ${task.status}\n`;
          if (task.due_date) {
            message += `   📅 Due: ${new Date(task.due_date).toLocaleDateString('id-ID')}\n`;
          }
          message += '\n';
        }
      } else {
        message += `📭 Belum ada task untuk folder ini.\n\n`;
      }

      message += `🔧 *Actions:*\n`;
      message += `/addTask [Folder ID] | [Task Name] | [Priority] | [Due Date]\n`;
      message += `/updateTask [Task ID] | [Status]`;

      await sock.sendMessage(sender, { text: message });
    } catch (error) {
      await sock.sendMessage(sender, {
        text: `❌ Error: ${error.message}`
      });
    }
  }

  // Add task to folder
  async handleAddTask(sock, sender, messageText, isAdmin) {
    if (!isAdmin) {
      await sock.sendMessage(sender, {
        text: "❌ Akses ditolak! Hanya admin yang bisa menambah task."
      });
      return;
    }

    const parts = messageText.substring(9).trim().split('|').map(p => p.trim());
    
    if (parts.length < 2) {
      await sock.sendMessage(sender, {
        text: "❌ Format salah!\n\nGunakan:\n/addTask [Folder ID] | [Task Name] | [Priority] | [Due Date YYYY-MM-DD]\n\nContoh:\n/addTask 1 | Buat SOP Internal | high | 2024-12-31"
      });
      return;
    }

    const [folderId, taskName, priority = 'medium', dueDate] = parts;
    
    try {
      const result = await resourceService.createTask(
        parseInt(folderId),
        taskName,
        null,
        priority,
        null,
        dueDate || null
      );
      
      await sock.sendMessage(sender, {
        text: `✅ Task berhasil ditambahkan!\n\n📋 Task: ${taskName}\n📁 Folder ID: ${folderId}\n⚡ Priority: ${priority}\n📅 Due: ${dueDate || '-'}`
      });
    } catch (error) {
      await sock.sendMessage(sender, {
        text: `❌ Gagal menambah task: ${error.message}`
      });
    }
  }

  // Update task status
  async handleUpdateTask(sock, sender, messageText, isAdmin) {
    if (!isAdmin) {
      await sock.sendMessage(sender, {
        text: "❌ Akses ditolak! Hanya admin yang bisa update task."
      });
      return;
    }

    const parts = messageText.substring(12).trim().split('|').map(p => p.trim());
    
    if (parts.length < 2) {
      await sock.sendMessage(sender, {
        text: "❌ Format salah!\n\nGunakan:\n/updateTask [Task ID] | [Status]\n\nStatus: pending, in_progress, completed, review"
      });
      return;
    }

    const [taskId, status] = parts;
    
    try {
      const result = await resourceService.updateTaskStatus(parseInt(taskId), status);
      
      await sock.sendMessage(sender, {
        text: `✅ Task status berhasil diupdate!\n\n📋 Task ID: ${taskId}\n📊 Status: ${status}`
      });
    } catch (error) {
      await sock.sendMessage(sender, {
        text: `❌ Gagal update task: ${error.message}`
      });
    }
  }

  // Generate complete report
  async handleReport(sock, sender, isAdmin) {
    if (!isAdmin) {
      await sock.sendMessage(sender, {
        text: "❌ Akses ditolak! Hanya admin yang bisa melihat report."
      });
      return;
    }

    try {
      const assignments = await resourceService.getAllAssignments();
      
      let message = "📊 **BRAIN RESOURCE CENTER REPORT**\n\n";
      
      // Group by category
      const grouped = {};
      for (const assign of assignments) {
        const catType = assign.resource_folders.resource_categories.type;
        const catName = assign.resource_folders.resource_categories.name;
        if (!grouped[catType]) {
          grouped[catType] = { name: catName, folders: [] };
        }
        grouped[catType].folders.push({
          name: assign.resource_folders.name,
          pic: assign.pic_name,
          phone: assign.pic_whatsapp
        });
      }

      const typeLabels = {
        'internal': '📂 INTERNAL',
        'external': '🌐 EXTERNAL',
        'sponsorship': '🤝 SPONSORSHIP',
        'business_capital': '💰 BUSINESS CAPITAL'
      };

      for (const [type, data] of Object.entries(grouped)) {
        message += `*${typeLabels[type] || data.name}*\n`;
        for (const folder of data.folders) {
          message += `   📁 ${folder.name}\n`;
          message += `      👤 ${folder.pic}`;
          if (folder.phone) message += ` (${folder.phone})`;
          message += '\n';
        }
        message += '\n';
      }

      message += `📋 *Total Folders:* ${assignments.length}\n`;
      message += `📝 *Status:* Semua folder sudah memiliki PIC`;

      await sock.sendMessage(sender, { text: message });
    } catch (error) {
      await sock.sendMessage(sender, {
        text: `❌ Error: ${error.message}`
      });
    }
  }
}

module.exports = new ResourceCommand();