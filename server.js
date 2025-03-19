require("dotenv").config();
const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB Connection Error:", err));

// Define Mongoose Schema & Model
const UserSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  gender: String,
  phone: String,
  country: String,
  state: String,
  city: String,
  address: String,
  idType: String,
  idFileUrl: String, // Stores file path as a string
}, { timestamps: true });

const User = mongoose.model("User", UserSchema);

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, `idFile-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB Limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const isValid = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    isValid ? cb(null, true) : cb(new Error("Only images (JPEG, JPG, PNG) and PDFs are allowed!"));
  },
});

// Serve uploaded files
app.use("/uploads", express.static("uploads"));

app.post("/register", (req, res, next) => {
  upload.single("idFile")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // Handle Multer-specific errors (e.g., file too large, invalid format)
      return res.status(400).json({ error: err.message });
    } else if (err) {
      // Handle other errors (e.g., unsupported file type)
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { firstName, lastName, email, gender, phone, country, state, city, address, idType } = req.body;

    if (!firstName || !lastName || !email || !gender || !phone || !country || !state || !city || !address || !idType || !req.file) {
      return res.status(400).json({ error: "All fields and file upload are required!" });
    }

    let userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ error: "User already registered" });
    }

    // Save user to MongoDB
    const newUser = new User({
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
      idFileUrl: `/uploads/${req.file.filename}`,
    });

    await newUser.save();

    res.json({
      message: "Registration successful!",
      data: newUser,
    });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

// Registration Route (Stores in MongoDB)
// app.post("/register", upload.single("idFile"), async (req, res) => {
//   try {
//     if (err instanceof multer.MulterError) {
//       // File too large error
//       if (err.code === "LIMIT_FILE_SIZE") {
//         return res.status(400).json({ error: "File size must be less than 5MB!" });
//       }
//     } else if (err) {
//       // File format error
//       return res.status(400).json({ error: err.message });
//     }
//     const { firstName, lastName, email, gender, phone, country, state, city, address, idType } = req.body;

//     if (!firstName || !lastName || !email || !gender || !phone || !country || !state || !city || !address || !idType || !req.file) {
//       return res.status(400).json({ error: "All fields and file upload are required!" });
//     }
//     // const idFile = req.file ? req.file.path : null;

//     // if (!idFile) {
//     //   return res.status(400).json({ msg: 'ID file is required' });
//     // }

//     let userExists = await User.findOne({ email });
//     if (userExists) {
//       return res.status(400).json({ msg: 'User already registered' });
//     }

//     // Save user to MongoDB
//     const newUser = new User({
//       firstName,
//       lastName,
//       email,
//       gender,
//       phone,
//       country,
//       state,
//       city,
//       address,
//       idType,
//       idFileUrl: `/uploads/${req.file.filename}`,
//     });

//     await newUser.save();

//     res.json({
//       message: "Registration successful!",
//       data: newUser,
//     });
//   } catch (error) {
//     res.status(500).json({ error: "Internal Server Error", details: error.message });
//   }
// });

// Get All Registered Users
app.get("/users", async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// DELETE User API
app.delete("/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // If the user has an uploaded file, delete it from the filesystem
    if (user.idFileUrl) {
      const fs = require("fs");
      const filePath = `.${user.idFileUrl}`; // Convert relative path to absolute
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
