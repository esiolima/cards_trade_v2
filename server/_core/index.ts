import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import multer from "multer";
import { CardGenerator } from "../cardGenerator";
import net from "net";
import path from "path";
import fs from "fs";
import { Server as SocketIOServer } from "socket.io";

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
  }));

  const upload = multer({ dest: "uploads/" });
  const generator = new CardGenerator();
  await generator.initialize();

  // Rota de API tradicional para processamento de planilha
  app.post("/api/process-excel", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado" });

      const uploadsDir = path.join(process.cwd(), "uploads_excel");
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

      const permanentPath = path.join(uploadsDir, "current_planilha.xlsx");
      fs.copyFileSync(req.file.path, permanentPath);

      const cards = await generator.processExcel(req.file.path);
      fs.unlinkSync(req.file.path);
      
      res.json({ cards });
    } catch (error: any) {
      console.error("Erro no processamento da planilha:", error);
      res.status(500).json({ error: error.message || "Erro interno no servidor" });
    }
  });

  // Rota para download do ZIP
  app.get("/api/download-zip", async (req, res) => {
    try {
      const zipPath = await generator.generateZip();
      res.download(zipPath, "cards_individuais.zip");
    } catch (error: any) {
      console.error("Erro ao gerar ZIP:", error);
      res.status(500).json({ error: "Erro ao gerar ZIP" });
    }
  });

  // Rota para gerar o jornal consolidado
  app.post("/api/generate-jornal", upload.single("header"), async (req, res) => {
    try {
      const { backgroundColor, categoryBoxColor, footerText } = req.body;
      const headerPath = req.file ? req.file.path : undefined;

      const pdfPath = await generator.generateJornal({
        headerPath,
        backgroundColor,
        categoryBoxColor,
        footerText
      });

      res.download(pdfPath, "jornal_ofertas.pdf", (err) => {
        if (headerPath && fs.existsSync(headerPath)) fs.unlinkSync(headerPath);
      });
    } catch (error: any) {
      console.error("Erro na geração do jornal:", error);
      res.status(500).json({ error: error.message || "Erro interno no servidor" });
    }
  });

  const io = new SocketIOServer(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    path: "/socket.io"
  });

  generator.on("progress", (data) => {
    io.emit("processProgress", data);
  });

  if (process.env.NODE_ENV === "production") {
    const clientDistPath = path.join(process.cwd(), "dist", "client");
    app.use(express.static(clientDistPath));
    app.get("*", (req, res) => {
      if (req.path.startsWith("/api/")) return res.status(404).end();
      res.sendFile(path.join(clientDistPath, "index.html"));
    });
  }

  const port = Number(process.env.PORT) || 8080;
  server.listen(port, "0.0.0.0", () => {
    console.log(`Servidor rodando na porta ${port}`);
  });
}

startServer().catch(console.error);
