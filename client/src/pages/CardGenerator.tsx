import { useState, useRef, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle2, AlertCircle, Download, Hourglass, Moon, Sun, ImagePlus } from "lucide-react";

interface ProgressData {
  total: number;
  processed: number;
  percentage: number;
  currentCard: string;
}

export default function CardGenerator() {
  const [file, setFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoMessage, setLogoMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [zipPath, setZipPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [isDark, setIsDark] = useState(true);
  const socketRef = useRef<Socket | null>(null);

  const generateCardsMutation = trpc.card.generateCards.useMutation();

  useEffect(() => {
    const socket = io();

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
    return () => socket.disconnect();
  }, [sessionId]);

  /* =========================
     UPLOAD LOGO
  ========================= */

  const handleLogoUpload = async () => {
    if (!logoFile) return;

    setLogoMessage(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("logo", logoFile);

      const response = await fetch("/api/upload-logo", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error();

      setLogoMessage("Logo enviada com sucesso.");
      setLogoFile(null);
    } catch {
      setError("Erro ao enviar logo.");
    }
  };

  /* =========================
     UPLOAD PLANILHA
  ========================= */

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".xlsx")) {
      setError("Por favor, selecione um arquivo .xlsx válido");
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("O arquivo não pode exceder 10MB");
      return;
    }

    setFile(selectedFile);
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

    const response = await fetch(`/api/download?zipPath=${encodeURIComponent(zipPath)}`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "cards.zip";
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const bgColor = isDark ? "bg-slate-950" : "bg-gradient-to-br from-slate-50 to-blue-50";
  const cardBg = isDark ? "bg-slate-900" : "bg-white";
  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSecondary = isDark ? "text-slate-300" : "text-slate-600";
  const borderColor = isDark ? "border-slate-700" : "border-slate-200";
  const accentColor = isDark ? "text-blue-400" : "text-blue-600";

  return (
    <div className={`min-h-screen py-12 px-4 ${bgColor}`}>
      <div className="max-w-5xl mx-auto">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-16">
          <div className="flex items-center space-x-4">
            <img src="/martins-logo.png" className="h-12" />
            <div>
              <h1 className={`text-3xl font-bold ${textPrimary}`}>
                Gerador de Cards
              </h1>
              <p className={`text-sm ${textSecondary}`}>
                Núcleo de Comunicação e Marketing / Trade Martins
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsDark(!isDark)}
            className="p-3 rounded-full bg-slate-800 text-yellow-400"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        {/* GRID ORIGINAL RESTAURADO */}
        <div className="grid lg:grid-cols-3 gap-8">

          {/* COLUNA ESQUERDA ORIGINAL */}
          <div className="lg:col-span-2">
            <div className={`${cardBg} rounded-2xl p-8 shadow-xl border ${borderColor}`}>

              <div className="space-y-6">

                <h2 className={`text-2xl font-bold ${textPrimary}`}>
                  Transforme suas Planilhas
                </h2>

                <input
                  type="file"
                  accept=".xlsx"
                  onChange={handleFileChange}
                  className="w-full"
                />

                <Button
                  onClick={handleUpload}
                  disabled={!file || isProcessing}
                  className="w-full bg-blue-600 text-white"
                >
                  Processar Planilha
                </Button>

                {error && (
                  <p className="text-red-500 text-sm">{error}</p>
                )}
              </div>
            </div>
          </div>

          {/* COLUNA DIREITA ORIGINAL + BLOCO NOVO */}
          <div className="space-y-4">

            <div className={`${cardBg} rounded-xl p-5 border ${borderColor}`}>
              <h3 className={`font-semibold ${textPrimary}`}>
                Download Fácil
              </h3>
              <p className={`text-sm ${textSecondary}`}>
                Todos os cards em um arquivo ZIP
              </p>
            </div>

            {/* BLOCO ADICIONADO CORRETAMENTE */}
            <div className={`${cardBg} rounded-xl p-5 border ${borderColor}`}>
              <h3 className={`font-semibold ${textPrimary} mb-2`}>
                Upload de Logo do Fornecedor
              </h3>

              <input
                type="file"
                accept="image/*"
                onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                className="w-full text-sm"
              />

              {logoFile && (
                <Button
                  onClick={handleLogoUpload}
                  className="w-full mt-3 bg-blue-600 text-white"
                >
                  Enviar Logo
                </Button>
              )}

              {logoMessage && (
                <p className="text-green-500 text-sm mt-2">
                  {logoMessage}
                </p>
              )}
            </div>

          </div>
        </div>

        <div className="mt-16 pt-8 border-t text-center">
          <p className={`text-sm ${textSecondary}`}>
            Desenvolvido por Esio Lima - Versão 1.0
          </p>
        </div>
      </div>
    </div>
  );
}
