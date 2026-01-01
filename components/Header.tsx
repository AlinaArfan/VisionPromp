
import React from 'react';
import { Camera, Sparkles } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="py-6 px-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg">
            <Camera className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            VisionPrompt <span className="text-indigo-500">AI</span>
          </h1>
        </div>
        <div className="hidden md:flex items-center gap-2 text-slate-400 text-sm">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Accurate Image-to-Prompt Intelligence</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
