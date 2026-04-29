import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import mongoose from "mongoose";
import itemRoutes from "./routes/itemRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure env is loaded correctly regardless of the current working directory.
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Item Manager API is running..." });
});

app.use("/api/items", itemRoutes);

const PORT = process.env.PORT || 5000;

let mongoConnected = false;
let mongoPingOk = false;

app.get("/api/health", (req, res) => {
  res.json({
    mongoConnected,
    mongoPingOk,
    mongooseReadyState: mongoose.connection.readyState,
  });
});

const startServer = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("Missing MONGO_URI in backend/.env");
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    mongoConnected = true;
    console.log("MongoDB connected");

    // Prove that authentication + network access works.
    await mongoose.connection.db.admin().ping();
    mongoPingOk = true;
    console.log("MongoDB ping successful");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    // Some environments can block SRV DNS lookups required by `mongodb+srv://`.
    // If that happens, try a non-SRV URI as a fallback.
    const maybeSrvBlocked =
      error?.code === "ENOTFOUND" && mongoUri.startsWith("mongodb+srv://");

    if (maybeSrvBlocked) {
      const fallbackUri = mongoUri.replace("mongodb+srv://", "mongodb://");
      console.warn(
        "MongoDB SRV DNS lookup failed; retrying with non-SRV URI."
      );

      try {
        await mongoose.disconnect().catch(() => {});
        await mongoose.connect(fallbackUri);
        mongoConnected = true;
        console.log("MongoDB connected (non-SRV)");

        await mongoose.connection.db.admin().ping();
        mongoPingOk = true;
        console.log("MongoDB ping successful (non-SRV)");

        app.listen(PORT, () => {
          console.log(`Server running on port ${PORT}`);
        });
        return;
      } catch (fallbackError) {
        console.error(
          "Database connection error (non-SRV fallback):",
          fallbackError.message
        );
        process.exit(1);
      }
    }

    console.error("Database connection error:", error.message);
    process.exit(1);
  }
};

startServer();