require("dotenv").config();
const express = require("express");
const multer = require("multer");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Save files in "uploads" directory
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

// File Filter (Restrict to specific file types)
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (extname && mimetype) {
    return cb(null, true);
  } else {
    return cb(new Error("Only images (JPEG, JPG, PNG) and PDFs are allowed!"));
  }
};

// Initialize Multer Upload
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
  fileFilter: fileFilter
});

// API Route to Handle Form Submission & File Upload
app.post("/register", upload.single("idFile"), (req, res) => {
  try {
    const { firstName, lastName, email, gender, phone, country, state, city, address, idType } = req.body;
    const idFile = req.file ? req.file.filename : null;

    if (!firstName || !lastName || !email || !phone || !idType || !idFile) {
      return res.status(400).json({ error: "All required fields must be filled!" });
    }

    // Process form data (e.g., save to database)
    res.status(200).json({
      message: "Registration successful!",
      data: {
        firstName,
        lastName,
        email,
        gender,
        phone,
        country,
        state,
        city,
        address,
        idType,
        idFileUrl: `/uploads/${idFile}`
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start the Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
