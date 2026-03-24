import { useState, useRef, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
  const [error, setError] = useState<string | null>(null);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [isDark, setIsDark] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [originalFileName, setOriginalFileName] = useState<string | null>(null);

  // ✅ NOVO
  const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const [, setLocation] = useLocation();

  const generateCardsMutation = trpc.card.generateCards.useMutation();

  // ✅ NOVO
  const generateJornalMutation = trpc.card.generateJornal.useMutation();

  useEffect(() => {
    const socket = io({ reconnection: true, reconnectionDelay: 1000, reconnectionDelayMax: 5000, reconnectionAttempts: 5 });
    socket.on("connect", () => { socket.emit("join", sessionId); });
    socket.on("progress", (data: ProgressData) => setProgress(data));
    socket.on("error", (message: string) => { setError(message); setIsProcessing(false); });
    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, [sessionId]);

  const handleFileSelect = (selectedFile: File | null | undefined) => {
    if (!selectedFile) return;
    if (!selectedFile.name.endsWith(".xlsx")) { setError("Por favor, selecione um arquivo .xlsx válido"); return; }
    if (selectedFile.size > 10 * 1024 * 1024) { setError("O arquivo não pode exceder 10MB"); return; }
    setFile(selectedFile);
    setError(null);
    setZipPath(null);
    setProgress(null);
    setOriginalFileName(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files?.[0]);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    handleFileSelect(droppedFile);
  };

  const handleUpload = async () => {
    if (!file) { setError("Por favor, selecione um arquivo"); return; }
    setIsProcessing(true);
    setError(null);
    setProgress(null);
    setZipPath(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadResponse.ok) throw new Error("Erro ao fazer upload");

      const { filePath, fileName } = await uploadResponse.json();

      // ✅ NOVO
      setUploadedFilePath(filePath);

      setOriginalFileName(fileName);

      const result = await generateCardsMutation.mutateAsync({
        filePath,
        sessionId,
        originalFileName: fileName,
      });

      if (result.success) setZipPath(result.zipPath);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao processar arquivo");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!zipPath) return;

    try {
      const response = await fetch(`/api/download?zipPath=${encodeURIComponent(zipPath)}`);
      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = zipPath?.split("/").pop() || "cards.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      setError("Erro ao baixar arquivo");
    }
  };

  // ✅ NOVO
  const handleGerarJornal = async () => {
    if (!uploadedFilePath) return;

    try {
      const result = await generateJornalMutation.mutateAsync({
        filePath: uploadedFilePath,
        sessionId,
      });

      if (result?.jornalPath) {
        window.open(
          `/api/download?zipPath=${encodeURIComponent(result.jornalPath)}`,
          "_blank"
        );
      }
    } catch {
      setError("Erro ao gerar jornal");
    }
  };

  const bgColor = isDark ? "bg-gradient-to-br from-gray-900 via-blue-950 to-purple-950" : "bg-gradient-to-br from-slate-100 via-blue-100 to-purple-100";
  const cardBg = isDark ? "bg-white/10 backdrop-blur-lg border border-white/20" : "bg-white/50 backdrop-blur-lg border border-white/80";
  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSecondary = isDark ? "text-slate-300" : "text-slate-600";
  const borderColor = isDark ? "border-white/20" : "border-slate-300/50";
  const accentColor = isDark ? "text-cyan-300" : "text-blue-600";
  const uploadBg = isDark ? "bg-black/20" : "bg-white/30";
  const uploadBorder = isDragging ? (isDark ? 'border-cyan-300' : 'border-blue-600') : (isDark ? "border-white/30 hover:border-white/50" : "border-blue-300/80 hover:border-blue-400");

  return (
    <div className={`min-h-screen py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-500 ${bgColor}`}>
      <div className="max-w-5xl mx-auto">

        {/* ... seu layout continua igual ... */}

        {!isProcessing && zipPath && (
          <div className="space-y-6">

            <Button onClick={handleDownload}>
              <Download className="w-5 h-5 mr-2" />
              Baixar Cards (ZIP)
            </Button>

            {/* ✅ NOVO BOTÃO */}
            <Button onClick={handleGerarJornal}>
              <FileText className="w-5 h-5 mr-2" />
              Gerar Jornal (PDF)
            </Button>

          </div>
        )}

      </div>
    </div>
  );
}
