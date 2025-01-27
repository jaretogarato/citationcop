import { Upload, FileText } from "lucide-react";

interface TabSelectorProps {
  activeTab: 'upload' | 'paste';
  setActiveTab: (tab: 'upload' | 'paste') => void;
}

export function TabSelector({ activeTab, setActiveTab }: TabSelectorProps) {
  return (
    <div className="relative">
      <div className="w-full grid grid-cols-2 gap-2 p-1 bg-gray-800 rounded-2xl">
        <button 
          onClick={() => setActiveTab('upload')}
          className={`rounded-xl px-4 py-3 ${
            activeTab === 'upload' 
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' 
              : 'bg-transparent text-gray-400'
          } flex items-center gap-2 transition-all duration-300 justify-center`}
        >
          <Upload className="w-4 h-4" />
          Upload Document
        </button>
        <button 
          onClick={() => setActiveTab('paste')}
          className={`rounded-xl px-4 py-3 ${
            activeTab === 'paste' 
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' 
              : 'bg-transparent text-gray-400'
          } flex items-center gap-2 transition-all duration-300 justify-center`}
        >
          <FileText className="w-4 h-4" />
          Paste Text
        </button>
      </div>
    </div>
  );
}