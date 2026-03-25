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
        process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium-browser",
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
    if (!imagePath || !fs.existsSync(imagePath)) return "";
    const ext = path.extname(imagePath).replace(".", "");
    const buffer = fs.readFileSync(imagePath);
    return `data:image/${ext};base64,${buffer.toString("base64")}`;
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

      let logoFile = "blank.png";

      if (row.logo && String(row.logo).trim() !== "") {
        const possibleLogo = String(row.logo).trim();
        const possiblePath = path.join(LOGOS_DIR, possibleLogo);

        if (fs.existsSync(possiblePath)) {
          logoFile = possibleLogo;
        }
      }

      const logoBase64 = this.imageToBase64(
        path.join(LOGOS_DIR, logoFile)
      );

      const seloBase64 = row.selo
        ? this.imageToBase64(
            path.join(
              SELOS_DIR,
              row.selo.toLowerCase() === "nova"
                ? "acaonova.png"
                : row.selo.toLowerCase() === "renovada"
                ? "acaorenovada.png"
                : ""
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

  async generateJornal(excelFilePath: string): Promise<string> {
    if (!this.browser) throw new Error("Browser not initialized");

    const workbook = xlsx.readFile(excelFilePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = xlsx.utils.sheet_to_json(sheet, { defval: "" });

    const groupedRows: { [key: string]: any[] } = {};
    rows.forEach(row => {
      const cat = String(row.categoria || "OUTROS").toUpperCase();
      if (!groupedRows[cat]) groupedRows[cat] = [];
      groupedRows[cat].push(row);
    });

    const vigencia = rows[0]?.VIGÊNCIA || "00/00 a 00/00";
    const gap = 40;
    const cardWidth = 700;
    const pageWidth = (cardWidth * 3) + (gap * 4);

    let html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
      <style>
        @page { margin: 0; size: ${pageWidth}px auto; }
        * { box-sizing: border-box; }
        html, body {
          margin: 0;
          padding: 0;
          background: #5a2d0c;
          font-family: 'Inter', sans-serif;
          width: ${pageWidth}px;
        }
        .header {
          background: #5a2d0c;
          padding: 100px 0;
          text-align: center;
          color: white;
          width: 100%;
        }
        .header-title { font-size: 160px; font-weight: 900; margin: 0; letter-spacing: -5px; }
        .header-date { font-size: 80px; font-weight: 700; margin-top: 40px; color: #f2c94c; }
        .container { padding: ${gap}px; width: 100%; }
        .categoria-section { margin-bottom: 120px; width: 100%; text-align: center; }
        .tarja-categoria {
          background: #1f7a3f;
          color: white;
          padding: 40px 120px;
          border-radius: 999px;
          font-weight: 900;
          font-size: 90px;
          display: inline-block;
          margin-bottom: 80px;
          text-transform: uppercase;
          box-shadow: 0 20px 40px rgba(0,0,0,0.5 );
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(3, ${cardWidth}px);
          gap: ${gap}px;
          justify-content: center;
        }
        .card-wrapper {
          width: ${cardWidth}px;
          height: 1058px;
          background: white;
          border-radius: 40px;
          overflow: hidden;
          box-shadow: 0 30px 60px rgba(0,0,0,0.6);
          position: relative;
          display: flex;
          flex-direction: column;
        }
        .selo-container {
          position: absolute;
          top: 0;
          left: 0;
          width: 125px; 
          z-index: 100;
        }
        .selo-img { width: 100%; height: auto; }
        .footer-legal {
          padding: 100px 60px;
          background: #f8f8f8;
          color: #333;
          font-size: 32px;
          text-align: center;
          font-weight: 700;
          text-transform: uppercase;
          width: 100%;
          line-height: 1.5;
        }
        .card-body-wrapper {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 0;
          text-align: center;
          position: relative;
          flex-grow: 1;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 class="header-title">OFERTAS DA SEMANA</h1>
        <div class="header-date">${vigencia}</div>
      </div>
      <div class="container">
    `;

    for (const [categoria, catRows] of Object.entries(groupedRows)) {
      html += `
        <div class="categoria-section">
          <div class="tarja-categoria">${categoria}</div>
          <div class="grid">
      `;

      for (const row of catRows) {
        const tipo = this.normalizeType(row.tipo);
        const templatePath = path.join(TEMPLATES_DIR, `${tipo}.html`);

        if (fs.existsSync(templatePath)) {
          let cardHtml = fs.readFileSync(templatePath, "utf8");

          let valorFinal = String(row.valor ?? "");
          if (tipo !== "promocao") {
            if (valorFinal.includes("%")) {
              valorFinal = valorFinal.replace(/\./g, ",");
              if (!valorFinal.includes(" %")) {
                valorFinal = valorFinal.replace("%", " %");
              }
            }
          }

          let logoFile = "blank.png";
          if (row.logo && String(row.logo).trim() !== "") {
            const possibleLogo = String(row.logo).trim();
            if (fs.existsSync(path.join(LOGOS_DIR, possibleLogo))) {
              logoFile = possibleLogo;
            }
          }
          const logoBase64 = this.imageToBase64(path.join(LOGOS_DIR, logoFile));

          const seloImg = row.selo
            ? (row.selo.toLowerCase() === "nova" ? "acaonova.png" : row.selo.toLowerCase() === "renovada" ? "acaorenovada.png" : "")
            : "";
          const seloBase64 = seloImg ? this.imageToBase64(path.join(SELOS_DIR, seloImg)) : "";

          const segmentoRaw = row.segmento && String(row.segmento).trim() !== "" ? String(row.segmento).trim() : "";

          // Se for promoção, ignorar o campo cupom
          const cupomFinal = tipo === 'promocao' ? '' : String(row.cupom ?? "");

          let processedCardHtml = cardHtml
            .replaceAll("{{TEXTO}}", String(row.texto ?? ""))
            .replaceAll("{{VALOR}}", valorFinal)
            .replaceAll("{{COMPLEMENTO}}", String(row.complemento ?? ""))
            .replaceAll("{{LEGAL}}", String(row.legal ?? ""))
            .replaceAll("{{SEGMENTO}}", segmentoRaw)
            .replaceAll("{{CUPOM}}", cupomFinal)
            .replaceAll("{{UF}}", row.uf ? `UF: ${row.uf}` : "")
            .replaceAll("{{URN}}", row.urn ? `URN: ${row.urn}` : "")
            .replaceAll("{{LOGO}}", logoBase64)
            .replaceAll("{{SELO}}", "");

          const bodyMatch = processedCardHtml.match(/<body.*?>([\s\S]*?)<\/body>/i);
          const styleMatch = processedCardHtml.match(/<style.*?>([\s\S]*?)<\/style>/i);
          
          let cardBody = bodyMatch ? bodyMatch[1] : processedCardHtml;
          const cardStyle = styleMatch ? styleMatch[1] : "";

          const cardId = `c${Math.random().toString(36).substr(2, 9)}`;
          
          const scopedStyle = cardStyle.replace(/([^{}\r\n,]+)(?=\{)/g, (match) => {
              if (match.includes('@')) return match;
              return match.split(',').map(s => {
                  const t = s.trim();
                  if (!t) return s;
                  if (t === 'body' || t === 'html' || t === '.card') return `#${cardId}`;
                  return `#${cardId} ${t}`;
              }).join(', ');
          });

          // Injetar classes de auto-shrink
          cardBody = cardBody.replace(/class="[^"]*valor[^"]*"/i, (m) => m.replace('class="', `class="auto-shrink-valor-${cardId} `));
          cardBody = cardBody.replace(/class="[^"]*cupom-text[^"]*"/i, (m) => m.replace('class="', `class="auto-shrink-cupom-${cardId} `));
          cardBody = cardBody.replace(/id="cupom-text"/i, `id="cupom-text" class="auto-shrink-cupom-${cardId}"`);

          const logoAjusteStyle = tipo === 'cupom' ? `
            #${cardId} .logo { margin-top: 20px !important; height: 100px !important; }
            #${cardId} .logo img { max-height: 100px !important; }
            #${cardId} .card { justify-content: space-between !important; padding-bottom: 20px !important; }
            #${cardId} .cupom-box { display: flex !important; align-items: center !important; overflow: hidden !important; }
            #${cardId} .cupom-codigo { flex: 1 !important; display: flex !important; align-items: center !important; justify-content: center !important; overflow: hidden !important; width: 510px !important; }
            #${cardId} .auto-shrink-cupom-${cardId} { white-space: nowrap !important; display: inline-block !important; }
          ` : '';

          const promoAjusteStyle = tipo === 'promocao' ? `
            #${cardId} .valor { 
              white-space: normal !important; 
              word-break: break-word !important; 
              line-height: 1.1 !important;
              max-width: 600px !important;
              max-height: 480px !important;
              display: block !important;
              margin: 0 auto !important;
              overflow: hidden !important;
              text-align: center !important;
              width: 600px !important;
            }
          ` : '';

          html += `
            <div class="card-wrapper" id="${cardId}" data-tipo="${tipo}">
              <style>
                #${cardId} { 
                  font-family: 'Inter', sans-serif !important; 
                  background: white; 
                  width: 700px; 
                  height: 1058px; 
                  position: relative; 
                  display: flex; 
                  flex-direction: column; 
                  justify-content: center;
                  align-items: center;
                  padding: 0;
                  overflow: hidden;
                }
                #${cardId} .valor { font-weight: 900 !important; font-family: 'Inter', sans-serif !important; }
                #${cardId} .cupom-text, #${cardId} #cupom-text { font-family: 'Inter', sans-serif !important; }
                ${scopedStyle}
                ${logoAjusteStyle}
                ${promoAjusteStyle}
              </style>
              ${seloBase64 ? `<div class="selo-container"><img src="${seloBase64}" class="selo-img"></div>` : ''}
              <div class="card-body-wrapper">
                ${cardBody}
              </div>
            </div>`;
        }
      }

      html += `
          </div>
        </div>
      `;
    }

    html += `
      </div>
      <div class="footer-legal">
        OFERTAS SUJEITAS A SAÍREM DO AR A QUALQUER MOMENTO SEM AVISO PRÉVIO. CONFIRA A REGRA E MIX PARTICIPANTE DE CADA AÇÃO.
      </div>
      <script>
        // Função de auto-shrink que será chamada pelo Puppeteer
        async function runAutoShrink() {
          const cards = document.querySelectorAll('.card-wrapper');
          for (const card of Array.from(cards)) {
            const cardId = card.id;
            const tipo = card.getAttribute('data-tipo');
            
            // Ajustar Valor
            const valor = card.querySelector('.auto-shrink-valor-' + cardId);
            if (valor) {
              const maxH = tipo === 'promocao' ? 480 : 400;
              const maxW = tipo === 'promocao' ? 600 : 640;
              
              if (tipo === 'promocao') {
                 valor.style.whiteSpace = 'normal';
                 valor.style.width = '600px';
                 valor.style.display = 'block';
                 // Ponto de partida 50% menor para garantir que comece cabendo ou quase cabendo
                 const currentFs = parseInt(window.getComputedStyle(valor).fontSize);
                 valor.style.fontSize = (currentFs * 0.5) + 'px';
              }

              let fs = parseInt(window.getComputedStyle(valor).fontSize);
              let count = 0;
              while ((valor.scrollWidth > maxW || valor.scrollHeight > maxH) && fs > 10 && count < 200) {
                fs -= 1;
                valor.style.setProperty('font-size', fs + 'px', 'important');
                valor.style.lineHeight = '1.0';
                count++;
              }
            }

            // Ajustar Cupom
            if (tipo !== 'promocao') {
              const cupom = card.querySelector('.auto-shrink-cupom-' + cardId);
              if (cupom) {
                let fs = parseInt(window.getComputedStyle(cupom).fontSize);
                const container = cupom.parentElement;
                const maxW = container.clientWidth || 510;
                let count = 0;
                while ((cupom.scrollWidth > maxW) && fs > 10 && count < 100) {
                  fs -= 2;
                  cupom.style.setProperty('font-size', fs + 'px', 'important');
                  count++;
                }
              }
            }
          }
        }
      </script>
    </body>
    </html>
    `;

    const filePath = path.join(OUTPUT_DIR, "jornal.pdf");

    const page = await this.browser.newPage();
    await page.setViewport({ width: pageWidth, height: 10000 });
    
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.evaluateHandle('document.fonts.ready');
    
    // AUTO-SHRINK VIA PUPPETEER (Execução explícita no cliente e espera)
    await page.evaluate(async () => {
      // @ts-ignore
      await runAutoShrink();
      // Delay extra para garantir a renderização
      await new Promise(r => setTimeout(r, 500));
    });

    const totalHeight = await page.evaluate(() => document.documentElement.scrollHeight);

    await page.pdf({
      path: filePath,
      width: `${pageWidth}px`,
      height: `${totalHeight}px`,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });

    await page.close();

    return filePath;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
