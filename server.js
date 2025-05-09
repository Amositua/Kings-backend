require("dotenv").config();
const express = require("express");
const Stripe = require("stripe");
const multer = require("multer");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const sendMail = require("./config/mailer");

const nodemailer = require("nodemailer");


const stripe = Stripe(process.env.STRIPE_SECRET_KEY);


const app = express();
app.use(cors());
app.use(express.json());

// app.use((req, res, next) => {
//   res.setHeader(
//     'Content-Security-Policy',
//     "default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com blob:https://js.stripe.com; frame-src https://js.stripe.com https://hooks.stripe.com;"
//   );
//   next();
// });


// route to create a payment intent
app.post("/create-checkout-session", async (req, res) => {
  try {

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'ngn',
            product_data: { name: 'Service Payment' },
            unit_amount: 70000, // $50.00 in cents
          },
          quantity: 1,
        },
      ],
      success_url: 'http://localhost:3000/success',
      cancel_url: 'http://localhost:3000/cancel',
    });
    
    res.json({ id: session.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.get('/', (req, res) => {
  res.send('API is running....');
}); 

app.get('/api/config/paypal', (req, res) => {
   res.send({clientId: process.env.PAYPAL_CLIENT_ID}) 
})

// Email sending function
const sendEmail = async (formData) => {
  const transporter = nodemailer.createTransport({
    service: "gmail", // Use your email provider
    auth: {
      user: process.env.EMAIL_USER, // Your email
      pass: process.env.EMAIL_PASS, // Your email password or App Password
    },
  });

  const { name, email, message } = formData;

  // Email to Receiver (Your Email)
  const mailToReceiver = {
    from: email,
    to: [process.env.RECEIVER_EMAIL_1, process.env.RECEIVER_EMAIL_2], // Your email
    subject: "New Contact Form Submission",
    text: `You have received a new message from:
    
    Name: ${name}
    Email: ${email}
    Message: ${message}`,
  };

  // Acknowledgment Email to Sender
  const mailToSender = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Your Submission Was Received!",
    text: `Hello ${name},

    Thank you for contacting us. We have received your message and will get back to you soon.

    Best regards,
    Kings Health Care Practitioner Limited`,
  };

  // Sending Emails
  await transporter.sendMail(mailToReceiver);
  await transporter.sendMail(mailToSender);
};

// API Route to Handle Form Submission
app.post("/send-email", async (req, res) => {
  try {
    await sendEmail(req.body);
    res.status(200).json({ success: true, message: "Emails sent successfully!" });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ success: false, message: "Failed to send email" });
  }
});


// PART 2
// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB Connection Error:", err));

// Define Mongoose Schema & Model
const UserSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: { type: String, unique: true, required: true },
  gender: String,
  phone: String,
  country: String,
  state: String,
  city: String,
  address: String,
  idType: String,
  idFileUrl: String, // Stores file path as a string
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
}, { timestamps: true });

const User = mongoose.model("User", UserSchema);

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log("Saving file to: uploads/"); // Debugging log
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    console.log("File received:", file.originalname); // Debugging log
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

// app.post("/register", upload.single("idFile"), async (req, res) => {
//   console.log('File:', req.file); // Log file details
//   console.log('Body:', req.body); // Log form data

//   if (!req.file) {
//     console.error('No file uploaded');
//     return res.status(400).json({ error: "No file uploaded" });
//   }
  
//   try {
//     const { firstName, lastName, email, gender, phone, country, state, city, address, idType } = req.body;

//     if (!firstName || !lastName || !email || !gender || !phone || !country || !state || !city || !address || !idType || !req.file) {
//       return res.status(400).json({ error: "All fields and file upload are required!" });
//     }

//     let userExists = await User.findOne({ email });
//     if (userExists) {
//       return res.status(400).json({ error: "User already registered" });
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

//      // Send email to user (confirmation of registration)
//      const userEmailContent = `
//      <h3>Dear ${newUser.firstName},</h3>
//      <p>Your registration has been received! We will review your details and notify you of the approval status.</p>
//    `;
//    await sendMail(newUser.email, "Training Registration Received", userEmailContent);

//    // Send email to admin (new registration notification)
//    const adminEmailContent = `
//      <h3>New User Registration</h3>
//      <p>A new user has registered:</p>
//      <ul>
//        <li>Name: ${newUser.firstName} ${newUser.lastName}</li>
//        <li>Email: ${newUser.email}</li>
//        <li>Phone: ${newUser.phone}</li>
//      </ul>
//      <p><a href="https://kings-backend-4diu.onrender.com/users">Review & Approve Users</a></p>
//    `;
//    await sendMail(process.env.ADMIN_EMAIL, "New User Registration", adminEmailContent);


//     res.status(201).json({
//       message: "Registration successful. Await approval.",
//       data: newUser,
//     });

//   } catch (error) {
//     res.status(500).json({ error: "Internal Server Error", details: error.message });
//   }
// });


app.post("/register", (req, res, next) => {
  console.log('File:', req.file); // Log file details
  console.log('Body:', req.body);
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

     // Send email to user (confirmation of registration)
     const userEmailContent = `
     <h3>Dear ${newUser.firstName},</h3>
     <p>Your registration has been received! We will review your details and notify you of the approval status.</p>
   `;
   await sendMail(newUser.email, "Training Registration Received", userEmailContent);

   // Send email to admin (new registration notification)
   const adminEmailContent = `
     <h3>New User Registration</h3>
     <p>A new user has registered:</p>
     <ul>
       <li>Name: ${newUser.firstName} ${newUser.lastName}</li>
       <li>Email: ${newUser.email}</li>
       <li>Phone: ${newUser.phone}</li>
     </ul>
     <p><a href="https://kings-backend-4diu.onrender.com/users">Review & Approve Users</a></p>
   `;
   await sendMail(process.env.ADMIN_EMAIL, "New User Registration", adminEmailContent);


    res.status(201).json({
      message: "Registration successful. Await approval.",
      data: newUser,
    });

  } catch (error) {
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

// Update User Status
app.post("/users/update-status", async (req, res) => {
  try {
    const { userId, status } = req.body;
    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ error: "User not found" });

    user.status = status;
    await user.save();

    // Send approval/rejection email to user
    const emailContent =
      status === "approved"
        ? `<h3>Congratulations ${user.firstName},</h3><p>Your registration has been approved! Further details will be sent soon.</p>`
        : `<h3>Dear ${user.firstName},</h3><p>Unfortunately, your registration was not approved.</p>`;

    await sendMail(user.email, `Your Registration has been ${status}`, emailContent);

    res.json({ message: `User status updated to ${status}` });
  } catch (error) {
    res.status(500).json({ error: "Error updating user status" });
  }
});

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
