
import React, { useState, useEffect, useCallback } from 'react';
import { Upload, X, Copy, Check, Loader2, Wand2, Image as ImageIcon, AlertCircle, Sparkles, Download, RefreshCw, LayoutTemplate, Edit3, RotateCcw, Package, Zap, ScanSearch, ShieldCheck, Link as LinkIcon, Key, ExternalLink, Info } from 'lucide-react';
import Header from './components/Header';
import { analyzeImageToPrompt, generateImageFromPrompt, detectProductFromImage } from './services/geminiService';
import { AnalysisState, PromptAnalysis } from './types';

type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";

const App: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDraggingScene, setIsDraggingScene] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  
  const [productFile, setProductFile] = useState<File | null>(null);
  const [productPreviewUrl, setProductPreviewUrl] = useState<string | null>(null);
  const [productName, setProductName] = useState<string>("");
  const [isDetecting, setIsDetecting] = useState(false);

  const [selectedRatio, setSelectedRatio] = useState<AspectRatio>("1:1");
  const [editedPrompt, setEditedPrompt] = useState<string>("");
  const [hasKey, setHasKey] = useState<boolean>(false);
  
  const [analysis, setAnalysis] = useState<AnalysisState>({
    isLoading: false,
    error: null,
    result: null,
  });
  
  const [generatedImage, setGeneratedImage] = useState<{
    url: string | null;
    isLoading: boolean;
    error: string | null;
  }>({
    url: null,
    isLoading: false,
    error: null
  });

  const [copied, setCopied] = useState(false);

  const checkKeyStatus = async () => {
    if (window.aistudio?.hasSelectedApiKey) {
      const isSelected = await window.aistudio.hasSelectedApiKey();
      setHasKey(isSelected);
      return isSelected;
    }
    return false;
  };

  useEffect(() => {
    checkKeyStatus();
    // Cek berkala jika variabel lingkungan berubah
    const interval = setInterval(checkKeyStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleKeySelect = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      await checkKeyStatus();
    }
  };

  const processSceneFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setAnalysis(prev => ({ ...prev, error: "Harap unggah file gambar yang valid." }));
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setAnalysis({ isLoading: false, error: null, result: null });
    setGeneratedImage({ url: null, isLoading: false, error: null });
  }, [previewUrl]);

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return;
    setAnalysis(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await fetch(urlInput);
      const blob = await response.blob();
      const filename = urlInput.split('/').pop() || 'downloaded-scene.png';
      const file = new File([blob], filename, { type: blob.type });
      processSceneFile(file);
      setUrlInput("");
    } catch (err) {
      setAnalysis(prev => ({ ...prev, isLoading: false, error: "Gagal mengambil gambar dari URL. Coba unggah manual." }));
    }
  };

  const processProductFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (productPreviewUrl) URL.revokeObjectURL(productPreviewUrl);
    setProductFile(file);
    setProductPreviewUrl(URL.createObjectURL(file));
    
    setIsDetecting(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = (reader.result as string).split(',')[1];
      try {
        const detected = await detectProductFromImage(base64String, file.type);
        setProductName(detected);
      } catch (err) {
        setProductName("Product");
      } finally {
        setIsDetecting(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    
    // Cek key sebelum lanjut
    const isKeyReady = await checkKeyStatus();
    if (!isKeyReady || !process.env.API_KEY) {
      await handleKeySelect();
      return;
    }

    setAnalysis({ isLoading: true, error: null, result: null });
    setGeneratedImage({ url: null, isLoading: false, error: null });

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = (reader.result as string).split(',')[1];
      try {
        const result = await analyzeImageToPrompt(base64String, selectedFile.type, productName);
        setAnalysis({ isLoading: false, error: null, result });
        setEditedPrompt(result.mainPrompt);
      } catch (err: any) {
        setAnalysis({ isLoading: false, error: err.message || "Gagal menganalisis gambar.", result: null });
      }
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleGenerateImage = async () => {
    const promptToUse = editedPrompt || analysis.result?.mainPrompt;
    if (!promptToUse) return;

    const isKeyReady = await checkKeyStatus();
    if (!isKeyReady || !process.env.API_KEY) {
      await handleKeySelect();
      return;
    }
    
    setGeneratedImage(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      let productImageData = undefined;
      if (productFile) {
        const reader = new FileReader();
        productImageData = await new Promise<{data: string, mimeType: string}>((resolve) => {
          reader.onloadend = () => {
            resolve({
              data: (reader.result as string).split(',')[1],
              mimeType: productFile.type
            });
          };
          reader.readAsDataURL(productFile);
        });
      }

      const imageUrl = await generateImageFromPrompt(promptToUse, selectedRatio, productImageData);
      setGeneratedImage({ url: imageUrl, isLoading: false, error: null });
    } catch (err: any) {
      setGeneratedImage({ url: null, isLoading: false, error: err.message || "Gagal membuat gambar." });
    }
  };

  return (
    <div className="min-h-screen pb-20 bg-slate-950 text-slate-100">
      <Header />
      
      {/* API Key Status Banner */}
      <div className={`border-b transition-all duration-500 py-3 ${
        hasKey ? 'bg-indigo-600/10 border-indigo-500/20' : 'bg-rose-500/10 border-rose-500/30'
      }`}>
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-4 text-[11px]">
          <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-full ${hasKey ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`}>
              <Key className={`w-3.5 h-3.5 ${hasKey ? 'text-emerald-400' : 'text-rose-400 animate-pulse'}`} />
            </div>
            <div>
              <p className={`font-bold ${hasKey ? 'text-emerald-400' : 'text-rose-400'}`}>
                {hasKey ? "API Key Terkoneksi" : "API Key Diperlukan"}
              </p>
              <p className="text-slate-500 text-[10px]">Model Gemini 3 Pro membutuhkan Key dari Project GCP Berbayar</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {!hasKey && (
              <div className="hidden sm:flex items-center gap-2 text-amber-400 bg-amber-400/10 px-3 py-1 rounded-lg border border-amber-400/20">
                <Info className="w-3 h-3" />
                <span>Pilih Key untuk mengaktifkan fitur</span>
              </div>
            )}
            <button 
              onClick={handleKeySelect} 
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full border font-bold transition-all ${
                !hasKey 
                ? 'bg-rose-500 text-white border-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.3)] hover:scale-105 active:scale-95' 
                : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/40'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              {hasKey ? "Ganti API Key" : "Klik untuk Input API Key"}
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <section className="lg:col-span-5 space-y-6">
          {/* Reference Scene */}
          <div 
            className={`bg-slate-900/50 p-6 rounded-3xl border transition-all duration-300 shadow-xl backdrop-blur-sm ${
              isDraggingScene ? 'border-indigo-500 bg-indigo-500/10 scale-[1.02]' : 'border-slate-800'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDraggingScene(true); }}
            onDragLeave={() => setIsDraggingScene(false)}
            onDrop={(e) => { 
              e.preventDefault(); 
              setIsDraggingScene(false); 
              const file = e.dataTransfer.files[0];
              if (file) processSceneFile(file);
            }}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-400" />
                1. Reference Scene
              </h2>
            </div>

            {!previewUrl ? (
              <div className="space-y-4">
                <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-700 rounded-2xl cursor-pointer hover:bg-slate-800/50 transition-all group">
                  <Upload className="w-8 h-8 text-indigo-500/50 group-hover:scale-110 transition-transform mb-3" />
                  <p className="text-xs text-slate-500">Tarik gambar background ke sini</p>
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) processSceneFile(file);
                  }} />
                </label>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    placeholder="Tempel link gambar..."
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                    className="flex-1 bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500/50"
                  />
                  <button onClick={handleUrlSubmit} className="px-4 bg-slate-800 rounded-xl text-xs font-bold">Ambil</button>
                </div>
              </div>
            ) : (
              <div className="relative group rounded-2xl overflow-hidden border border-slate-700 h-64">
                <img src={previewUrl} className="w-full h-full object-cover" alt="Source" />
                <button onClick={() => { setPreviewUrl(null); setSelectedFile(null); }} className="absolute top-2 right-2 p-1.5 bg-rose-500 rounded-full text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Targeted Product */}
          <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-sm">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-4">
              <Package className="w-4 h-4 text-emerald-400" />
              2. Targeted Product
            </h2>
            {!productPreviewUrl ? (
              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-700 rounded-2xl cursor-pointer hover:bg-slate-800/50 transition-all group">
                <ScanSearch className="w-6 h-6 text-emerald-500/50 group-hover:scale-110 transition-transform mb-2" />
                <p className="text-xs text-slate-500">Unggah produk untuk disatukan</p>
                <input type="file" className="hidden" accept="image/*" onChange={(e) => processProductFile(e.target.files?.[0] as File)} />
              </label>
            ) : (
              <div className="relative group rounded-2xl overflow-hidden border border-slate-700 h-40">
                <img src={productPreviewUrl} className="w-full h-full object-cover" alt="Product" />
                <button onClick={() => { setProductPreviewUrl(null); setProductFile(null); }} className="absolute top-2 right-2 p-1.5 bg-rose-500 rounded-full text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <input 
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Mendeteksi nama produk..."
              className="mt-4 w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 outline-none"
            />
          </div>

          {/* Action Button */}
          <button
            onClick={handleAnalyze}
            disabled={!selectedFile || analysis.isLoading}
            className={`w-full py-5 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-xl active:scale-[0.98] ${
              !hasKey ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            {analysis.isLoading ? <Loader2 className="animate-spin" /> : <Wand2 />}
            {hasKey ? "Build Synthesis Prompt" : "Input API Key Dahulu"}
          </button>

          {/* Help/Error Box */}
          {analysis.error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-rose-400">Terjadi Kesalahan</p>
                  <p className="text-[10px] text-rose-300/80 leading-relaxed">{analysis.error}</p>
                </div>
              </div>
              <div className="pt-2 border-t border-rose-500/10 flex gap-2">
                 <button onClick={handleKeySelect} className="flex-1 py-1.5 bg-rose-500 text-white text-[10px] rounded-lg font-bold hover:bg-rose-400 transition-colors flex items-center justify-center gap-2">
                   <RotateCcw className="w-3 h-3" /> Input Ulang Key
                 </button>
                 <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="flex-1 py-1.5 bg-slate-800 text-slate-300 text-[10px] rounded-lg font-bold hover:bg-slate-700 transition-colors flex items-center justify-center gap-2">
                   <ExternalLink className="w-3 h-3" /> Cek Billing
                 </a>
              </div>
            </div>
          )}
        </section>

        {/* Studio Canvas */}
        <section className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 min-h-[500px] flex flex-col">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              AI Studio Engine
            </h2>

            {analysis.result ? (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="bg-slate-800/30 p-6 rounded-3xl border border-slate-700">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Calculated Prompt</span>
                    <button onClick={() => { navigator.clipboard.writeText(editedPrompt); setCopied(true); setTimeout(()=>setCopied(false), 2000); }} className="text-[10px] bg-slate-700 px-3 py-1 rounded-full border border-slate-600">
                      {copied ? 'Tersalin!' : 'Salin Prompt'}
                    </button>
                  </div>
                  <textarea 
                    value={editedPrompt}
                    onChange={(e) => setEditedPrompt(e.target.value)}
                    className="w-full bg-transparent text-sm font-mono text-slate-300 border-none focus:ring-0 resize-none h-24"
                  />
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {["1:1", "3:4", "4:3", "9:16", "16:9"].map((r) => (
                    <button
                      key={r}
                      onClick={() => setSelectedRatio(r as AspectRatio)}
                      className={`py-2 text-[10px] font-bold rounded-xl border transition-all ${
                        selectedRatio === r ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-500'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>

                {!generatedImage.url && !generatedImage.isLoading ? (
                  <button
                    onClick={handleGenerateImage}
                    className="w-full py-5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-3xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-500/20 transition-all shadow-lg active:scale-[0.98]"
                  >
                    <Zap className="w-4 h-4" /> Synthesize Reality
                  </button>
                ) : generatedImage.isLoading ? (
                  <div className="flex-1 min-h-[400px] bg-slate-900 rounded-3xl flex flex-col items-center justify-center border border-slate-800 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/5 to-transparent animate-pulse" />
                    <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
                    <p className="text-indigo-400 font-bold uppercase tracking-widest text-xs">Imaging Environment...</p>
                    <p className="text-slate-500 text-[10px] mt-2 italic flex items-center gap-1">
                       <ShieldCheck className="w-3 h-3 text-emerald-400" /> Preserving Product Fidelity
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in zoom-in-95 duration-500">
                    <div className="flex justify-between items-center px-2">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                        <Check className="w-3 h-3" /> Gambar Selesai
                      </span>
                      <div className="flex gap-2">
                        <button onClick={handleGenerateImage} className="text-[10px] bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-xl text-slate-200 font-bold flex items-center gap-2 border border-slate-700 transition-all">
                          <RefreshCw className="w-3 h-3" /> Buat Ulang
                        </button>
                        <button onClick={() => { const link = document.createElement('a'); link.href = generatedImage.url as string; link.download = `art-${Date.now()}.png`; link.click(); }} className="text-[10px] bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-xl text-white font-bold flex items-center gap-2 transition-all">
                          <Download className="w-3 h-3" /> Unduh
                        </button>
                      </div>
                    </div>
                    
                    {generatedImage.error && (
                      <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-[10px] text-rose-400">
                        {generatedImage.error}
                      </div>
                    )}

                    <div className={`w-full overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl relative ${
                      selectedRatio === '1:1' ? 'aspect-square' : 
                      selectedRatio === '3:4' ? 'aspect-[3/4]' : 
                      selectedRatio === '4:3' ? 'aspect-[4/3]' : 
                      selectedRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-[16/9]'
                    }`}>
                      <img src={generatedImage.url as string} className="w-full h-full object-cover" alt="Result" />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-600 space-y-4">
                <Wand2 className="w-12 h-12 opacity-10" />
                <p className="text-sm">Unggah scene dan produk untuk memulai</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
