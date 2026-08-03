const resourceService = require("../services/resourceService");

const pendingAssignments = {};

class ResourceCommand {
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

      const people = await resourceService.getPeopleByRole();
      message += `\n👥 **DAFTAR PEOPLE BRAIN**\n`;
      message += `👑 HEAD: ${people.head.join(', ')}\n`;
      message += `📂 INTERNAL: ${people.internal.join(', ')}\n`;
      message += `🌐 EXTERNAL: ${people.external.join(', ')}\n`;
      message += `🤝 SPONSORSHIP: ${people.sponsorship.join(', ')}\n`;
      message += `💰 BUSINESS CAPITAL: ${people.business_capital.join(', ')}\n`;

      message += `\n📝 *Cara Assign PIC:*\n`;
      message += `/assignPIC [Folder ID] | [Nama PIC]\n\n`;
      message += `📋 *Lihat Detail Folder:*\n`;
      message += `/folderDetail [Folder ID]\n\n`;
      message += `🗑️ *Hapus Assign:*\n`;
      message += `/deleteAssign [Folder ID] | [Password]\n\n`;
      message += `🔑 *Ganti Password Delete:*\n`;
      message += `/changePassword [Lama] | [Baru]`;

      await sock.sendMessage(sender, { text: message });
    } catch (error) {
      await sock.sendMessage(sender, {
        text: `❌ Error: ${error.message}`
      });
    }
  }

  // ===== ASSIGN PIC (TANPA ADMIN CHECK) =====
  async handleAssignPIC(sock, sender, messageText) {
    const parts = messageText.substring(11).trim().split('|').map(p => p.trim());
    
    if (parts.length < 2) {
      await sock.sendMessage(sender, {
        text: "❌ Format salah!\n\nGunakan:\n/assignPIC [Folder ID] | [Nama PIC]\n\nContoh:\n/assignPIC 1 | Reynaldo Lamhot Silalahi\n\n📋 Untuk melihat daftar People, gunakan /resource"
      });
      return;
    }

    const [folderId, picName] = parts;
    
    try {
      const result = await resourceService.searchName(picName);
      
      if (!result.exact && result.matches.length === 0) {
        await sock.sendMessage(sender, {
          text: `❌ Nama "${picName}" tidak ditemukan di database People BRAIN.\n\n📋 Gunakan /resource untuk melihat daftar People yang tersedia.`
        });
        return;
      }
      
      if (result.matches.length > 1) {
        let message = `🔍 *Beberapa nama ditemukan:*\n\n`;
        result.matches.forEach((name, index) => {
          message += `${index + 1}. ${name}\n`;
        });
        message += `\n📝 *Ketik angka pilihan Anda:*\n`;
        message += `Contoh: /selectName [Folder ID] | [Angka]`;
        
        pendingAssignments[sender] = {
          folderId: parseInt(folderId),
          matches: result.matches,
          step: 'select_name'
        };
        
        await sock.sendMessage(sender, { text: message });
        return;
      }
      
      const selectedName = result.matches[0];
      const folder = await resourceService.getFolderWithPIC(parseInt(folderId));
      
      pendingAssignments[sender] = {
        folderId: parseInt(folderId),
        selectedName: selectedName,
        folderName: folder.name,
        step: 'confirm'
      };
      
      await sock.sendMessage(sender, {
        text: `📋 *Konfirmasi Assign PIC*\n\n📁 Folder: ${folder.name}\n👤 Nama: ${selectedName}\n\n✅ Apakah Anda yakin? Ketik:\n/confirmAssign ${folderId} | YA`
      });
      
    } catch (error) {
      await sock.sendMessage(sender, {
        text: `❌ Gagal assign PIC: ${error.message}`
      });
    }
  }

  // ===== CONFIRM ASSIGN (TANPA ADMIN CHECK) =====
  async handleConfirmAssign(sock, sender, messageText) {
    const parts = messageText.substring(14).trim().split('|').map(p => p.trim());
    
    if (parts.length < 2) {
      await sock.sendMessage(sender, {
        text: "❌ Format salah!\n\nGunakan:\n/confirmAssign [Folder ID] | [YA/TIDAK]\n\nContoh: /confirmAssign 1 | YA"
      });
      return;
    }

    const [folderId, answer] = parts;
    const pending = pendingAssignments[sender];
    
    if (!pending || pending.folderId !== parseInt(folderId)) {
      await sock.sendMessage(sender, {
        text: "❌ Tidak ada permintaan assign yang pending untuk folder ini."
      });
      return;
    }

    if (answer.toUpperCase() !== 'YA') {
      delete pendingAssignments[sender];
      await sock.sendMessage(sender, { text: "❌ Assign PIC dibatalkan." });
      return;
    }

    try {
      await resourceService.assignPIC(parseInt(folderId), pending.selectedName, null);
      const folder = await resourceService.getFolderWithPIC(parseInt(folderId));
      
      delete pendingAssignments[sender];
      
      await sock.sendMessage(sender, {
        text: `✅ PIC berhasil diassign!\n\n📁 Folder: ${folder.name}\n👤 PIC: ${pending.selectedName}`
      });
      
    } catch (error) {
      await sock.sendMessage(sender, {
        text: `❌ Gagal assign PIC: ${error.message}`
      });
    }
  }

  // ===== SELECT NAME (TANPA ADMIN CHECK) =====
  async handleSelectName(sock, sender, messageText) {
    const parts = messageText.substring(12).trim().split('|').map(p => p.trim());
    
    if (parts.length < 2) {
      await sock.sendMessage(sender, {
        text: "❌ Format salah!\n\nGunakan:\n/selectName [Folder ID] | [Angka]\n\nContoh: /selectName 1 | 2"
      });
      return;
    }

    const [folderId, indexStr] = parts;
    const pending = pendingAssignments[sender];
    
    if (!pending || pending.folderId !== parseInt(folderId) || pending.step !== 'select_name') {
      await sock.sendMessage(sender, {
        text: "❌ Tidak ada permintaan seleksi nama yang pending."
      });
      return;
    }

    const index = parseInt(indexStr) - 1;
    if (index < 0 || index >= pending.matches.length) {
      await sock.sendMessage(sender, {
        text: `❌ Angka tidak valid! Masukkan angka 1 - ${pending.matches.length}`
      });
      return;
    }

    const selectedName = pending.matches[index];
    const folder = await resourceService.getFolderWithPIC(parseInt(folderId));
    
    pendingAssignments[sender] = {
      folderId: parseInt(folderId),
      selectedName: selectedName,
      folderName: folder.name,
      step: 'confirm'
    };
    
    await sock.sendMessage(sender, {
      text: `📋 *Konfirmasi Assign PIC*\n\n📁 Folder: ${folder.name}\n👤 Nama: ${selectedName}\n\n✅ Apakah Anda yakin? Ketik:\n/confirmAssign ${folderId} | YA`
    });
  }

  // ===== DELETE ASSIGN (TANPA ADMIN CHECK) =====
  async handleDeleteAssign(sock, sender, messageText) {
    const parts = messageText.substring(13).trim().split('|').map(p => p.trim());
    
    if (parts.length < 2) {
      await sock.sendMessage(sender, {
        text: "❌ Format salah!\n\nGunakan:\n/deleteAssign [Folder ID] | [Password]\n\nContoh: /deleteAssign 1 | 070513"
      });
      return;
    }

    const [folderId, password] = parts;
    
    try {
      const result = await resourceService.deleteAssignment(parseInt(folderId), password, sender);
      
      if (result.success) {
        await sock.sendMessage(sender, {
          text: `${result.message}\n\n📁 Folder ID: ${folderId}`
        });
      } else {
        await sock.sendMessage(sender, {
          text: result.message
        });
      }
    } catch (error) {
      await sock.sendMessage(sender, {
        text: `❌ Gagal menghapus assign: ${error.message}`
      });
    }
  }

  // ===== CHANGE PASSWORD (TANPA ADMIN CHECK) =====
  async handleChangePassword(sock, sender, messageText) {
    const parts = messageText.substring(16).trim().split('|').map(p => p.trim());
    
    if (parts.length < 2) {
      await sock.sendMessage(sender, {
        text: "❌ Format salah!\n\nGunakan:\n/changePassword [Password Lama] | [Password Baru]\n\nContoh: /changePassword 070513 | 123456"
      });
      return;
    }

    const [oldPassword, newPassword] = parts;
    
    try {
      const currentPassword = await resourceService.getDeletePassword();
      if (oldPassword !== currentPassword) {
        await sock.sendMessage(sender, { text: "❌ Password lama salah!" });
        return;
      }
      
      await resourceService.updateDeletePassword(newPassword, sender);
      
      await sock.sendMessage(sender, {
        text: `✅ Password berhasil diubah!\n\n🔑 Password baru: ${newPassword}`
      });
      
    } catch (error) {
      await sock.sendMessage(sender, {
        text: `❌ Gagal mengubah password: ${error.message}`
      });
    }
  }

  // ===== LOGS (TANPA ADMIN CHECK) =====
  async handleLogs(sock, sender, messageText) {
    const folderId = messageText.substring(5).trim();
    
    try {
      const logs = await resourceService.getAssignmentLogs(
        folderId ? parseInt(folderId) : null,
        20
      );
      
      if (logs.length === 0) {
        await sock.sendMessage(sender, { text: "📭 Belum ada log aktivitas." });
        return;
      }

      let message = "📋 **ASSIGNMENT LOGS**\n\n";
      for (const log of logs) {
        const time = new Date(log.performed_at).toLocaleString('id-ID');
        const actionEmoji = {
          'assign': '✅',
          'delete': '🗑️',
          'update': '🔄',
          'update_password': '🔑'
        }[log.action] || '📌';
        
        message += `${actionEmoji} *${log.action.toUpperCase()}*\n`;
        message += `   📁 ${log.resource_folders?.name || 'System'}\n`;
        if (log.pic_name) {
          message += `   👤 ${log.pic_name}\n`;
        }
        message += `   🕐 ${time}\n\n`;
      }

      message += `📊 Total: ${logs.length} logs`;
      await sock.sendMessage(sender, { text: message });
    } catch (error) {
      await sock.sendMessage(sender, {
        text: `❌ Error: ${error.message}`
      });
    }
  }

  // ===== FOLDER DETAIL (TANPA ADMIN CHECK) =====
  async handleFolderDetail(sock, sender, folderId) {
    try {
      if (!folderId) {
        await sock.sendMessage(sender, {
          text: "❌ Masukkan Folder ID!\n\nContoh: /folderDetail 1"
        });
        return;
      }

      const folder = await resourceService.getFolderWithPIC(parseInt(folderId));
      
      if (!folder) {
        await sock.sendMessage(sender, { text: "❌ Folder tidak ditemukan!" });
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

  // ===== ADD TASK (TANPA ADMIN CHECK) =====
  async handleAddTask(sock, sender, messageText) {
    const parts = messageText.substring(9).trim().split('|').map(p => p.trim());
    
    if (parts.length < 2) {
      await sock.sendMessage(sender, {
        text: "❌ Format salah!\n\nGunakan:\n/addTask [Folder ID] | [Task Name] | [Priority] | [Due Date YYYY-MM-DD]\n\nContoh:\n/addTask 1 | Buat SOP Internal | high | 2024-12-31"
      });
      return;
    }

    const [folderId, taskName, priority = 'medium', dueDate] = parts;
    
    try {
      await resourceService.createTask(
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

  // ===== UPDATE TASK (TANPA ADMIN CHECK) =====
  async handleUpdateTask(sock, sender, messageText) {
    const parts = messageText.substring(12).trim().split('|').map(p => p.trim());
    
    if (parts.length < 2) {
      await sock.sendMessage(sender, {
        text: "❌ Format salah!\n\nGunakan:\n/updateTask [Task ID] | [Status]\n\nStatus: pending, in_progress, completed, review"
      });
      return;
    }

    const [taskId, status] = parts;
    
    try {
      await resourceService.updateTaskStatus(parseInt(taskId), status);
      
      await sock.sendMessage(sender, {
        text: `✅ Task status berhasil diupdate!\n\n📋 Task ID: ${taskId}\n📊 Status: ${status}`
      });
    } catch (error) {
      await sock.sendMessage(sender, {
        text: `❌ Gagal update task: ${error.message}`
      });
    }
  }

  // ===== REPORT (TANPA ADMIN CHECK) =====
  async handleReport(sock, sender) {
    try {
      const assignments = await resourceService.getAllAssignments();
      
      let message = "📊 **BRAIN RESOURCE CENTER REPORT**\n\n";
      
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

      await sock.sendMessage(sender, { text: message });
    } catch (error) {
      await sock.sendMessage(sender, {
        text: `❌ Error: ${error.message}`
      });
    }
  }
}

module.exports = new ResourceCommand();