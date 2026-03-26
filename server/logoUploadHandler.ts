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
  // Validate file type - Adicionado image/svg+xml
  const allowedMimes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
  if (!allowedMimes.includes(file.mimetype)) {
    cb(new Error("Apenas arquivos PNG, JPG, JPEG, WEBP e SVG são permitidos"));
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
  // Rota de Upload com suporte a substituição (overwrite)
  app.post("/api/logo/upload", (req, res, next) => {
    const fileName = req.headers['x-file-name'] as string;
    const overwrite = req.headers['x-overwrite'] === 'true';

    if (fileName && !overwrite && fs.existsSync(path.join(LOGOS_DIR, fileName))) {
      return res.status(409).json({ 
        error: "CONFLITO", 
        message: `O arquivo "${fileName}" já existe. Deseja substituir?` 
      });
    }
    next();
  }, upload.single("file"), (req, res) => {
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

  // Rota de Deleção de Logo
  app.delete("/api/logos/:name", (req, res) => {
    const logoName = req.params.name;
    const filePath = path.join(LOGOS_DIR, logoName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Arquivo não encontrado" });
    }

    try {
      fs.unlinkSync(filePath);
      res.json({ success: true, message: `Logo "${logoName}" excluída com sucesso` });
    } catch (err) {
      res.status(500).json({ error: "Erro ao excluir o arquivo" });
    }
  });

  // Serve logos directory as static files
  app.use("/logos", express.static(LOGOS_DIR));
}
