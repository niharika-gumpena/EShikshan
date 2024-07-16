const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const session = require('express-session');
const ejs = require('ejs');
const { student, faculty, Note, File } = require('./schema');

const app = express();
const port = process.env.PORT || 3000;

// Middleware setup
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database connection
mongoose.connect('mongodb://localhost:27017/store_detais', {
  //useNewUrlParser: true,
  //useUnifiedTopology: true,
}).then(() => console.log('Connected to MongoDB'))
  .catch(error => console.error('Error connecting to MongoDB:', error));

// Session setup
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }, // Set to true if using HTTPS
}));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Multer storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage });

// Home route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Student login route
app.post('/student_submit', async (req, res) => {
  try {
    const { username, password } = req.body;
    const existingUser = await student.findOne({ username, password });
    if (existingUser) {
      req.session.user = existingUser;
      res.redirect(`/student.html?username=${username}`);
    } else {
      res.status(401).send('<script>alert("Incorrect credentials. Please try again."); window.location.href = "/";</script>');
    }
  } catch (error) {
    console.error('Error during student authentication:', error);
    res.status(500).send('Error during authentication.');
  }
});

// Faculty login route
app.post('/faculty_submit', async (req, res) => {
  try {
    const { username, password } = req.body;
    const existingUser = await faculty.findOne({ username, password });
    if (existingUser) {
      req.session.user = existingUser; // Added session management
      res.redirect(`/faculty.html?username=${username}`);
    } else {
      res.status(401).send('<script>alert("Incorrect credentials. Please try again."); window.location.href = "/";</script>');
    }
  } catch (error) {
    console.error('Error during faculty authentication:', error);
    res.status(500).send('Error during authentication.');
  }
});

// Route to post new notes by faculty
app.post("/faculty.html", async (req, res) => {
  try {
    // Capture current date
    const currentDate = new Date().toISOString().split('T')[0]; // Format as YYYY-MM-DD

    // Retrieve faculty's username from the request
    const usernameToSearch = req.body.faculty_username;
    
    // Find the faculty document
    const doc = await faculty.findOne({ username: usernameToSearch });
    
    // Get the subject for the note
    const subjectToPost = doc.subject;

    // Create a new Note instance with current date and content
    const newNote = new Note({
      date: currentDate,
      content: req.body.content,
      subject: subjectToPost
    });

    // Save the note to the database
    await newNote.save();

    // Redirect to the faculty's page
    res.redirect(`/faculty.html?username=${usernameToSearch}`);
  } catch (error) {
    console.error('Error posting note:', error);
    res.status(500).send('Internal server error.');
  }
});


// Route to handle file uploads
app.post('/upload_file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No file uploaded.');
    }

    const usernameToSearch = req.body.faculty_username;
    const doc = await faculty.findOne({ username: usernameToSearch });

    if (!doc) {
      return res.status(404).send('Faculty not found.');
    }

    const subjectToPost = doc.subject;

    const newFile = new File({
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      filePath: req.file.path,
      subject: subjectToPost,
      uploadDate: new Date() // Ensure the upload date is saved
    });

    await newFile.save();
    res.redirect(`/faculty.html?username=${usernameToSearch}`);
  } catch (error) {
    console.error('Error saving file:', error);
    res.status(500).send('Internal server error.');
  }
});


// Route to display updates based on subject
app.post('/display_updates', async (req, res) => {
  try {
    const subjectToSearch = req.body.subject;
    const notes = await Note.find({ subject: subjectToSearch });

    let tableText = `<table frame="box" text-align="center" border="2">
      <tr>
        <th>Date</th>
        <th>Content</th>
      </tr>`;
      
    notes.forEach(note => {
      tableText += `<tr>
        <td>${note.date}</td>
        <td>${note.content}</td>
      </tr>`;
    });
    tableText += `</table>`;
    
    // Send data to the EJS template
    res.render('display_updates', {
      subject: subjectToSearch, // Pass subject
      notes: notes // Pass notes array
    });
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).send(`Internal server error: ${error.message}`);
  }
});


// Route to display course materials based on subject
app.post('/display_coursematerials', async (req, res) => {
  try {
    const subjectToSearch = req.body.subject;
    console.log('Searching for files with subject:', subjectToSearch); // Debug statement

    const files = await File.find({ subject: subjectToSearch });
    console.log('Files found:', files); // Debug statement

    const formattedFiles = files.map(file => ({
      originalName: file.originalName,
      uploadDate: file.uploadDate.toISOString().split('T')[0],
      downloadLink: `/download/${file._id}`
    }));

    res.render('display_coursematerials', {
      subject: subjectToSearch,
      files: formattedFiles
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).send(`Internal server error: ${error.message}`);
  }
});

app.post('/course_materials', async (req, res) => {
  try {
    const subjectToSearch = req.body.subject; // Retrieve subject from the request body
    console.log('Requested subject:', subjectToSearch);

    // Fetch files related to the subject
    const files = await File.find({ subject: subjectToSearch });
    console.log('Files found:', files);

    // Format the files for the EJS template
    const formattedFiles = files.map(file => ({
      originalName: file.originalName,
      uploadDate: file.uploadDate.toLocaleDateString('en-GB'), // Format date as 'day/month/year'
      downloadLink: `/download/${file._id}`
    }));

    // Render the EJS template and pass the data
    res.render('display_coursematerials', {
      subject: subjectToSearch,
      files: formattedFiles
    });
  } catch (error) {
    console.error('Error fetching course materials:', error);
    res.status(500).send(`Internal server error: ${error.message}`);
  }
});



// Route to search for updates by date
app.post('/search_by_date', async (req, res) => {
  try {
    // Parse the search date from the request body
    const searchDate = new Date(req.body.search_date);
    const nextDay = new Date(searchDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Log the date to verify
    console.log(`Searching for notes and files on date: ${req.body.search_date}`);

    // Fetch notes with exact match for the given date
    const notes = await Note.find({ date: req.body.search_date });

    // Fetch files uploaded within the date range
    const files = await File.find({ uploadDate: { $gte: searchDate, $lt: nextDay } });

    // Log the fetched data to verify
    console.log('Fetched notes:', notes);
    console.log('Fetched files:', files);

    // Render the EJS template with the fetched data
    res.render('search_by_date', {
      notes,
      files,
      search_date: req.body.search_date
    });
  } catch (error) {
    console.error('Error fetching notes and files:', error);
    res.status(500).send(`Internal server error: ${error.message}`);
  }
});
// Route to download files
app.get('/download/:fileId', async (req, res) => {
  try {
    const file = await File.findById(req.params.fileId);
    if (!file) throw new Error('File not found'); // Error handling

    res.download(file.filePath, file.originalName);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).send('Internal server error.');
  }
});

// Logout route to destroy session
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Error destroying session:', err);
    }
    res.redirect('/');
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
