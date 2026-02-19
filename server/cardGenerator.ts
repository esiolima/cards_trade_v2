import path from "path";
import fs from "fs";
import puppeteer, { Browser } from "puppeteer";
import archiver from "archiver";
import xlsx from "xlsx";
import { EventEmitter } from "events";

const TEMPLATES_DIR = path.resolve("templates");
const LOGOS_DIR = path.resolve("logos");
const SELOS_DIR = path.resolve("selos");
const OUTPUT_DIR = path.resolve("output");
const TMP_DIR = path.resolve("tmp");

interface CardData {
  ordem?: string;
  tipo: string;
  logo?: string;
  cupom?: string;
  texto?: string;
  valor?: any;
  complemento?: string;
  legal?: string;
  uf?: string;
  segmento?: string;
  selo?: string;
  categoria?: string;
}

interface GenerationProgress {
  total: number;
  processed: number;
  percentage: number;
  currentCard: string;
}

/* =========================
   HELPERS
========================= */

function getTimestampFileName(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");

  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

  return `${date}_${time}.zip`;
}

const upper = (v: any) =>
  String(v ?? "").toUpperCase().trim();

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

function formatPercentage(valor: any): string {
  if (valor === null || valor === undefined || valor === "") return "";

  let num = Number(valor);

  if (!isNaN(num)) {
    if (num > 0 && num < 1) num = num * 100;
    if (Number.isInteger(num)) return String(num);
    return String(Number(num.toFixed(2)));
  }

  return String(valor).replace(/%+/g, "").trim();
}

/* =========================
   CARD GENERATOR
========================= */

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

    const workbook = xlsx.readFile(excelFilePath, { cellDates: false });
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

      /* =========================
         LOGO
      ========================= */
      let logoFileName = row.logo?.trim();
      if (!logoFileName) logoFileName = "blank.png";

      const logoPath = path.join(LOGOS_DIR, logoFileName);
      const logoBase64 = imageToBase64(logoPath);

      /* =========================
         SELO
      ========================= */
      let seloBase64 = "";
      const seloValue = upper(row.selo);

      if (seloValue.includes("NOVA")) {
        const seloPath = path.join(SELOS_DIR, "acaonova.png");
        seloBase64 = imageToBase64(seloPath);
      }

      if (seloValue.includes("RENOVADA")) {
        const seloPath = path.join(SELOS_DIR, "acaorenovada.png");
        seloBase64 = imageToBase64(seloPath);
      }

      /* =========================
         VALOR
      ========================= */
      const valorFinal =
        tipo === "promocao"
          ? upper(row.valor)
          : formatPercentage(row.valor);

      /* =========================
         REPLACE
      ========================= */

      html = html.replaceAll("{{LOGO}}", logoBase64);
      html = html.replaceAll("{{SELO}}", seloBase64);
      html = html.replaceAll("{{TEXTO}}", upper(row.texto));
      html = html.replaceAll("{{VALOR}}", valorFinal);
      html = html.replaceAll("{{COMPLEMENTO}}", upper(row.complemento));
      html = html.replaceAll("{{CUPOM}}", upper(row.cupom));
      html = html.replaceAll("{{LEGAL}}", upper(row.legal));
      html = html.replaceAll("{{UF}}", upper(row.uf));
      html = html.replaceAll("{{SEGMENTO}}", upper(row.segmento));

      /* =========================
         GERAR PDF
      ========================= */

      const tmpHtmlPath = path.join(TMP_DIR, `card_${processed + 1}.html`);
      fs.writeFileSync(tmpHtmlPath, html, "utf8");

      const page = await this.browser.newPage();
      await page.setViewport({ width: 1400, height: 2115 });

      await page.goto(`file://${path.resolve(tmpHtmlPath)}`, {
        waitUntil: "networkidle0",
      });

      const ordem = String(row.ordem || processed + 1).trim();
      const categoriaFinal = upper(row.categoria);

      const pdfName =
        categoriaFinal
          ? `${ordem}_${tipo.toUpperCase()}_${categoriaFinal}.pdf`
          : `${ordem}_${tipo.toUpperCase()}.pdf`;

      const pdfPath = path.join(OUTPUT_DIR, pdfName);

      await page.pdf({
        path: pdfPath,
        width: "1400px",
        height: "2115px",
        printBackground: true,
      });

      await page.close();

      processed++;

      const percentage = Math.round((processed / total) * 100);

      const progressData = {
        total,
        processed,
        percentage,
        currentCard: `${processed}/${total}`,
      };

      if (onProgress) onProgress(progressData);
      this.emit("progress", progressData);
    }

    /* =========================
       ZIP FINAL
    ========================= */

    const zipName = getTimestampFileName();
    const zipPath = path.join(OUTPUT_DIR, zipName);

    await this.createZip(OUTPUT_DIR, zipPath);

    return zipPath;
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

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
