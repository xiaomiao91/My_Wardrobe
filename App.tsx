import React, { useState, useEffect, useRef } from 'react';
import { AppView, Category, ClothingItem, ModelProfile, OutfitRecommendation } from './types';
import { NavBar } from './components/NavBar';
import { ClothingCard } from './components/ClothingCard';
import { IconPlus, IconLoading, IconUpload, IconClose, IconCamera, IconArrowRight, IconWand, IconSparkles } from './components/Icons';
import * as geminiService from './services/geminiService';

// Mock Data for Initial State
const INITIAL_CLOTHES: ClothingItem[] = [
  { id: '1', imageUrl: 'https://picsum.photos/400/500?random=1', category: Category.Tops, color: 'White', description: 'Classic white tee', tags: ['casual', 'basic'], createdAt: 1 },
  { id: '2', imageUrl: 'https://picsum.photos/400/500?random=2', category: Category.Bottoms, color: 'Blue', description: 'Denim jeans', tags: ['denim', 'casual'], createdAt: 2 },
  { id: '3', imageUrl: 'https://picsum.photos/400/500?random=3', category: Category.Dresses, color: 'Red', description: 'Summer floral dress', tags: ['summer', 'party'], createdAt: 3 },
  { id: '4', imageUrl: 'https://picsum.photos/400/500?random=4', category: Category.Outerwear, color: 'Black', description: 'Leather Jacket', tags: ['edgy', 'fall'], createdAt: 4 },
];

const INITIAL_MODELS: ModelProfile[] = [
  { id: 'm1', name: '默认模特', imageUrl: 'https://picsum.photos/400/600?random=10', isUser: false },
];

