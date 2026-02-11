import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { CardGenerator } from "./cardGenerator";
import path from "path";
import fs from "fs";
import xlsx from "xlsx";

describe("CardGenerator", () => {
  let generator: CardGenerator;

  beforeAll(async () => {
    generator = new CardGenerator();
    await generator.initialize();
  });

  afterAll(async () => {
    await generator.close();
  });

  it("should initialize without errors", async () => {
    expect(generator).toBeDefined();
  });

  it("should create output directory", () => {
    const outputDir = path.resolve("output");
    expect(fs.existsSync(outputDir)).toBe(true);
  });

  it("should create tmp directory", () => {
    const tmpDir = path.resolve("tmp");
    expect(fs.existsSync(tmpDir)).toBe(true);
  });

  it("should generate cards from valid Excel file", async () => {
    // Create a test Excel file
    const testData = [
      {
        tipo: "CUPOM",
        logo: "intelbras.png",
        cupom: "TEST123",
        texto: "Test promotion",
        valor: "50",
        legal: "Test legal",
        uf: "SP",
        segmento: "TODOS",
      },
    ];

    const ws = xlsx.utils.json_to_sheet(testData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Sheet1");

    const testFilePath = path.resolve("test_input.xlsx");
    xlsx.writeFile(wb, testFilePath);

    try {
      const zipPath = await generator.generateCards(testFilePath);

      expect(fs.existsSync(zipPath)).toBe(true);
      expect(zipPath.endsWith(".zip")).toBe(true);

      // Cleanup
      fs.unlinkSync(testFilePath);
    } catch (error) {
      // Cleanup on error
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
      throw error;
    }
  });

  it("should emit progress events", async () => {
    const testData = [
      {
        tipo: "PROMO",
        logo: "dove.png",
        texto: "Test promo 1",
        valor: "30",
        legal: "Test legal",
        uf: "RJ",
        segmento: "TODOS",
      },
      {
        tipo: "QUEDA",
        logo: "alpargatas.png",
        texto: "Test queda",
        valor: "20",
        legal: "Test legal",
        uf: "MG",
        segmento: "TODOS",
      },
    ];

    const ws = xlsx.utils.json_to_sheet(testData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Sheet1");

    const testFilePath = path.resolve("test_progress.xlsx");
    xlsx.writeFile(wb, testFilePath);

    try {
      const progressEvents: any[] = [];

      generator.on("progress", (progress) => {
        progressEvents.push(progress);
      });

      await generator.generateCards(testFilePath);

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0]).toHaveProperty("total");
      expect(progressEvents[0]).toHaveProperty("processed");
      expect(progressEvents[0]).toHaveProperty("percentage");

      // Cleanup
      fs.unlinkSync(testFilePath);
    } catch (error) {
      // Cleanup on error
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
      throw error;
    }
  });
});
