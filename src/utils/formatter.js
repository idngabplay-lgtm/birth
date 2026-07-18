function formatDate(dateString) {
  const date = new Date(dateString);
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function formatBirthdate(birthdate) {
  const [year, month, day] = birthdate.split('-');
  return `${day}/${month}/${year}`;
}

function formatDaysRemaining(days) {
  if (days === 0) return 'Hari ini! 🎉';
  if (days === 1) return 'Besok! 🎂';
  if (days < 7) return `${days} hari lagi`;
  if (days < 30) return `${Math.floor(days / 7)} minggu lagi`;
  if (days < 365) return `${Math.floor(days / 30)} bulan lagi`;
  return `${Math.floor(days / 365)} tahun lagi`;
}

module.exports = {
  formatDate,
  formatBirthdate,
  formatDaysRemaining
};