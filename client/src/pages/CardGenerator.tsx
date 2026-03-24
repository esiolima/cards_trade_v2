import { useState, useRef, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle2, AlertCircle, Download, Hourglass, Moon, Sun, Image, FileText } from "lucide-react";

interface ProgressData {
  total: number;
  processed: number;
  percentage: number;
  currentCard: string;
}

export default function CardGenerator() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [zipPath, setZipPath] = useState<string | null>(null);
  const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [isDark, setIsDark] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [originalFileName, setOriginalFileName] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [, setLocation] = useLocation();

  const generateCardsMutation = trpc.card.generateCards.useMutation();
  const generateJornalMutation = trpc.card.generateJornal.useMutation();

  useEffect(() => {
    const socket = io();
    socket.on("connect", () => socket.emit("join", sessionId));
    socket.on("progress", (data: ProgressData) => setProgress(data));
    socket.on("error", (message: string) => {
      setError(message);
      setIsProcessing(false);
    });
    socketRef.current = socket;
    return () => socket.disconnect();
  }, [sessionId]);

  const handleFileSelect = (selectedFile: File | null | undefined) => {
    if (!selectedFile) return;
    if (!selectedFile.name.endsWith(".xlsx")) {
      setError("Por favor, selecione um arquivo .xlsx válido");
      return;
    }
    setFile(selectedFile);
    setError(null);
    setZipPath(null);
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const { filePath, fileName } = await uploadResponse.json();

      setUploadedFilePath(filePath);
      setOriginalFileName(fileName);

      const result = await generateCardsMutation.mutateAsync({
        filePath,
        sessionId,
        originalFileName: fileName,
      });

      setZipPath(result.zipPath);
    } catch {
      setError("Erro ao processar");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!zipPath) return;

    const response = await fetch(`/api/download?zipPath=${encodeURIComponent(zipPath)}`);
    const blob = await response.blob();

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cards.zip";
    a.click();
  };

  const handleGerarJornal = async () => {
    if (!uploadedFilePath) return;

    const result = await generateJornalMutation.mutateAsync({
      filePath: uploadedFilePath,
      sessionId,
    });

    const response = await fetch(`/api/download?zipPath=${encodeURIComponent(result.jornalPath)}`);
    const blob = await response.blob();

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "jornal.pdf";
    a.click();
  };

  return (
    <div className="p-10 text-center">
      <h1 className="text-2xl font-bold mb-6">teste</h1>

      <input type="file" onChange={(e) => handleFileSelect(e.target.files?.[0])} />

      <br /><br />

      <button onClick={handleUpload}>
        Processar Planilha
      </button>

      <br /><br />

      {zipPath && (
        <>
          <button onClick={handleDownload}>
            Baixar Cards (ZIP)
          </button>

          <br /><br />

          <button onClick={handleGerarJornal}>
            📄 Gerar Jornal
          </button>
        </>
      )}

      {error && <p>{error}</p>}
    </div>
  );
}
