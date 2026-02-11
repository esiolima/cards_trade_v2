import express, { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

const UPLOAD_DIR = path.resolve("uploads");

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Only accept .xlsx files
    if (!file.originalname.endsWith(".xlsx")) {
      return cb(new Error("Only .xlsx files are allowed"));
    }

    // Max file size: 10MB
    if (file.size > 10 * 1024 * 1024) {
      return cb(new Error("File size exceeds 10MB limit"));
    }

    cb(null, true);
  },
});

export function setupUploadRoute(app: express.Application) {
  app.post("/api/upload", upload.single("file"), (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    res.json({
      success: true,
      filePath: req.file.path,
      fileName: req.file.originalname,
    });
  });

  // Download route for ZIP files
  app.get("/api/download", (req: Request, res: Response) => {
    const { zipPath } = req.query;

    if (!zipPath || typeof zipPath !== "string") {
      return res.status(400).json({ error: "Invalid zip path" });
    }

    // Security: ensure path is within output directory
    const outputDir = path.resolve("output");
    const resolvedPath = path.resolve(zipPath);

    if (!resolvedPath.startsWith(outputDir)) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: "File not found" });
    }

    res.download(resolvedPath, "cards.zip", (err) => {
      if (err) {
        console.error("Download error:", err);
      }

      // Clean up uploaded file and generated files after download
      const uploadsDir = path.resolve("uploads");
      if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir);
        for (const file of files) {
          try {
            fs.unlinkSync(path.join(uploadsDir, file));
          } catch (e) {
            // Ignore cleanup errors
          }
        }
      }
    });
  });
}