const App: React.FC = () => {
  // Auth State
  const [hasApiKey, setHasApiKey] = useState(false);

  // State
  const [currentView, setCurrentView] = useState<AppView>(AppView.Wardrobe);
  const [clothes, setClothes] = useState<ClothingItem[]>(INITIAL_CLOTHES);
  const [models, setModels] = useState<ModelProfile[]>(INITIAL_MODELS);
  const [recommendations, setRecommendations] = useState<OutfitRecommendation[]>([]);
  
  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category | 'All'>('All');
  
  // Try On State
  const [tryOnModel, setTryOnModel] = useState<ModelProfile | null>(null);
  const [tryOnTop, setTryOnTop] = useState<ClothingItem | null>(null);
  const [tryOnBottom, setTryOnBottom] = useState<ClothingItem | null>(null);
  const [generatedTryOnImage, setGeneratedTryOnImage] = useState<string | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);

  // --- Initialization ---

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      } else {
        // Fallback for dev environments without the wrapper
        setHasApiKey(true);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      // Assume success after dialog closes or race condition handling
      setHasApiKey(true);
    }
  };

  // --- Handlers ---

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'clothing' | 'model') => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(`0/${files.length}`);

    try {
      let completed = 0;
      for (const file of files) {
        const base64Data = await geminiService.fileToGenerativePart(file);
        const imageUrl = URL.createObjectURL(file);

        if (type === 'clothing') {
          // Analyze sequentially to avoid rate limits or overwhelming UI
          const analysis = await geminiService.analyzeClothingImage(base64Data);
          
          const newItem: ClothingItem = {
            id: Date.now().toString() + Math.random().toString().slice(2, 6),
            imageUrl: imageUrl, 
            category: analysis.category || Category.Unspecified,
            color: analysis.color || 'Unknown',
            description: analysis.description || 'Uploaded Item',
            tags: analysis.tags || [],
            createdAt: Date.now(),
          };
          setClothes(prev => [newItem, ...prev]);
        } else {
          const newModel: ModelProfile = {
            id: Date.now().toString() + Math.random().toString().slice(2, 6),
            name: `模特 ${models.length + 1}`,
            imageUrl: imageUrl,
            isUser: true
          };
          setModels(prev => [...prev, newModel]);
        }
        completed++;
        setUploadProgress(`${completed}/${files.length}`);
      }
    } catch (err) {
      console.error(err);
      setUploadError("部分图片识别失败，请重试");
    } finally {
      setIsUploading(false);
      setUploadProgress('');
      if (event.target) event.target.value = '';
    }
  };

  // Helper to fetch blob and convert to base64 for existing URLs
  const getBase64FromUrl = async (url: string) => {
    const response = await fetch(url);
    const blob = await response.blob();
    return geminiService.fileToGenerativePart(new File([blob], "temp"));
  };

  const handleGenerateTryOn = async () => {
    if (!tryOnModel || (!tryOnTop && !tryOnBottom)) {
      setUploadError("请选择一个模特和至少一件衣服");
      return;
    }
    
    setIsLoading(true);
    setGeneratedTryOnImage(null);

    try {
      const modelB64 = await getBase64FromUrl(tryOnModel.imageUrl);
      const clothesB64: string[] = [];
      
      if (tryOnTop) clothesB64.push(await getBase64FromUrl(tryOnTop.imageUrl));
      if (tryOnBottom) clothesB64.push(await getBase64FromUrl(tryOnBottom.imageUrl));

      const resultImage = await geminiService.generateTryOnImage(modelB64, clothesB64);
      setGeneratedTryOnImage(resultImage);

    } catch (err) {
      console.error(err);
      setUploadError("生成试穿效果失败，可能是API权限问题");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateRecommendationVisual = async (recIndex: number) => {
    const rec = recommendations[recIndex];
    if (!models.length) {
      alert("请先在'模特'页面上传或选择一个模特");
      return;
    }
    
    // Use user model if available, else first default
    const modelToUse = models.find(m => m.isUser) || models[0];
    const relatedItems = clothes.filter(c => rec.relatedItemIds.includes(c.id));

    if (relatedItems.length === 0) {
      alert("无法找到该搭配对应的衣物图片");
      return;
    }

    // Set local loading state for this specific card? 
    // Simplified: Global loading or a way to update the specific recommendation object
    setIsLoading(true); // Global loading for simplicity

    try {
       const modelB64 = await getBase64FromUrl(modelToUse.imageUrl);
       const clothesB64 = await Promise.all(relatedItems.map(c => getBase64FromUrl(c.imageUrl)));
       
       const generatedImage = await geminiService.generateTryOnImage(modelB64, clothesB64);
       
       setRecommendations(prev => {
         const newRecs = [...prev];
         newRecs[recIndex] = { ...newRecs[recIndex], generatedImageUrl: generatedImage };
         return newRecs;
       });
    } catch (e) {
      console.error(e);
      alert("生成失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetRecommendations = async () => {
    setIsLoading(true);
    try {
      const recs = await geminiService.getOutfitRecommendations(clothes);
      setRecommendations(recs);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Views ---

  const renderApiKeySelection = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-primary/20">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-xs w-full">
        <IconSparkles className="w-12 h-12 text-accent mx-auto mb-4" />
        <h1 className="text-xl font-bold mb-2">欢迎来到我的衣橱</h1>
        <p className="text-gray-600 mb-6 text-sm">
          为了使用高级AI试穿功能，需要连接您的 Google Gemini API Key。
        </p>
        <button
          onClick={handleSelectKey}
          className="w-full bg-accent text-white py-3 rounded-xl font-bold shadow-lg hover:bg-accent/90 transition-transform active:scale-95"
        >
          连接 API Key
        </button>
        <p className="mt-4 text-[10px] text-gray-400">
          <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="underline">了解关于 API Billing</a>
        </p>
      </div>
    </div>
  );

  const renderWardrobe = () => {
    const categories = ['All', ...Object.values(Category)];
    const filteredClothes = activeCategory === 'All' 
      ? clothes 
      : clothes.filter(c => c.category === activeCategory);

    return (
      <div className="pb-24 pt-4 px-4">
        <header className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">我的衣橱</h1>
            <p className="text-sm text-gray-500">{clothes.length} 件单品</p>
          </div>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="bg-accent text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-lg hover:bg-accent/90 transition-all active:scale-95"
          >
            {isUploading ? <IconLoading className="w-4 h-4" /> : <IconPlus className="w-4 h-4" />}
            <span>{isUploading ? '处理中' : '添加'}</span>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*"
            multiple // Enable multiple files
            onChange={(e) => handleFileUpload(e, 'clothing')}
          />
        </header>

        {isUploading && (
           <div className="mb-4 bg-primary/20 text-accent px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 animate-pulse">
             <IconLoading className="w-4 h-4" />
             正在识别图片... {uploadProgress}
           </div>
        )}

        {/* Categories */}
        <div className="flex overflow-x-auto no-scrollbar gap-2 mb-6 pb-2">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat as any)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat 
                  ? 'bg-gray-800 text-white' 
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {cat === 'All' ? '全部' : cat}
            </button>
          ))}
        </div>

        {uploadError && (
          <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm flex justify-between items-center">
            {uploadError}
            <button onClick={() => setUploadError(null)}><IconClose className="w-4 h-4" /></button>
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredClothes.map(item => (
            <ClothingCard 
              key={item.id} 
              item={item} 
              onDelete={(id) => setClothes(prev => prev.filter(c => c.id !== id))}
            />
          ))}
          {filteredClothes.length === 0 && (
            <div className="col-span-full text-center py-20 text-gray-400">
              <IconUpload className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>这个分类下还没有衣服哦</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderModels = () => (
    <div className="pb-24 pt-4 px-4">
       <header className="mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">模特管理</h1>
          <button 
            onClick={() => modelInputRef.current?.click()}
            className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-full flex items-center gap-2 shadow-sm"
          >
             {isUploading ? <IconLoading className="w-4 h-4" /> : <IconCamera className="w-4 h-4" />}
             <span>上传</span>
          </button>
          <input 
            type="file" 
            ref={modelInputRef} 
            className="hidden" 
            accept="image/*"
            multiple
            onChange={(e) => handleFileUpload(e, 'model')}
          />
        </header>

        <div className="grid grid-cols-2 gap-4">
          {models.map(model => (
            <div key={model.id} className="relative rounded-xl overflow-hidden aspect-[3/4] group">
              <img src={model.imageUrl} className="w-full h-full object-cover" alt={model.name} />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                <p className="text-white font-medium text-sm">{model.name}</p>
                {model.isUser && <span className="text-[10px] bg-accent text-white px-1.5 py-0.5 rounded ml-1">我</span>}
              </div>
            </div>
          ))}
        </div>
    </div>
  );

  const renderTryOn = () => (
    <div className="pb-24 pt-4 px-4 min-h-screen bg-gray-50">
       <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">虚拟试穿</h1>
          <p className="text-sm text-gray-500">选择模特和衣物，AI生成试穿效果</p>
        </header>

        <div className="space-y-6">
          {/* 1. Select Model */}
          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="bg-gray-200 w-5 h-5 rounded-full flex items-center justify-center text-xs">1</span> 
              选择模特
            </h2>
            <div className="flex overflow-x-auto no-scrollbar gap-3 pb-2">
              {models.map(m => (
                <button 
                  key={m.id}
                  onClick={() => setTryOnModel(m)}
                  className={`relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 ${tryOnModel?.id === m.id ? 'border-accent' : 'border-transparent'}`}
                >
                   <img src={m.imageUrl} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </section>

          {/* 2. Select Clothes */}
          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="bg-gray-200 w-5 h-5 rounded-full flex items-center justify-center text-xs">2</span> 
              搭配衣物
            </h2>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Top Selection */}
              <div className="bg-white p-3 rounded-xl border border-dashed border-gray-300 min-h-[120px]">
                <p className="text-xs text-gray-500 mb-2">上装</p>
                {tryOnTop ? (
                  <div className="relative group">
                    <img src={tryOnTop.imageUrl} className="w-full h-32 object-contain rounded" />
                    <button 
                      onClick={() => setTryOnTop(null)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow"
                    >
                      <IconClose className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="h-24 flex items-center justify-center text-gray-300 text-xs">
                    未选择
                  </div>
                )}
                <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar py-1">
                  {clothes.filter(c => c.category === Category.Tops || c.category === Category.Outerwear).map(c => (
                     <button key={c.id} onClick={() => setTryOnTop(c)} className="w-10 h-10 flex-shrink-0 border rounded overflow-hidden">
                       <img src={c.imageUrl} className="w-full h-full object-cover" />
                     </button>
                  ))}
                </div>
              </div>

              {/* Bottom Selection */}
              <div className="bg-white p-3 rounded-xl border border-dashed border-gray-300 min-h-[120px]">
                <p className="text-xs text-gray-500 mb-2">下装/裙装</p>
                {tryOnBottom ? (
                   <div className="relative">
                   <img src={tryOnBottom.imageUrl} className="w-full h-32 object-contain rounded" />
                   <button 
                     onClick={() => setTryOnBottom(null)}
                     className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow"
                   >
                     <IconClose className="w-3 h-3" />
                   </button>
                 </div>
                ) : (
                  <div className="h-24 flex items-center justify-center text-gray-300 text-xs">
                    未选择
                  </div>
                )}
                <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar py-1">
                  {clothes.filter(c => c.category === Category.Bottoms || c.category === Category.Dresses).map(c => (
                     <button key={c.id} onClick={() => setTryOnBottom(c)} className="w-10 h-10 flex-shrink-0 border rounded overflow-hidden">
                       <img src={c.imageUrl} className="w-full h-full object-cover" />
                     </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Action */}
          <div className="flex justify-center pt-2">
            <button
              onClick={handleGenerateTryOn}
              disabled={isLoading || !tryOnModel}
              className={`w-full py-3 rounded-xl font-bold flex justify-center items-center gap-2 shadow-lg ${
                isLoading || !tryOnModel ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-accent to-purple-500 text-white'
              }`}
            >
               {isLoading ? (
                 <>
                   <IconLoading className="w-5 h-5" /> 生成中...
                 </>
               ) : (
                 <>
                   <IconWand className="w-5 h-5" /> 生成试穿效果
                 </>
               )}
            </button>
          </div>
          
           {uploadError && (
             <p className="text-red-500 text-center text-sm mt-2">{uploadError}</p>
           )}

          {/* Result */}
          {generatedTryOnImage && (
             <div className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
               <h3 className="text-lg font-bold mb-3">效果预览</h3>
               <div className="rounded-xl overflow-hidden shadow-2xl border-4 border-white">
                 <img src={generatedTryOnImage} className="w-full" alt="Generated Try On" />
               </div>
               <p className="text-xs text-center text-gray-400 mt-2">AI 生成效果仅供参考</p>
             </div>
          )}
        </div>
    </div>
  );

  const renderInspire = () => (
    <div className="pb-24 pt-4 px-4">
      <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">穿搭灵感</h1>
          <p className="text-sm text-gray-500">基于您当前衣橱的智能推荐</p>
      </header>

      {recommendations.length === 0 && (
        <div className="bg-gradient-to-br from-primary to-secondary p-6 rounded-2xl text-center mb-8">
          <IconSparkles className="w-12 h-12 text-accent mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-800 mb-2">不知道穿什么？</h3>
          <p className="text-gray-600 mb-6 text-sm">让 AI 分析您的衣橱，为您定制当下流行的搭配方案。</p>
          <button 
            onClick={handleGetRecommendations}
            disabled={isLoading}
            className="bg-accent text-white px-6 py-2 rounded-full font-medium shadow-md hover:bg-accent/90 disabled:opacity-70"
          >
            {isLoading ? '分析中...' : '获取搭配建议'}
          </button>
        </div>
      )}

      {isLoading && recommendations.length === 0 && (
         <div className="flex flex-col items-center justify-center py-12">
            <IconLoading className="w-8 h-8 text-accent mb-2" />
            <p className="text-sm text-gray-500">正在浏览您的衣橱...</p>
         </div>
      )}

      <div className="space-y-6">
        {recommendations.map((rec, idx) => (
          <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gray-50 p-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                 <span className="text-accent">#{(idx+1)}</span> {rec.title}
              </h3>
            </div>
            
            <div className="p-4">
               {/* Show related items thumbnails */}
               <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
                 {rec.relatedItemIds?.map(id => {
                   const item = clothes.find(c => c.id === id);
                   if (!item) return null;
                   return (
                     <div key={id} className="w-12 h-12 rounded border border-gray-200 overflow-hidden flex-shrink-0">
                       <img src={item.imageUrl} className="w-full h-full object-cover" />
                     </div>
                   );
                 })}
               </div>

               <p className="text-gray-600 text-sm mb-4 leading-relaxed">{rec.description}</p>
               
               {/* Generate Button / Image */}
               {rec.generatedImageUrl ? (
                 <div className="mb-4 rounded-lg overflow-hidden border border-gray-200">
                    <img src={rec.generatedImageUrl} className="w-full h-auto" />
                 </div>
               ) : (
                  <button 
                    onClick={() => handleGenerateRecommendationVisual(idx)}
                    disabled={isLoading}
                    className="w-full mb-4 bg-white border border-accent text-accent py-2 rounded-lg text-sm font-semibold hover:bg-accent/5 flex items-center justify-center gap-2"
                  >
                     {isLoading ? <IconLoading className="w-4 h-4"/> : <IconWand className="w-4 h-4" />}
                     直接看上身效果
                  </button>
               )}

               <div className="bg-primary/20 rounded-lg p-3 mb-2">
                 <p className="text-xs text-gray-400 italic">💡 推荐理由: {rec.reasoning}</p>
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (!hasApiKey) {
    return renderApiKeySelection();
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 shadow-2xl relative">
      {currentView === AppView.Wardrobe && renderWardrobe()}
      {currentView === AppView.Models && renderModels()}
      {currentView === AppView.TryOn && renderTryOn()}
      {currentView === AppView.Inspire && renderInspire()}
      
      <NavBar currentView={currentView} onChange={setCurrentView} />
    </div>
  );
};

export default App;