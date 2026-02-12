import path from "path";
import fs from "fs";
import puppeteer, { Browser } from "puppeteer";
import archiver from "archiver";
import xlsx from "xlsx";
import { EventEmitter } from "events";

const TEMPLATES_DIR = path.resolve("templates");
const LOGOS_DIR = path.resolve("logos");
const OUTPUT_DIR = path.resolve("output");
const TMP_DIR = path.resolve("tmp");

interface CardData {
  ordem?: string;
  tipo: string;
  logo: string;
  cupom?: string;
  texto?: string;
  valor?: string;
  legal?: string;
  uf?: string;
  segmento?: string;
}

interface GenerationProgress {
  total: number;
  processed: number;
  percentage: number;
  currentCard: string;
}

const upper = (v: string | undefined) => String(v || "").toUpperCase();

function imageToBase64(imagePath: string): string {
  if (!fs.existsSync(imagePath)) return "";
  const ext = path.extname(imagePath).replace(".", "");
  const buffer = fs.readFileSync(imagePath);
  return `data:image/${ext};base64,${buffer.toString("base64")}`;
}

function normalizeType(tipo: string): string {
  if (!tipo) return "";

  let normalized = String(tipo)
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

export class CardGenerator extends EventEmitter {
  private browser: Browser | null = null;

  async initialize() {
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

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

    try {
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

        // LOGO
        let logoBase64 = "";
        if (row.logo) {
          const logoFileName = row.logo.toLowerCase().trim();
          const logoPath = path.join(LOGOS_DIR, logoFileName);
          logoBase64 = imageToBase64(logoPath);
        }

        // REGRA 22 CARACTERES CUPOM
        let cupomTexto = upper(row.cupom);
        if (cupomTexto.length > 22) {
          cupomTexto = "XXXXX";
        }

        html = html.replaceAll("{{LOGO}}", logoBase64);
        html = html.replaceAll("{{TEXTO}}", upper(row.texto));
        html = html.replaceAll("{{VALOR}}", upper(row.valor));
        html = html.replaceAll("{{CUPOM}}", cupomTexto);
        html = html.replaceAll("{{LEGAL}}", upper(row.legal));
        html = html.replaceAll("{{UF}}", upper(row.uf));
        html = html.replaceAll("{{SEGMENTO}}", upper(row.segmento));

        const tmpHtmlPath = path.join(TMP_DIR, `card_${processed + 1}.html`);
        fs.writeFileSync(tmpHtmlPath, html, "utf8");

        const page = await this.browser.newPage();
        await page.setViewport({ width: 1400, height: 2115 });

        await page.goto(`file://${path.resolve(tmpHtmlPath)}`, {
          waitUntil: "networkidle0",
        });

        // 🔥 NOME DO PDF BASEADO NA COLUNA ORDEM + TIPO
        const ordem = String(row.ordem || processed + 1).trim();
        const tipoUpper = tipo.toUpperCase();

        const pdfFileName = `${ordem}_${tipoUpper}.pdf`;
        const pdfPath = path.join(OUTPUT_DIR, pdfFileName);

        await page.pdf({
          path: pdfPath,
          width: "1400px",
          height: "2115px",
          printBackground: true,
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

      const zipPath = path.join(OUTPUT_DIR, "cards.zip");
      await this.createZip(OUTPUT_DIR, zipPath);

      return zipPath;
    } finally {
      this.cleanup();
    }
  }

  private async createZip(sourceDir: string, zipPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      output.on("close", () => resolve());
      archive.on("error", (err: Error) => reject(err));

      archive.pipe(output);

      const files = fs.readdirSync(sourceDir);
      for (const file of files) {
        if (file.endsWith(".pdf")) {
          archive.file(path.join(sourceDir, file), { name: file });
        }
      }

      archive.finalize();
    });
  }

  private cleanup() {
    if (fs.existsSync(TMP_DIR)) {
      const files = fs.readdirSync(TMP_DIR);
      for (const file of files) {
        fs.unlinkSync(path.join(TMP_DIR, file));
      }
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
