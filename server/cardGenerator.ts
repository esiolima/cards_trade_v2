import path from "path";
import fs from "fs";
import puppeteer, { Browser } from "puppeteer";
import archiver from "archiver";
import xlsx from "xlsx";
import { EventEmitter } from "events";

const OUTPUT_DIR = path.join(process.cwd(), "output");
const TMP_DIR = path.join(process.cwd(), "tmp");
const TEMPLATES_DIR = path.join(process.cwd(), "templates");
const LOGOS_DIR = path.join(process.cwd(), "logos");
const SELOS_DIR = path.join(process.cwd(), "selos");

interface CardData {
  ordem?: string;
  tipo: string;
  texto?: string;
  valor?: any;
  complemento?: string;
  legal?: string;
  categoria?: string;
  logo?: string;
  segmento?: string;
  cupom?: string;
  selo?: string;
  uf?: string;
  urn?: string;
}

interface GenerationProgress {
  total: number;
  processed: number;
  percentage: number;
  currentCard: string;
}

function getTimestampFileName(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(
    now.getSeconds()
  )}.zip`;
}

function normalizeType(tipo: string): string {
  if (!tipo) return "";

  const normalized = String(tipo)
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (normalized.includes("promo")) return "promocao";
  if (normalized.includes("cupom")) return "cupom";
  if (normalized.includes("queda")) return "queda";
  if (normalized === "bc") return "bc";

  return "";
}

function sanitizePercentage(valor: any): string {
  return String(valor ?? "").replace(/\D/g, "");
}

function imageToBase64(imagePath: string): string {
  if (!fs.existsSync(imagePath)) return "";
  const ext = path.extname(imagePath).replace(".", "");
  const buffer = fs.readFileSync(imagePath);
  return `data:image/${ext};base64,${buffer.toString("base64")}`;
}

export class CardGenerator extends EventEmitter {
  private browser: Browser | null = null;

  async initialize() {
    if (!fs.existsSync(OUTPUT_DIR))
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    if (!fs.existsSync(TMP_DIR))
      fs.mkdirSync(TMP_DIR, { recursive: true });

    this.browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: true,
    });
  }

  async generateCards(
    excelFilePath: string,
    onProgress?: (progress: GenerationProgress) => void
  ): Promise<string> {
    if (!this.browser) throw new Error("Generator not initialized");

    // limpa output
    const oldFiles = fs.readdirSync(OUTPUT_DIR);
    for (const file of oldFiles) {
      fs.unlinkSync(path.join(OUTPUT_DIR, file));
    }

    const workbook = xlsx.readFile(excelFilePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json<CardData>(sheet, { defval: "" });

    const validRows = rows.filter((row) => {
      const tipo = normalizeType(row.tipo);
      return tipo && fs.existsSync(path.join(TEMPLATES_DIR, `${tipo}.html`));
    });

    const total = validRows.length;
    let processed = 0;

    for (const row of validRows) {
      const tipo = normalizeType(row.tipo);
      const templatePath = path.join(TEMPLATES_DIR, `${tipo}.html`);
      let html = fs.readFileSync(templatePath, "utf8");

      let valorFinal =
        tipo === "promocao"
          ? String(row.valor ?? "")
          : sanitizePercentage(row.valor);

      // SEL0 CORRIGIDO
      let seloBase64 = "";

      if (row.selo) {
        const seloNormalized = String(row.selo)
          .toLowerCase()
          .trim()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");

        let seloFile = "";

        if (seloNormalized === "nova") {
          seloFile = "acaonova.png";
        } else if (seloNormalized === "renovada") {
          seloFile = "acaorenovada.png";
        }

        if (seloFile) {
          seloBase64 = imageToBase64(path.join(SELOS_DIR, seloFile));
        }
      }

      let logoBase64 = "";
      if (row.logo) {
        logoBase64 = imageToBase64(path.join(LOGOS_DIR, row.logo));
      }

      const ufFinal = row.uf ? `UF: ${row.uf}` : "";
      const urnFinal = row.urn ? `URN: ${row.urn}` : "";

      html = html
        .replaceAll("{{TEXTO}}", String(row.texto ?? ""))
        .replaceAll("{{VALOR}}", valorFinal)
        .replaceAll("{{COMPLEMENTO}}", String(row.complemento ?? ""))
        .replaceAll("{{LEGAL}}", String(row.legal ?? ""))
        .replaceAll("{{SEGMENTO}}", String(row.segmento ?? ""))
        .replaceAll("{{CUPOM}}", String(row.cupom ?? ""))
        .replaceAll("{{UF}}", ufFinal)
        .replaceAll("{{URN}}", urnFinal)
        .replaceAll("{{SELO}}", seloBase64)
        .replaceAll("{{LOGO}}", logoBase64);

      const tmpHtmlPath = path.join(TMP_DIR, `card_${processed + 1}.html`);
      fs.writeFileSync(tmpHtmlPath, html);

      const page = await this.browser.newPage();

      await page.setViewport({
        width: 700,
        height: 1058,
        deviceScaleFactor: 1,
      });

      await page.goto(`file://${tmpHtmlPath}`, {
        waitUntil: "networkidle0",
      });

      // AUTO-FIT EXECUTADO DIRETAMENTE VIA PUPPETEER
      await page.evaluate(() => {
        const container = document.getElementById("percentual");
        const numero = document.getElementById("numero");
        const percent = document.getElementById("percent");

        if (!container || !numero || !percent) return;

        let fontSize = 240;
        numero.style.fontSize = fontSize + "px";
        percent.style.fontSize = fontSize + "px";

        while (container.scrollWidth > container.clientWidth && fontSize > 60) {
          fontSize -= 2;
          numero.style.fontSize = fontSize + "px";
          percent.style.fontSize = fontSize + "px";
        }
      });

      const ordem = String(row.ordem || processed + 1).trim();
      const categoria = String(row.categoria || "SEM_CATEGORIA")
        .toUpperCase()
        .replace(/\s+/g, "_");

      const pdfName = `${ordem}_${tipo.toUpperCase()}_${categoria}.pdf`;
      const pdfPath = path.join(OUTPUT_DIR, pdfName);

      await page.pdf({
        path: pdfPath,
        width: "700px",
        height: "1058px",
        printBackground: true,
        margin: { top: 0, bottom: 0, left: 0, right: 0 },
      });

      await page.close();

      processed++;

      const percentage = Math.round((processed / total) * 100);

      if (onProgress) {
        onProgress({
          total,
          processed,
          percentage,
          currentCard: `${processed}/${total}`,
        });
      }

      this.emit("progress", {
        total,
        processed,
        percentage,
        currentCard: `${processed}/${total}`,
      });
    }

    const zipName = getTimestampFileName();
    const zipPath = path.join(OUTPUT_DIR, zipName);

    await this.createZip(zipPath);

    return zipPath;
  }

  private async createZip(zipPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      output.on("close", () => resolve());
      archive.on("error", reject);

      archive.pipe(output);

      const files = fs.readdirSync(OUTPUT_DIR);

      for (const file of files) {
        if (file.endsWith(".pdf")) {
          archive.file(path.join(OUTPUT_DIR, file), { name: file });
        }
      }

      archive.finalize();
    });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
