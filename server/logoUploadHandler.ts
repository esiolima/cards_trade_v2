import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const LOGOS_DIR = path.resolve("logos");

// O Token deve ser configurado como variável de ambiente no Railway (GITHUB_TOKEN)
// Se não houver token, a sincronização será ignorada para evitar erros
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_URL = GITHUB_TOKEN ? `https://esiolima:${GITHUB_TOKEN}@github.com/esiolima/cards_trade_v2.git` : null;

// Ensure logos directory exists
if (!fs.existsSync(LOGOS_DIR)) {
  fs.mkdirSync(LOGOS_DIR, { recursive: true });
}

/**
 * Sincroniza as alterações na pasta /logos com o GitHub
 */
async function syncWithGithub(action: string, fileName: string) {
  if (!REPO_URL) {
    console.warn(`[GIT SYNC] Sincronização ignorada: GITHUB_TOKEN não configurado.`);
    return;
  }

  try {
    console.log(`[GIT SYNC] Iniciando sincronização: ${action} ${fileName}`);
    
    // Configurar usuário
    await execAsync('git config user.name "Manus AI"');
    await execAsync('git config user.email "manus@manus.im"');
    
    // Adicionar, commitar e dar push
    await execAsync('git add logos/');
    const commitMsg = `Plataforma: ${action === 'upload' ? 'Adicionado' : 'Removido'} logo ${fileName}`;
    
    // Usar try/catch no commit pois se não houver mudanças o git retorna erro
    try {
      await execAsync(`git commit -m "${commitMsg}"`);
    } catch (e) {
      console.log("[GIT SYNC] Sem mudanças para commitar.");
      return;
    }
    
    // Configurar a URL remota com o token
    await execAsync(`git remote set-url origin ${REPO_URL}`);
    
    // Push para o branch fix-logos
    await execAsync('git push origin fix-logos');
    
    console.log(`[GIT SYNC] Sucesso: ${fileName} sincronizado com GitHub.`);
  } catch (error) {
    console.error(`[GIT SYNC] Erro ao sincronizar com GitHub:`, error);
  }
}

// Configure multer for logo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, LOGOS_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const fileFilter = (
  req: express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
  if (!allowedMimes.includes(file.mimetype)) {
    cb(new Error("Apenas arquivos PNG, JPG, JPEG, WEBP e SVG são permitidos"));
    return;
  }

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
  }, upload.single("file"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo foi enviado" });
    }

    syncWithGithub('upload', req.file.originalname);

    res.json({
      success: true,
      message: `Logo "${req.file.originalname}" enviado com sucesso`,
      filename: req.file.originalname,
      path: `/logos/${req.file.originalname}`,
    });
  });

  app.delete("/api/logos/:name", async (req, res) => {
    const logoName = req.params.name;
    const filePath = path.join(LOGOS_DIR, logoName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Arquivo não encontrado" });
    }

    try {
      fs.unlinkSync(filePath);
      syncWithGithub('delete', logoName);
      res.json({ success: true, message: `Logo "${logoName}" excluída com sucesso` });
    } catch (err) {
      res.status(500).json({ error: "Erro ao excluir o arquivo" });
    }
  });

  app.use("/logos", express.static(LOGOS_DIR));
}
