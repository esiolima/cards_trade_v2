import { useState, useRef, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Upload, CheckCircle2, AlertCircle, Download, Hourglass, Moon, Sun } from "lucide-react";

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
  const socketRef = useRef<Socket | null>(null);

  const generateCardsMutation = trpc.card.generateCards.useMutation();

  useEffect(() => {
    const socket = io({
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socket.on("connect", () => {
      socket.emit("join", sessionId);
    });

    socket.on("progress", (data: ProgressData) => {
      setProgress(data);
    });

    socket.on("error", (message: string) => {
      setError(message);
      setIsProcessing(false);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [sessionId]);

  const validateFile = (selectedFile: File) => {
    if (!selectedFile.name.endsWith(".xlsx")) {
      setError("Por favor, selecione um arquivo .xlsx válido");
      return false;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("O arquivo não pode exceder 10MB");
      return false;
    }

    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    if (!validateFile(selectedFile)) return;

    setFile(selectedFile);
    setError(null);
    setZipPath(null);
    setProgress(null);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (!droppedFile) return;
    if (!validateFile(droppedFile)) return;

    setFile(droppedFile);
    setError(null);
    setZipPath(null);
    setProgress(null);
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Por favor, selecione um arquivo");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProgress(null);
    setZipPath(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("Erro ao fazer upload do arquivo");
      }

      const { filePath } = await uploadResponse.json();

      const result = await generateCardsMutation.mutateAsync({
        filePath,
        sessionId,
      });

      if (result.success) {
        setZipPath(result.zipPath);
      }
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
      if (!response.ok) throw new Error("Erro ao baixar arquivo");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "cards.zip";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao baixar arquivo");
    }
  };

  const bgColor = isDark ? "bg-slate-950" : "bg-gradient-to-br from-slate-50 to-blue-50";
  const cardBg = isDark ? "bg-slate-900" : "bg-white";
  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSecondary = isDark ? "text-slate-300" : "text-slate-600";
  const borderColor = isDark ? "border-slate-700" : "border-slate-200";
  const accentColor = isDark ? "text-blue-400" : "text-blue-600";
  const uploadBg = isDark ? "bg-slate-800" : "bg-blue-50";
  const uploadBorder = isDark ? "border-slate-600 hover:border-slate-500" : "border-blue-300 hover:border-blue-400";

  return (
    <div className={`min-h-screen py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300 ${bgColor}`}>
      <div className="max-w-5xl mx-auto">

        <div className="flex items-center justify-between mb-16">
          <div className="flex items-center space-x-4">
            <img src="/martins-logo.png" alt="Martins" className="h-12 object-contain" />
            <div>
              <h1 className={`text-3xl font-bold ${textPrimary}`}>
                Gerador de Cards
              </h1>
              <p className={`text-sm ${textSecondary}`}>Powered by Núcleo de Marketing</p>
            </div>
          </div>
          
          <button
            onClick={() => setIsDark(!isDark)}
            className={`p-3 rounded-full transition-all duration-300 ${
              isDark 
                ? "bg-slate-800 hover:bg-slate-700 text-yellow-400" 
                : "bg-slate-200 hover:bg-slate-300 text-slate-700"
            }`}
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className={`${cardBg} rounded-2xl p-8 shadow-xl border ${borderColor} transition-all duration-300`}>

              {!isProcessing && !zipPath && (
                <div className="space-y-6">

                  <div>
                    <h2 className={`text-2xl font-bold ${textPrimary} mb-2`}>
                      Transforme suas Planilhas
                    </h2>
                    <p className={textSecondary}>
                      Converta dados Excel em cards PDF profissionais em segundos
                    </p>
                  </div>

                  <div
                    onClick={() => document.getElementById("file-input")?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed ${uploadBorder} rounded-xl p-12 text-center cursor-pointer transition-all duration-300 ${uploadBg} ${
                      isDragging ? "ring-4 ring-blue-500/30 scale-[1.02]" : ""
                    }`}
                  >
                    <div className="flex flex-col items-center space-y-3">
                      <div className={`p-4 rounded-full ${isDark ? "bg-blue-900/30" : "bg-blue-100"}`}>
                        <Upload className={`w-8 h-8 ${accentColor} ${isDragging ? "animate-bounce" : ""}`} />
                      </div>
                      <div>
                        <p className={`font-semibold ${textPrimary}`}>
                          {isDragging ? "Solte o arquivo aqui" : "Clique ou arraste seu arquivo"}
                        </p>
                        <p className={`text-sm ${textSecondary} mt-1`}>
                          Apenas arquivos .xlsx (máximo 10MB)
                        </p>
                      </div>
                    </div>
                    <input
                      id="file-input"
                      type="file"
                      accept=".xlsx"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>

                  {/* resto do layout permanece igual */}

                  {file && (
                    <div className={`${isDark ? "bg-slate-800" : "bg-blue-50"} rounded-lg p-4 flex items-center justify-between border ${borderColor}`}>
                      <div className="flex items-center space-x-3">
                        <CheckCircle2 className={`w-5 h-5 ${accentColor}`} />
                        <div>
                          <p className={`font-medium ${textPrimary}`}>{file.name}</p>
                          <p className={`text-sm ${textSecondary}`}>
                            {(file.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFile(null);
                          setError(null);
                        }}
                        className={textSecondary}
                      >
                        Remover
                      </Button>
                    </div>
                  )}

                  {error && (
                    <div className={`${isDark ? "bg-red-900/20 border-red-800" : "bg-red-50 border-red-200"} border rounded-lg p-4`}>
                      {error}
                    </div>
                  )}

                  <Button
                    onClick={handleUpload}
                    disabled={!file || isProcessing}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-6 text-lg font-semibold rounded-lg transition-all duration-300 disabled:opacity-50"
                  >
                    Processar Planilha
                  </Button>

                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
