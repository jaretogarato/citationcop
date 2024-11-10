// components/verify/GetReferences/TextInput.tsx
interface TextInputProps {
    text: string;
    setText: (text: string) => void;
  }
  
  export function TextInput({ text, setText }: TextInputProps) {
    return (
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full h-64 p-6 rounded-[2rem] border border-gray-700 bg-gray-800/50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-gray-200 placeholder-gray-500"
        placeholder="Paste your text with references here..."
      />
    );
  }