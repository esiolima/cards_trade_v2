import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

const LOGOS_DIR = path.resolve("logos");

// Ensure logos directory exists
if (!fs.existsSync(LOGOS_DIR)) {
  fs.mkdirSync(LOGOS_DIR, { recursive: true });
}

// Configure multer for logo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, LOGOS_DIR);
  },
  filename: (req, file, cb) => {
    // Keep original filename
    cb(null, file.originalname);
  },
});

const fileFilter = (
  req: express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Validate file type
  const allowedMimes = ["image/png", "image/jpeg", "image/jpg"];
  if (!allowedMimes.includes(file.mimetype)) {
    cb(new Error("Apenas arquivos PNG, JPG e JPEG são permitidos"));
    return;
  }

  // Validate filename to prevent directory traversal
  if (file.originalname.includes("..") || file.originalname.includes("/")) {
    cb(new Error("Nome de arquivo inválido"));
    return;
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

export function setupLogoUploadRoute(app: express.Express) {
  app.post("/api/logo/upload", upload.single("file"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo foi enviado" });
    }

    res.json({
      success: true,
      message: `Logo "${req.file.originalname}" enviado com sucesso`,
      filename: req.file.originalname,
      path: `/logos/${req.file.originalname}`,
    });
  });

  // Serve logos directory as static files
  app.use("/logos", express.static(LOGOS_DIR));
}
