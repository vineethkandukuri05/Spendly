require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/spendly";

// Enable CORS and JSON body parsing
app.use(cors());
app.use(express.json());

// Path to fallback local JSON storage file
const dataFile = path.join(__dirname, "data.json");

// Default student and categories
const defaultStudent = {
  studentId: "STD-101",
  name: "College Student"
};

const defaultExpenseCategories = [
  "Food",
  "Transport",
  "College Fees",
  "Shopping",
  "Entertainment",
  "Other"
];

const defaultIncomeCategories = [
  "Freelance Income",
  "Pocket Money",
  "Other"
];

const allDefaultCategories = [
  "Food",
  "Transport",
  "College Fees",
  "Shopping",
  "Entertainment",
  "Freelance Income",
  "Pocket Money",
  "Other"
];

// Fallback in-memory/JSON data store structure
let localData = {
  student: defaultStudent,
  categories: [...allDefaultCategories],
  incomeCategories: [...defaultIncomeCategories],
  expenseCategories: [...defaultExpenseCategories],
  transactions: []
};

// Load existing data.json if available
if (fs.existsSync(dataFile)) {
  try {
    const fileContent = fs.readFileSync(dataFile, "utf8");
    localData = { ...localData, ...JSON.parse(fileContent) };
    if (!localData.categories || localData.categories.length === 0) {
      localData.categories = [...defaultCategories];
    }
  } catch (err) {
    console.error("Error reading data.json:", err.message);
  }
}

function saveLocalData() {
  try {
    fs.writeFileSync(dataFile, JSON.stringify(localData, null, 2));
  } catch (err) {
    console.error("Error writing data.json:", err.message);
  }
}

// Track whether MongoDB is actively connected
let useMongo = false;

// --- Mongoose Schemas & Models ---
const studentSchema = new mongoose.Schema({
  studentId: { type: String, required: true, default: "STD-101" },
  name: { type: String, required: true, default: "College Student" }
});

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true }
});

const transactionSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0.01 },
    type: { type: String, enum: ["income", "expense"], required: true },
    category: { type: String, required: true, default: "Other" },
    date: { type: String, required: true },
    studentId: { type: String, default: "STD-101" }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        return ret;
      }
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        return ret;
      }
    }
  }
);

const Student = mongoose.model("Student", studentSchema);
const Category = mongoose.model("Category", categorySchema);
const Transaction = mongoose.model("Transaction", transactionSchema);

// Seed initial student and categories in MongoDB if empty
async function seedMongoDefaults() {
  for (const catName of allDefaultCategories) {
    const exists = await Category.findOne({ name: catName });
    if (!exists) {
      await Category.create({ name: catName });
    }
  }

  const studentCount = await Student.countDocuments();
  if (studentCount === 0) {
    await Student.create(defaultStudent);
    console.log("Seeded default student into MongoDB");
  }
}

// --- Validation Helper ---
function validateTransaction(body) {
  const { description, amount, type, category, date } = body;

  if (!description || typeof description !== "string" || !description.trim()) {
    return "Description is required";
  }

  const numAmount = Number(amount);
  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    return "Amount must be a positive number greater than 0";
  }

  if (!["income", "expense"].includes(type)) {
    return "Transaction type must be 'income' or 'expense'";
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    return "Valid date in YYYY-MM-DD format is required";
  }

  return null;
}

// --- API Routes ---

// 1. Get Student details
app.get("/api/student", async (req, res) => {
  try {
    if (useMongo) {
      let student = await Student.findOne();
      if (!student) {
        student = await Student.create(defaultStudent);
      }
      return res.json(student);
    }
    res.json(localData.student || defaultStudent);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch student details", error: error.message });
  }
});

// 2. Get categories (supports ?type=income or ?type=expense)
app.get("/api/categories", async (req, res) => {
  try {
    const { type } = req.query;

    if (type === "income") {
      return res.json(defaultIncomeCategories);
    }
    if (type === "expense") {
      return res.json(defaultExpenseCategories);
    }

    if (useMongo) {
      const categories = await Category.find().sort({ name: 1 });
      return res.json(categories.map((c) => c.name));
    }
    res.json(localData.categories);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch categories", error: error.message });
  }
});

// 3. Add a category
app.post("/api/categories", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Category name is required" });
    }

    const categoryName = name.trim();

    if (useMongo) {
      const existing = await Category.findOne({
        name: { $regex: new RegExp(`^${categoryName}$`, "i") }
      });
      if (existing) {
        return res.status(400).json({ message: "Category already exists" });
      }
      const category = await Category.create({ name: categoryName });
      return res.status(201).json({ name: category.name });
    }

    if (localData.categories.some((c) => c.toLowerCase() === categoryName.toLowerCase())) {
      return res.status(400).json({ message: "Category already exists" });
    }

    localData.categories.push(categoryName);
    saveLocalData();
    res.status(201).json({ name: categoryName });
  } catch (error) {
    res.status(500).json({ message: "Failed to add category", error: error.message });
  }
});

