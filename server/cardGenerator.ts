import path from "path";
import fs from "fs";
import puppeteer, { Browser } from "puppeteer-core";
import archiver from "archiver";
import xlsx from "xlsx";
import { EventEmitter } from "events";

const BASE_DIR = path.resolve();

const OUTPUT_DIR = path.join(BASE_DIR, "output");
const TMP_DIR = path.join(BASE_DIR, "tmp");
const TEMPLATES_DIR = path.join(BASE_DIR, "templates");
const LOGOS_DIR = path.join(BASE_DIR, "logos");
const SELOS_DIR = path.join(BASE_DIR, "selos");

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

export class CardGenerator extends EventEmitter {
  private browser: Browser | null = null;

  async initialize() {
    if (!fs.existsSync(OUTPUT_DIR))
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    if (!fs.existsSync(TMP_DIR))
      fs.mkdirSync(TMP_DIR, { recursive: true });

    this.browser = await puppeteer.launch({
      executablePath:
        process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: "new",
    });
  }

  normalizeType(tipo: string): string {
    if (!tipo) return "";

    const normalized = String(tipo)
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    if (normalized.includes("promo")) return "promocao";
    if (normalized.includes("cupom")) return "cupom";
    if (normalized.includes("queda")) return "queda";
    if (normalized.includes("bc")) return "bc";

    return "";
  }

  imageToBase64(imagePath: string): string {
    if (!fs.existsSync(imagePath)) return "";
    const ext = path.extname(imagePath).replace(".", "");
    const buffer = fs.readFileSync(imagePath);
    return `data:image/${ext};base64,${buffer.toString("base64")}`;
  }

  async generateCards(excelFilePath: string): Promise<string> {
    if (!this.browser) throw new Error("Generator not initialized");

    const workbook = xlsx.readFile(excelFilePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json<CardData>(sheet, { defval: "" });

    if (rows.length === 0) {
      console.log("PLANILHA VAZIA");
      return "PLANILHA_VAZIA";
    }

    let processed = 0;

    for (const row of rows) {
      const tipo = this.normalizeType(row.tipo);

      if (!tipo) {
        console.log("TIPO NÃO RECONHECIDO:", row.tipo);
        continue;
      }

      const templatePath = path.join(TEMPLATES_DIR, `${tipo}.html`);

      if (!fs.existsSync(templatePath)) {
        console.log("TEMPLATE NÃO ENCONTRADO:", templatePath);
        continue;
      }

      let html = fs.readFileSync(templatePath, "utf8");

      // REGRA DO VALOR
      let valorFinal =
        tipo === "promocao"
          ? String(row.valor ?? "")
          : String(row.valor ?? "").replace(/%/g, "");

      // SELO
      let seloBase64 = "";
      if (row.selo) {
        const selo = String(row.selo).toLowerCase().trim();

        const seloFile =
          selo === "nova"
            ? "acaonova.png"
            : selo === "renovada"
            ? "acaorenovada.png"
            : "";

        if (seloFile) {
          seloBase64 = this.imageToBase64(
            path.join(SELOS_DIR, seloFile)
          );
        }
      }

      // LOGO
      let logoBase64 = "";
      if (row.logo) {
        logoBase64 = this.imageToBase64(
          path.join(LOGOS_DIR, row.logo)
        );
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

      await page.setViewport({ width: 700, height: 1058 });

      await page.goto(`file://${tmpHtmlPath}`, {
        waitUntil: "networkidle0",
      });

      const pdfPath = path.join(
        OUTPUT_DIR,
        `card_${processed + 1}.pdf`
      );

      await page.pdf({
        path: pdfPath,
        width: "700px",
        height: "1058px",
        printBackground: true,
        margin: { top: 0, bottom: 0, left: 0, right: 0 },
      });

      await page.close();

      console.log("CARD GERADO:", pdfPath);

      processed++;
    }

    if (processed === 0) {
      console.log("NENHUM CARD FOI GERADO");
      return "SEM_CARDS";
    }

    return "OK";
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
