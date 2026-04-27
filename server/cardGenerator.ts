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
      headless: true,
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
    if (normalized.includes("cashback")) return "cashback";
    if (normalized === "bc") return "bc";

    return "";
  }

  private sanitizeFileName(value: string): string {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .toLowerCase()
      .trim();
  }

  private getUniqueFilePath(filePath: string): string {
    if (!fs.existsSync(filePath)) return filePath;

    const ext = path.extname(filePath);
    const name = path.basename(filePath, ext);
    const dir = path.dirname(filePath);

    let counter = 2;
    let newPath = "";

    do {
      newPath = path.join(dir, `${name}_v${counter}${ext}`);
      counter++;
    } while (fs.existsSync(newPath));

    return newPath;
  }

  private getDateStamp(): string {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const aa = String(now.getFullYear()).slice(-2);
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    return `${dd}_${mm}_${aa}-${hh}_${min}_${ss}`;
  }

  imageToBase64(imagePath: string): string {
    if (!imagePath || !fs.existsSync(imagePath) || fs.lstatSync(imagePath).isDirectory()) return "";
    const ext = path.extname(imagePath).replace(".", "").toLowerCase();
    const buffer = fs.readFileSync(imagePath);
    
    let mimeType = `image/${ext}`;
    if (ext === "svg") mimeType = "image/svg+xml";
    if (ext === "jpg") mimeType = "image/jpeg";

    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  }

  private findLogoFile(logoName: string): string {
    if (!logoName || String(logoName).trim() === "") return "blank.png";

    const cleanName = String(logoName).trim();
    const extensions = [".png", ".jpg", ".jpeg", ".webp", ".svg"];

    if (fs.existsSync(path.join(LOGOS_DIR, cleanName))) {
      return cleanName;
    }

    const searchName = cleanName.toLowerCase();
    const filesInLogos = fs.readdirSync(LOGOS_DIR);

    for (const ext of extensions) {
      const target = searchName.endsWith(ext) ? searchName : searchName + ext;
      const found = filesInLogos.find(f => f.toLowerCase() === target);
      if (found) return found;
    }

    const validFiles = filesInLogos.filter(f => {
      const ext = path.extname(f).toLowerCase();
      return extensions.includes(ext);
    });

    const prefixMatch = validFiles.find(f => {
      const baseName = path.parse(f).name.toLowerCase();
      return baseName.startsWith(searchName);
    });

    if (prefixMatch) return prefixMatch;

    return "blank.png";
  }

  async generateCards(
    excelFilePath: string,
    originalFileName?: string
  ): Promise<string> {
    if (!this.browser) throw new Error("Browser not initialized");

    fs.readdirSync(OUTPUT_DIR).forEach((file) => {
      if (file.endsWith(".pdf") || file.endsWith(".zip")) {
        fs.unlinkSync(path.join(OUTPUT_DIR, file));
      }
    });

    const workbook = xlsx.readFile(excelFilePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = xlsx.utils.sheet_to_json(sheet, { defval: "" });

    const total = rows.length;
    let processed = 0;

    for (const row of rows) {
      const tipo = this.normalizeType(row.tipo);
      if (!tipo) continue;

      const templatePath = path.join(TEMPLATES_DIR, `${tipo}.html`);
      if (!fs.existsSync(templatePath)) continue;

      let html = fs.readFileSync(templatePath, "utf8");

      let valorFinal = String(row.valor ?? "");
      if (tipo !== "promocao") {
        valorFinal = valorFinal.replace(/%/g, "").trim();
      }

      const logoFile = this.findLogoFile(row.logo);

      const logoBase64 = this.imageToBase64(
        path.join(LOGOS_DIR, logoFile)
      );

      const seloRaw = String(row.selo ?? "").trim().toLowerCase();
      const seloBase64 = seloRaw
        ? this.imageToBase64(
            path.join(
              SELOS_DIR,
              seloRaw === "nova"
                ? "acaonova.png"
                : seloRaw === "renovada"
                ? "acaorenovada.png"
                : "blank.png"
            )
          )
        : "";

      const segmentoRaw =
        row.segmento && String(row.segmento).trim() !== ""
          ? String(row.segmento).trim()
          : "";

      html = html
        .replaceAll("{{TEXTO}}", String(row.texto ?? ""))
        .replaceAll("{{VALOR}}", valorFinal)
        .replaceAll("{{COMPLEMENTO}}", String(row.complemento ?? ""))
        .replaceAll("{{LEGAL}}", String(row.legal ?? ""))
        .replaceAll("{{SEGMENTO}}", segmentoRaw)
        .replaceAll("{{CUPOM}}", String(row.cupom ?? ""))
        .replaceAll("{{UF}}", row.uf ? `UF: ${row.uf}` : "")
        .replaceAll("{{URN}}", row.urn ? `URN: ${row.urn}` : "")
        .replaceAll("{{LOGO}}", logoBase64)
        .replaceAll("{{SELO}}", seloBase64);

      const tmpHtmlPath = path.join(TMP_DIR, `card_${processed + 1}.html`);
      fs.writeFileSync(tmpHtmlPath, html);

      const page = await this.browser.newPage();
      await page.setViewport({ width: 700, height: 1058 });

      await page.goto(`file://${tmpHtmlPath}`, {
        waitUntil: "networkidle0",
      });

      const ordemFinal =
        row.ordem && String(row.ordem).trim() !== ""
          ? String(row.ordem).trim()
          : String(processed + 1);

      const categoriaRaw =
        row.categoria && String(row.categoria).trim() !== ""
          ? String(row.categoria).trim()
          : "sem-categoria";

      const categoria = this.sanitizeFileName(categoriaRaw);

      const pdfName = `${ordemFinal}_${tipo}_${categoria}.pdf`;
      const pdfPath = path.join(OUTPUT_DIR, pdfName);

      await page.pdf({
        path: pdfPath,
        width: "700px",
        height: "1058px",
        printBackground: true,
        margin: {
          top: "0px",
          right: "0px",
          bottom: "0px",
          left: "0px",
        },
      });

      await page.close();

      processed++;

      this.emit("progress", {
        processed,
        total,
        percentage: Math.round((processed / total) * 100),
      });
    }

    const baseName = originalFileName
      ? path.parse(originalFileName).name
      : path.parse(excelFilePath).name;

    const date = this.getDateStamp();
    let zipName = `${baseName}_${date}.zip`;

    let zipPath = path.join(OUTPUT_DIR, zipName);
    zipPath = this.getUniqueFilePath(zipPath);

    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.pipe(output);

    fs.readdirSync(OUTPUT_DIR).forEach((file) => {
      if (file.endsWith(".pdf")) {
        archive.file(path.join(OUTPUT_DIR, file), { name: file });
      }
    });

    await archive.finalize();

    return zipPath;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
