import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Upload,
  Sparkles,
  Image as ImageIcon,
  MessageSquare,
  ArrowRight,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { GoogleGenAI } from "@google/genai";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type Message = {
  role: "user" | "model";
  text: string;
};

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [base64Data, setBase64Data] = useState<string | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);

  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [isChatting, setIsChatting] = useState(false);
  const [chatInput, setChatInput] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory, analysis]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const result = e.target?.result as string;
      setImage(result);

      // Extract base64 and mime type
      const match = result.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        setMimeType(match[1]);
        setBase64Data(match[2]);
        analyzeImage(match[1], match[2]);
      }
    };
    reader.readAsDataURL(file);
  };

  const analyzeImage = async (mime: string, data: string) => {
    setIsAnalyzing(true);
    setAnalysis(null);
    setChatHistory([]);

    try {
      const prompt = `Analyze this room photo. Provide a structured decluttering and organization plan. Include:
1. Overall Assessment: A brief summary of the room's current state.
2. Quick Wins: 3-5 things to remove or organize immediately for the biggest impact.
3. Step-by-Step Plan: A logical sequence to tackle the rest of the room.
4. Storage Suggestions: Ideas for better utilizing space or adding storage solutions.
Format the response in clean Markdown with clear headings and bullet points.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [
          {
            role: "user",
            parts: [{ inlineData: { mimeType: mime, data } }, { text: prompt }],
          },
        ],
      });

      setAnalysis(response.text || "No analysis provided.");
      setChatHistory([
        { role: "user", text: prompt },
        { role: "model", text: response.text || "No analysis provided." },
      ]);
    } catch (error) {
      console.error("Error analyzing image:", error);
      setAnalysis("Failed to analyze the image. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatting || !base64Data || !mimeType) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    setIsChatting(true);

    const newHistory: Message[] = [
      ...chatHistory,
      { role: "user", text: userMessage },
    ];
    setChatHistory(newHistory);

    try {
      // Reconstruct the full conversation history for the model
      const contents = newHistory.map((msg, index) => {
        if (index === 0 && msg.role === "user") {
          // The first message must include the image
          return {
            role: "user",
            parts: [
              { inlineData: { mimeType, data: base64Data } },
              { text: msg.text },
            ],
          };
        }
        return {
          role: msg.role,
          parts: [{ text: msg.text }],
        };
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents,
      });

      setChatHistory([
        ...newHistory,
        { role: "model", text: response.text || "No response." },
      ]);
    } catch (error) {
      console.error("Error in chat:", error);
      setChatHistory([
        ...newHistory,
        {
          role: "model",
          text: "Sorry, I encountered an error processing your request.",
        },
      ]);
    } finally {
      setIsChatting(false);
    }
  };

  const reset = () => {
    setImage(null);
    setMimeType(null);
    setBase64Data(null);
    setAnalysis(null);
    setChatHistory([]);
  };

  return (
    <div className="min-h-screen bg-[#f5f5f0] text-[#1a1a1a] font-sans selection:bg-[#5A5A40] selection:text-white">
      {/* Header */}
      <header className="px-6 py-8 md:px-12 flex items-center justify-between border-b border-black/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#5A5A40] flex items-center justify-center text-[#f5f5f0]">
            <Sparkles className="w-5 h-5" />
          </div>
          <h1 className="text-2xl font-serif tracking-tight">Declutter AI</h1>
        </div>
        {image && (
          <button
            onClick={reset}
            className="text-sm font-medium uppercase tracking-wider text-black/60 hover:text-black transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Start Over
          </button>
        )}
      </header>

      <main className="max-w-7xl mx-auto p-6 md:p-12">
        <AnimatePresence mode="wait">
          {!image ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-2xl mx-auto mt-12 md:mt-24"
            >
              <div className="text-center mb-12">
                <h2 className="text-4xl md:text-5xl font-serif mb-4 leading-tight">
                  Transform your space.
                </h2>
                <p className="text-lg text-black/60 max-w-md mx-auto">
                  Upload a photo of any messy room, and our AI will provide a
                  step-by-step plan to organize and declutter it.
                </p>
              </div>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="group relative aspect-video md:aspect-[21/9] rounded-3xl border-2 border-dashed border-black/10 bg-white/50 hover:bg-white transition-colors cursor-pointer flex flex-col items-center justify-center overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#5A5A40]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="w-16 h-16 rounded-full bg-[#f5f5f0] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
                  <Upload className="w-6 h-6 text-[#5A5A40]" />
                </div>
                <p className="text-lg font-medium mb-1">
                  Click or drag photo here
                </p>
                <p className="text-sm text-black/50">Supports JPG, PNG, WEBP</p>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/*"
                  className="hidden"
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="analysis"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-8 lg:gap-16 items-start"
            >
              {/* Left Column: Image */}
              <div className="sticky top-8 space-y-6">
                <div className="relative rounded-3xl overflow-hidden shadow-xl bg-black/5 aspect-[4/3] md:aspect-auto">
                  <img
                    src={image}
                    alt="Uploaded room"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />

                  {isAnalyzing && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                      <Loader2 className="w-10 h-10 animate-spin mb-4" />
                      <p className="font-medium tracking-wide">
                        Analyzing your space...
                      </p>
                    </div>
                  )}
                </div>

                {!isAnalyzing && (
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-black/5">
                    <h3 className="font-serif text-lg mb-2 flex items-center gap-2">
                      <ImageIcon className="w-5 h-5 text-[#5A5A40]" />
                      Room Details
                    </h3>
                    <p className="text-sm text-black/60">
                      Our AI has analyzed this image to identify clutter
                      hotspots, structural elements, and potential storage
                      opportunities.
                    </p>
                  </div>
                )}
              </div>

              {/* Right Column: Analysis & Chat */}
              <div className="flex flex-col min-h-[60vh]">
                {isAnalyzing ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                    <div className="w-12 h-12 rounded-full border-2 border-[#5A5A40] border-t-transparent animate-spin" />
                    <p className="text-lg font-serif">
                      Generating your decluttering plan...
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
                    {/* Chat History / Analysis Area */}
                    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
                      {chatHistory.slice(1).map((msg, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            "flex flex-col max-w-[85%]",
                            msg.role === "user"
                              ? "ml-auto items-end"
                              : "mr-auto items-start",
                          )}
                        >
                          <div
                            className={cn(
                              "px-5 py-4 rounded-2xl",
                              msg.role === "user"
                                ? "bg-[#5A5A40] text-white rounded-br-sm"
                                : "bg-[#f5f5f0] text-black/80 rounded-bl-sm prose prose-sm max-w-none prose-headings:font-serif prose-headings:text-black prose-a:text-[#5A5A40]",
                            )}
                          >
                            {msg.role === "user" ? (
                              <p>{msg.text}</p>
                            ) : (
                              <div className="markdown-body">
                                <ReactMarkdown>{msg.text}</ReactMarkdown>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {isChatting && (
                        <div className="flex flex-col max-w-[85%] mr-auto items-start">
                          <div className="px-5 py-4 rounded-2xl bg-[#f5f5f0] text-black/80 rounded-bl-sm flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm">Thinking...</span>
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    {/* Chat Input */}
                    <div className="p-4 bg-white border-t border-black/5">
                      <form
                        onSubmit={handleChatSubmit}
                        className="relative flex items-center"
                      >
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder="Ask a follow-up question about this room..."
                          className="w-full bg-[#f5f5f0] rounded-full pl-6 pr-14 py-4 outline-none focus:ring-2 focus:ring-[#5A5A40]/20 transition-all"
                          disabled={isChatting}
                        />
                        <button
                          type="submit"
                          disabled={!chatInput.trim() || isChatting}
                          className="absolute right-2 w-10 h-10 rounded-full bg-[#5A5A40] text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#4a4a34] transition-colors"
                        >
                          <ArrowRight className="w-5 h-5" />
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
