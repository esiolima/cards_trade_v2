import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { CardGenerator } from "../cardGenerator";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const BASE_DIR = process.cwd();
const LOGOS_DIR = path.join(BASE_DIR, "logos");
const OUTPUT_DIR = path.join(BASE_DIR, "output");
const PUBLIC_DIR = path.join(BASE_DIR, "dist/public");

// =============================
// GARANTE PASTAS
// =============================
if (!fs.existsSync(LOGOS_DIR)) {
  fs.mkdirSync(LOGOS_DIR, { recursive: true });
}

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// =============================
// SERVIR LOGOS ESTÁTICOS
// =============================
app.use("/logos", express.static(LOGOS_DIR));

// =============================
// MULTER
// =============================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, LOGOS_DIR);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

// =============================
// LISTAR LOGOS
// =============================
app.get("/api/logos", (req, res) => {
  const files = fs
    .readdirSync(LOGOS_DIR)
    .filter((file) =>
      file.match(/\.(png|jpg|jpeg|webp)$/i)
    );

  res.json(files);
});

// =============================
// UPLOAD LOGO
// =============================
app.post("/api/logos", upload.single("logo"), (req, res) => {
  res.json({ success: true });
});

// =============================
// DELETAR LOGO (PROTEGE blank.png)
// =============================
app.delete("/api/logos/:name", (req, res) => {
  const fileName = req.params.name;

  if (fileName.toLowerCase() === "blank.png") {
    return res.status(403).json({
      error: "O arquivo blank.png não pode ser excluído.",
    });
  }

  const filePath = path.join(LOGOS_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Arquivo não encontrado" });
  }

  fs.unlinkSync(filePath);

  res.json({ success: true });
});

// =============================
// GERAR CARDS
// =============================
app.post("/api/generate", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Arquivo não enviado" });
    }

    const generator = new CardGenerator();
    await generator.initialize();

    const zipPath = await generator.generateCards(req.file.path);

    await generator.close();

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao gerar cards" });
  }
});

// =============================
// DOWNLOAD ZIP
// =============================
app.get("/api/download", (req, res) => {
  const zipPath = path.join(OUTPUT_DIR, "cards.zip");

  if (!fs.existsSync(zipPath)) {
    return res.status(404).json({ error: "Arquivo não encontrado" });
  }

  res.download(zipPath);
});

// =============================
// SERVIR FRONTEND BUILDADO
// =============================
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));

  // SPA fallback (React Router)
  app.get("*", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
  });
}

// =============================
// START SERVER
// =============================
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
