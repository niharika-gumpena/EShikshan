const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  username: String,
  password: String,
  email: String,
});

const facultySchema = new mongoose.Schema({
  username: String,
  password: String,
  email: String,
  subject: String,
});

const contentSchema = new mongoose.Schema({
  date: String,
  content: String,
  subject: String
});

const fileSchema = new mongoose.Schema({
  originalName: String,
  uploadDate: { type: Date, default: Date.now },
  filePath: String,
  subject: String,
});

const student = mongoose.model('Students_detail', studentSchema);
const faculty = mongoose.model('Faculty_detail', facultySchema);
const Note = mongoose.model("Note", contentSchema);
const File = mongoose.model('File', fileSchema);

module.exports = { student, faculty, Note, File };
