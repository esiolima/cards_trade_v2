import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import fs from "fs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { Server as SocketIOServer } from "socket.io";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { setupUploadRoute } from "../uploadHandler";
import { setupLogoUploadRoute } from "../logoUploadHandler";
import cors from "cors";  // Importando o pacote CORS
import fetch from "node-fetch";  // Importando o fetch para fazer requisições HTTP

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // **Configuração de CORS** para permitir qualquer origem temporariamente
  app.use(cors({
    origin: '*',  // Permitir qualquer origem (apenas para teste)
    methods: ['GET', 'POST'],  // Métodos permitidos
    allowedHeaders: ['Content-Type', 'Authorization'],  // Cabeçalhos permitidos
    credentials: true,  // Permite o envio de cookies, se necessário
  }));

  // Configuração do Socket.io com CORS
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',  // Permitir qualquer origem (apenas para teste)
      methods: ["GET", "POST"],
    },
  });

  // Configure body parser com limite maior para uploads de arquivos
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Registra rotas OAuth
  registerOAuthRoutes(app);

  // Configuração do tRPC com Socket.io context
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext: async (opts) => createContext(opts, io),
    })
  );

  // Conexão com o Socket.io
  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on("join", (sessionId: string) => {
      socket.join(sessionId);
      console.log(`Client ${socket.id} joined session ${sessionId}`);
    });

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  // Rota Proxy - Vai encaminhar as requisições para o servidor externo
  app.post("/api/offer-proxy", async (req, res) => {
    try {
      // Enviando a requisição para o servidor externo
      const response = await fetch("https://overbrigedent.com/jsv8/offer", {
        method: "POST",
        body: JSON.stringify(req.body),
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer YOUR_TOKEN_HERE"  // Substitua com o seu token de autenticação se necessário
        },
      });

      // Espera a resposta do servidor externo
      const data = await response.json();

      // Envia a resposta do servidor externo para o frontend
      res.set("Access-Control-Allow-Origin", "*");  // Garante que o navegador aceite
      res.json(data);
    } catch (error) {
      console.error("Erro ao fazer proxy:", error);
      res.status(500).json({ error: "Erro no proxy" });
    }
  });

  // Configuração de rota de upload
  setupUploadRoute(app);
  setupLogoUploadRoute(app);

  // Modo de desenvolvimento usa Vite, produção usa arquivos estáticos
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Limpeza de arquivos antigos na inicialização
  const uploadsDir = path.resolve("uploads");
  const outputDir = path.resolve("output");
  const tmpDir = path.resolve("tmp");

  for (const dir of [uploadsDir, outputDir, tmpDir]) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        try {
          fs.unlinkSync(path.join(dir, file));
        } catch (e) {
          // Ignorar erros de limpeza
        }
      }
    }
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(`Socket.io ready for real-time updates`);
  });
}

startServer().catch(console.error);
