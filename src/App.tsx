import React, { useState, useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  Trash2, 
  FileJson, 
  FileSpreadsheet, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Download,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  Sun,
  Moon,
  ExternalLink,
  User,
  Key
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import JSZip from 'jszip';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { analyzeImage } from './services/geminiService';
import { ImageMetadata, GeneratedMetadata } from './types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from './lib/utils';

export default function App() {
  const [images, setImages] = useState<ImageMetadata[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('USER_GEMINI_API_KEY') || '');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  React.useEffect(() => {
    localStorage.setItem('USER_GEMINI_API_KEY', apiKey);
  }, [apiKey]);

  const selectedImage = useMemo(() => 
    images.find(img => img.id === selectedImageId), 
    [images, selectedImageId]
  );

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newImages: ImageMetadata[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      fileName: file.name,
      previewUrl: URL.createObjectURL(file),
      status: 'pending' as const,
    }));

    setImages(prev => [...prev, ...newImages]);

    // Process each image
    for (const img of newImages) {
      const file = acceptedFiles.find(f => f.name === img.fileName);
      if (!file) continue;

      processImage(img.id, file);
    }
  }, []);

  const processImage = async (id: string, file: File) => {
    updateImageStatus(id, 'processing');
    
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      const metadata = await analyzeImage(base64Data, file.type, apiKey);
      
      setImages(prev => prev.map(img => 
        img.id === id ? { ...img, status: 'completed', data: metadata } : img
      ));
      
      if (!selectedImageId) setSelectedImageId(id);
    } catch (error) {
      console.error(error);
      updateImageStatus(id, 'error', 'Failed to analyze image. Please try again.');
    }
  };

  const updateImageStatus = (id: string, status: ImageMetadata['status'], error?: string) => {
    setImages(prev => prev.map(img => 
      img.id === id ? { ...img, status, error } : img
    ));
  };

  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
    if (selectedImageId === id) setSelectedImageId(null);
  };

  const clearAll = () => {
    images.forEach(img => URL.revokeObjectURL(img.previewUrl));
    setImages([]);
    setSelectedImageId(null);
  };

  const exportShutterstockCSV = () => {
    const completed = images.filter(img => img.status === 'completed' && img.data);
    if (completed.length === 0) return toast.error('No processed images to export');

    const headers = ['Filename', 'Description', 'Keywords', 'Categories', 'Editorial', 'Mature Content', 'Illustration'];
    const rows = completed.map(img => [
      img.fileName,
      `"${img.data!.description.replace(/"/g, '""')}"`,
      `"${img.data!.keywords.join(', ').replace(/"/g, '""')}"`,
      `"${img.data!.categories.join(', ').replace(/"/g, '""')}"`,
      img.data!.isEditorial ? 'Yes' : 'No',
      img.data!.isMature ? 'Yes' : 'No',
      img.data!.isIllustration ? 'Yes' : 'No'
    ]);

    generateCSV(headers, rows, 'shutterstock');
    toast.success('Shutterstock CSV exported successfully');
  };

  const exportAdobeStockCSV = () => {
    const completed = images.filter(img => img.status === 'completed' && img.data);
    if (completed.length === 0) return toast.error('No processed images to export');

    // Adobe Stock Headers: Filename, Title, Keywords, Category, Releases
    const headers = ['Filename', 'Title', 'Keywords', 'Category', 'Releases'];
    const rows = completed.map(img => [
      img.fileName,
      `"${img.data!.description.replace(/"/g, '""')}"`, // Adobe uses Title for description
      `"${img.data!.keywords.join(', ').replace(/"/g, '""')}"`,
      `"${img.data!.categories[0] || 'Other'}"`, // Map to first category
      '' // Releases empty
    ]);

    generateCSV(headers, rows, 'adobe-stock');
    toast.success('Adobe Stock CSV exported successfully');
  };

  const exportFreepikCSV = () => {
    const completed = images.filter(img => img.status === 'completed' && img.data);
    if (completed.length === 0) return toast.error('No processed images to export');

    // Freepik Headers: File name, Title, Keywords
    const headers = ['File name', 'Title', 'Keywords'];
    const rows = completed.map(img => [
      img.fileName,
      `"${img.data!.description.replace(/"/g, '""')}"`,
      `"${img.data!.keywords.join(', ').replace(/"/g, '""')}"`
    ]);

    generateCSV(headers, rows, 'freepik');
    toast.success('Freepik CSV exported successfully');
  };

  const generateCSV = (headers: string[], rows: any[][], platform: string) => {
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${platform}-metadata-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    multiple: true
  } as any);

  return (
    <TooltipProvider>
      <div className="layout-container">
        <Toaster position="top-right" theme="dark" />
        
        {/* Navbar */}
        <header className="header-layout glass-panel sticky top-0 z-50">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center shadow-lg overflow-hidden group">
              <User className="w-5 h-5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
            </div>
            <div className="flex flex-col -gap-1">
              <span className="nav-title font-black tracking-tighter text-xl">
                <span className="text-[#ff4d4d] drop-shadow-[0_0_8px_rgba(255,77,77,0.3)]">Amir</span>
                <span className="text-[#00e676] ml-1 drop-shadow-[0_0_8px_rgba(0,230,118,0.3)]">Matadata</span>
              </span>
              <span className="text-[9px] text-slate-500 font-mono tracking-[0.3em] uppercase opacity-70">Neural Batch Processor</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 ml-auto">
            <div className="relative">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowApiKeyInput(!showApiKeyInput)} 
                className={cn("hover:bg-slate-800 transition-colors", apiKey && "text-indigo-400")}
              >
                <Key className="w-4 h-4" />
              </Button>
              
              <AnimatePresence>
                {showApiKeyInput && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 top-full mt-2 w-64 glass-panel p-4 rounded-xl shadow-2xl z-[60] border-slate-700"
                  >
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 block">
                      Custom Gemini API Key
                    </label>
                    <input 
                      type="password"
                      placeholder="Paste key here..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:ring-1 focus:ring-indigo-500/50 outline-none mb-2"
                    />
                    <p className="text-[9px] text-slate-500 leading-relaxed">
                      If provided, this key will be used for image analysis. Leave blank to use system default.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Button variant="ghost" size="icon" onClick={() => setIsDarkMode(!isDarkMode)} className="hover:bg-slate-800 transition-colors">
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
            </Button>
            <Separator orientation="vertical" className="h-6 bg-slate-800" />
            <Button variant="outline" onClick={clearAll} disabled={images.length === 0} className="border-slate-800 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all text-xs">
              Clear Queue
            </Button>
            
            <div className="flex glass-panel rounded-lg overflow-hidden border-slate-800 p-1 gap-1">
              <Button 
                onClick={exportShutterstockCSV} 
                disabled={images.length === 0} 
                className="premium-gradient text-white border-0 h-8 px-4 gap-2 text-[10px] font-bold shadow-lg shadow-indigo-500/20"
              >
                <Download className="w-3 h-3" /> 
                EXPORT ({images.filter(img => img.status === 'completed').length})
              </Button>
              <div className="flex items-center">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={exportAdobeStockCSV}
                  disabled={images.length === 0}
                  className="h-8 px-3 rounded-md text-[10px] hover:bg-slate-800 text-slate-400 transition-colors font-medium"
                >
                  ADOBE
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={exportFreepikCSV}
                  disabled={images.length === 0}
                  className="h-8 px-3 rounded-md text-[10px] hover:bg-slate-800 text-slate-400 transition-colors font-medium"
                >
                  FREEPIK
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="main-layout whitespace-normal">
          
          {/* Sidebar: Batch Preview */}
          <aside className="sidebar-layout">
            <div className="sidebar-header">
              <h3 className="label-caps">Image Queue</h3>
              <span className="sidebar-count">{images.length} Units</span>
            </div>
            <div className="image-queue-wrapper space-y-2 p-3">
              {images.length === 0 && (
                <div 
                  {...getRootProps()} 
                  className={cn(
                    "py-16 border-2 border-dashed rounded-xl text-center flex flex-col items-center gap-4 transition-all duration-300 cursor-pointer",
                    isDragActive ? "border-indigo-500 bg-indigo-500/10 scale-95" : "border-slate-800 bg-slate-900/40 hover:border-slate-600"
                  )}
                >
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                    <Plus className="w-6 h-6 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-300">Drop Images</p>
                    <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest">or click to browse</p>
                  </div>
                  <input {...getInputProps()} />
                </div>
              )}
              <AnimatePresence initial={false}>
                {images.map((img) => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={img.id}
                    onClick={() => setSelectedImageId(img.id)}
                    className={cn(
                      "queue-item p-1.5 rounded-xl transition-all duration-200 cursor-pointer group border",
                      selectedImageId === img.id 
                        ? "bg-slate-800/80 border-indigo-500/50 shadow-lg shadow-indigo-500/10" 
                        : "bg-transparent border-transparent hover:bg-slate-900/60"
                    )}
                  >
                    <div className="flex gap-3 relative">
                      <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-slate-900 border border-slate-800 relative">
                        <img src={img.previewUrl} alt={img.fileName} className="w-full h-full object-cover" />
                        {img.status === 'processing' && (
                          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] flex items-center justify-center overflow-hidden">
                            <div className="w-full h-0.5 bg-indigo-400/80 absolute top-0 animate-scanning shadow-[0_0_10px_oklch(0.6_0.2_260)]" />
                            <Loader2 className="w-4 h-4 text-white animate-spin relative z-10" />
                          </div>
                        )}
                        {img.status === 'completed' && (
                          <div className="absolute top-1 right-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pr-8 py-1">
                        <p className="text-[11px] font-medium text-slate-200 truncate">{img.fileName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn(
                            "text-[9px] font-bold uppercase tracking-widest",
                            img.status === 'completed' ? "text-emerald-500/80" : 
                            img.status === 'error' ? "text-red-500/80" : 
                            img.status === 'processing' ? "text-indigo-400" : "text-slate-500"
                          )}>
                            {img.status}
                          </span>
                          {img.status === 'processing' && (
                            <span className="flex items-center gap-1">
                              <span className="w-1 h-1 bg-indigo-400 rounded-full animate-pulse" />
                              <span className="w-1 h-1 bg-indigo-400 rounded-full animate-pulse [animation-delay:0.2s]" />
                              <span className="w-1 h-1 bg-indigo-400 rounded-full animate-pulse [animation-delay:0.4s]" />
                            </span>
                          )}
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity absolute right-1 top-1"
                        onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {images.length > 0 && (
                <div 
                  {...getRootProps()} 
                  className="p-3 border border-dashed border-slate-800 rounded-xl flex items-center justify-center gap-2 text-slate-500 hover:text-slate-300 hover:border-slate-600 hover:bg-slate-900/40 transition-all cursor-pointer mt-4"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-[10px] uppercase tracking-[0.2em] font-bold">Add Images</span>
                  <input {...getInputProps()} />
                </div>
              )}
            </div>
          </aside>

          {/* Main Content: Metadata Details */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <AnimatePresence mode="wait">
              {selectedImage ? (
                <motion.div 
                  key={selectedImage.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="h-full grid grid-cols-1 xl:grid-cols-[1fr_450px] gap-6"
                >
                  {/* Active Preview Hero */}
                  <div className="hero-preview-container bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
                    <div className="hero-preview p-6 bg-slate-950/50">
                      <div className="relative group">
                        <img 
                          src={selectedImage.previewUrl} 
                          className="max-w-full max-h-[500px] object-contain rounded-lg shadow-2xl transition-transform duration-500 group-hover:scale-[1.02]" 
                          alt="Preview" 
                        />
                        <div className="absolute inset-0 ring-1 ring-white/10 rounded-lg pointer-events-none" />
                      </div>
                      <div className="mt-4 flex items-center justify-center">
                        <div className="glass-panel px-4 py-1.5 rounded-full text-[10px] text-slate-400 font-mono tracking-widest uppercase flex gap-3">
                          <span>{selectedImage.status === 'completed' ? '4532 x 3024px' : 'Pending Resolution'}</span>
                          <span className="text-indigo-400/50">•</span>
                          <span>{selectedImage.status === 'completed' ? '12.4 MB' : 'Pending Processing'}</span>
                          <span className="text-indigo-400/50">•</span>
                          <span className="text-indigo-400 font-bold">AI ANALYZED</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="analysis-sidebar border-t border-slate-800 bg-slate-900/20">
                      <div className="p-6">
                        <h3 className="label-caps mb-6 text-slate-400">Computational Insights</h3>
                        <div className="space-y-6">
                          <div className="analysis-item group">
                            <div className="analysis-label-group mb-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 group-hover:text-indigo-400 transition-colors">Visual Clarity</span>
                              <span className="text-xs font-mono text-slate-200">98.2%</span>
                            </div>
                            <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: "98.2%" }}
                                transition={{ duration: 1, ease: "easeOut" }}
                                className="h-full premium-gradient" 
                              />
                            </div>
                          </div>
                          <div className="analysis-item group">
                            <div className="analysis-label-group mb-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 group-hover:text-indigo-400 transition-colors">Semantic Depth</span>
                              <span className="text-xs font-mono text-slate-200">94.5%</span>
                            </div>
                            <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: "94.5%" }}
                                transition={{ duration: 1, ease: "easeOut", delay: 0.1 }}
                                className="h-full premium-gradient" 
                              />
                            </div>
                          </div>
                          <div className="analysis-item group">
                            <div className="analysis-label-group mb-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 group-hover:text-emerald-400 transition-colors">Marketability</span>
                              <span className="text-xs font-mono text-emerald-400">A+</span>
                            </div>
                            <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: "92%" }}
                                transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                                className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" 
                              />
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-2">
                            {selectedImage.data?.analysis.objects.slice(0, 5).map((obj, i) => (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.3 + (i * 0.05) }}
                                key={obj} 
                                className="glass-panel px-3 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-wider text-slate-300 border-slate-800/50 hover:border-slate-700 transition-colors"
                              >
                                {obj}
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Metadata Fields Section */}
                  <div className="metadata-grid flex-1 overflow-auto bg-slate-900/30 rounded-2xl border border-slate-800/80 p-6 shadow-xl">
                    {/* Left: General Info */}
                    <div className="flex flex-col gap-6 min-w-0">
                      <div className="metadata-field group">
                        <div className="field-label-row mb-2">
                          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 group-focus-within:text-indigo-400 transition-colors">Shutterstock Title</label>
                          <span className="text-[10px] font-mono text-slate-600">{selectedImage.data?.title.length || 0}/70</span>
                        </div>
                        <input 
                          type="text" 
                          readOnly
                          value={selectedImage.data?.title || ""} 
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all outline-none"
                        />
                      </div>
                      <div className="metadata-field group">
                        <div className="field-label-row mb-2">
                          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 group-focus-within:text-indigo-400 transition-colors">Global Description</label>
                          <span className="text-[10px] font-mono text-slate-600">{selectedImage.data?.description.length || 0}/200</span>
                        </div>
                        <textarea 
                          readOnly
                          value={selectedImage.data?.description || ""} 
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 min-h-[120px] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all outline-none resize-none"
                        />
                      </div>
                      <div className="metadata-field">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-3 block">Selected Categories</label>
                        <div className="flex flex-wrap gap-2">
                          {selectedImage.data?.categories.map(cat => (
                            <Badge key={cat} variant="secondary" className="glass-panel px-3 py-1 text-[10px] text-indigo-300 border-indigo-500/20 hover:border-indigo-500/40 transition-colors">
                              {cat}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-6 mt-auto pt-4 border-t border-slate-800">
                        <div className="flex items-center gap-3 group px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-default">
                          <div className={cn("w-2 h-2 rounded-full", selectedImage.data?.isEditorial ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" : "bg-slate-800")} />
                          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 group-hover:text-slate-300">Editorial</span>
                        </div>
                        <div className="flex items-center gap-3 group px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-default">
                          <div className={cn("w-2 h-2 rounded-full", selectedImage.data?.isMature ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" : "bg-slate-800")} />
                          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 group-hover:text-slate-300">Mature</span>
                        </div>
                        <div className="flex items-center gap-3 group px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-default">
                          <div className={cn("w-2 h-2 rounded-full", selectedImage.data?.isIllustration ? "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" : "bg-slate-800")} />
                          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 group-hover:text-slate-300">Illustration</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Right: Keywords */}
                    <div className="flex flex-col gap-6 min-w-0">
                      <div className="flex flex-col gap-2 flex-1 min-h-0">
                        <div className="field-label-row items-center">
                          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Keyword Reservoir ({selectedImage.data?.keywords.length || 0})</label>
                          <button 
                            className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 hover:text-indigo-300 transition-colors"
                            onClick={() => {
                              navigator.clipboard.writeText(selectedImage.data?.keywords.join(', ') || '');
                              toast.success("All keywords copied to clipboard");
                            }}
                          >
                            Copy Set
                          </button>
                        </div>
                        <div className="keyword-container overflow-y-auto max-h-[400px] pr-2 custom-scrollbar flex flex-wrap gap-2 content-start">
                          {selectedImage.data?.keywords.map((kw, i) => (
                            <motion.span 
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.1 + (i * 0.01) }}
                              key={i} 
                              className={cn(
                                "text-[10px] font-medium px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all",
                                i < 10 
                                  ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-200 font-bold" 
                                  : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600"
                              )}
                            >
                              {i < 10 && <span className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse" />}
                              {kw}
                            </motion.span>
                          ))}
                        </div>
                      </div>
                      
                      <div className="flex gap-3 shrink-0">
                        <Button 
                          className="flex-1 premium-gradient text-white font-bold text-[11px] h-11 tracking-widest gap-2 shadow-xl shadow-indigo-500/10"
                          onClick={() => {
                            const metadataString = `Title: ${selectedImage.data?.title}\nDescription: ${selectedImage.data?.description}\nKeywords: ${selectedImage.data?.keywords.join(', ')}\nCategories: ${selectedImage.data?.categories.join(', ')}`;
                            navigator.clipboard.writeText(metadataString);
                            toast.success("Master metadata signature copied");
                          }}
                        >
                          COPY MASTER RECORD
                        </Button>
                        <a 
                          href="https://submit.shutterstock.com/upload" 
                          target="_blank" 
                          rel="noreferrer"
                          className={cn(buttonVariants({ variant: "outline" }), "flex-1 border-slate-800 bg-slate-900/50 hover:bg-slate-800 text-[11px] h-11 font-bold tracking-widest text-slate-400 hover:text-white transition-all")}
                        >
                          PORTAL UPLOAD
                        </a>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-40 h-40 bg-slate-900/50 rounded-full flex items-center justify-center mb-8 relative"
                  >
                    <div className="absolute inset-0 rounded-full border border-indigo-500/20 animate-pulse" />
                    <div className="absolute inset-4 rounded-full border border-indigo-500/10 animate-pulse [animation-delay:0.5s]" />
                    <ImageIcon className="w-16 h-16 text-indigo-500/40" />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <h2 className="text-4xl font-bold tracking-tighter mb-4 text-gradient">System Standby</h2>
                    <p className="text-xs uppercase tracking-[0.4em] font-bold text-slate-500 max-w-xs mx-auto leading-relaxed">
                      Initialize batch processing by uploading visual assets to the neural pipeline
                    </p>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </main>

        {/* Bottom Bar Info */}
        <footer className="footer-layout glass-panel border-t-0 p-3 mt-auto">
          <div className="footer-status-group">
            <div className="footer-status-item glass-panel px-3 py-1 rounded-full border-slate-800/50">
              <div className="status-pulse bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Mainframe Link Secure</span>
            </div>
            <div className="footer-status-item glass-panel px-3 py-1 rounded-full border-slate-800/50">
              <div className="status-pulse bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
              <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Gemini Neural Core Active</span>
            </div>
          </div>
          <div className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">
            NODE_INSTANCE: <span className="text-slate-400">#AM-MX-{new Date().getTime().toString().slice(-6)}</span>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
}