// 4. Get transactions (optionally filter by category or month)
app.get("/api/transactions", async (req, res) => {
  try {
    const { category, month } = req.query;

    if (useMongo) {
      const filter = {};
      if (category && category !== "All") {
        filter.category = category;
      }
      if (month) {
        filter.date = { $regex: `^${month}` };
      }
      const transactions = await Transaction.find(filter).sort({ date: -1, createdAt: -1 });
      return res.json(transactions);
    }

    let results = localData.transactions;
    if (category && category !== "All") {
      results = results.filter((t) => t.category === category);
    }
    if (month) {
      results = results.filter((t) => t.date && t.date.startsWith(month));
    }
    // Sort newest date first
    results.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch transactions", error: error.message });
  }
});

// 5. Get a single transaction by ID
app.get("/api/transactions/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (useMongo) {
      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Invalid transaction ID format" });
      }
      const transaction = await Transaction.findById(id);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      return res.json(transaction);
    }

    const transaction = localData.transactions.find((t) => String(t.id) === String(id));
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }
    res.json(transaction);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch transaction", error: error.message });
  }
});

// 6. Create a transaction
app.post("/api/transactions", async (req, res) => {
  try {
    const error = validateTransaction(req.body);
    if (error) {
      return res.status(400).json({ message: error });
    }

    const { description, amount, type, category, date, studentId } = req.body;
    const assignedCategory = category && category.trim() ? category.trim() : "Other";
    const assignedStudent = studentId || "STD-101";

    if (useMongo) {
      const transaction = await Transaction.create({
        description: description.trim(),
        amount: Number(amount),
        type,
        category: assignedCategory,
        date,
        studentId: assignedStudent
      });
      return res.status(201).json(transaction);
    }

    const nextId = localData.transactions.length > 0
      ? Math.max(...localData.transactions.map((t) => Number(t.id) || 0)) + 1
      : 1;

    const newTransaction = {
      id: nextId,
      description: description.trim(),
      amount: Number(amount),
      type,
      category: assignedCategory,
      date,
      studentId: assignedStudent,
      createdAt: new Date().toISOString()
    };

    localData.transactions.push(newTransaction);
    saveLocalData();
    res.status(201).json(newTransaction);
  } catch (error) {
    res.status(500).json({ message: "Failed to create transaction", error: error.message });
  }
});

// 7. Update a transaction by ID
app.put("/api/transactions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const error = validateTransaction(req.body);
    if (error) {
      return res.status(400).json({ message: error });
    }

    const { description, amount, type, category, date, studentId } = req.body;
    const assignedCategory = category && category.trim() ? category.trim() : "Other";

    if (useMongo) {
      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Invalid transaction ID format" });
      }

      const transaction = await Transaction.findById(id);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      transaction.description = description.trim();
      transaction.amount = Number(amount);
      transaction.type = type;
      transaction.category = assignedCategory;
      transaction.date = date;
      if (studentId) transaction.studentId = studentId;

      await transaction.save();
      return res.json(transaction);
    }

    const index = localData.transactions.findIndex((t) => String(t.id) === String(id));
    if (index === -1) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    const updated = {
      ...localData.transactions[index],
      description: description.trim(),
      amount: Number(amount),
      type,
      category: assignedCategory,
      date,
      updatedAt: new Date().toISOString()
    };
    if (studentId) updated.studentId = studentId;

    localData.transactions[index] = updated;
    saveLocalData();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update transaction", error: error.message });
  }
});

// 8. Delete a transaction by ID
app.delete("/api/transactions/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (useMongo) {
      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Invalid transaction ID format" });
      }

      const result = await Transaction.findByIdAndDelete(id);
      if (!result) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      return res.json({ message: "Transaction deleted successfully" });
    }

    const index = localData.transactions.findIndex((t) => String(t.id) === String(id));
    if (index === -1) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    localData.transactions.splice(index, 1);
    saveLocalData();
    res.json({ message: "Transaction deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete transaction", error: error.message });
  }
});

// 9. Summary calculation (all or filtered by month)
app.get("/api/summary", async (req, res) => {
  try {
    const { month } = req.query;

    let transactions;
    if (useMongo) {
      const filter = month ? { date: { $regex: `^${month}` } } : {};
      transactions = await Transaction.find(filter);
    } else {
      transactions = localData.transactions;
      if (month) {
        transactions = transactions.filter((t) => t.date && t.date.startsWith(month));
      }
    }

    const income = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const expenses = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    res.json({
      income,
      expenses,
      balance: income - expenses,
      count: transactions.length
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to calculate summary", error: error.message });
  }
});

// --- Server Initialization ---
async function startServer() {
  try {
    console.log("Connecting to MongoDB at:", MONGODB_URI);
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 2500 });
    useMongo = true;
    console.log("MongoDB connected successfully. Using MongoDB database storage.");
    await seedMongoDefaults();
  } catch (err) {
    useMongo = false;
    console.warn("MongoDB connection unavailable (" + err.message + ").");
    console.log("Using persistent local JSON file storage (data.json).");
  }

  app.listen(PORT, () => {
    console.log(`Spendly Server running at http://localhost:${PORT}`);
  });
}

startServer();
