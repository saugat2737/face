import React, { useState, useRef, useEffect, useCallback } from 'react';
import { analyzeImage } from './services/geminiService';
import { AnalysisResult, Emotion } from './types';
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis';
import Spinner from './components/Spinner';

const emotionConfig = {
    [Emotion.HAPPY]: {
        gradient: 'from-yellow-400 via-orange-500 to-red-500',
        icon: '😊',
        title: 'Radiating Joy!'
    },
    [Emotion.SAD]: {
        gradient: 'from-blue-400 via-indigo-500 to-purple-600',
        icon: '😢',
        title: 'Feeling Blue'
    },
    [Emotion.STRESSED]: {
        gradient: 'from-red-500 via-pink-600 to-purple-700',
        icon: '😫',
        title: 'Feeling Stressed'
    },
    [Emotion.FOCUSED]: {
        gradient: 'from-green-400 via-teal-500 to-cyan-600',
        icon: '🤔',
        title: 'In The Zone'
    },
    [Emotion.TIRED]: {
        gradient: 'from-gray-600 via-slate-700 to-zinc-800',
        icon: '😴',
        title: 'Feeling Tired'
    },
    [Emotion.NEUTRAL]: {
        gradient: 'from-slate-500 via-gray-600 to-slate-700',
        icon: '😐',
        title: 'Calm & Collected'
    },
    [Emotion.SURPRISED]: {
        gradient: 'from-pink-400 via-purple-500 to-indigo-500',
        icon: '😲',
        title: 'Surprised!'
    },
    [Emotion.ANGRY]: {
        gradient: 'from-red-600 via-rose-700 to-red-800',
        icon: '😠',
        title: 'Feeling Angry'
    },
};

const emotionVisualEffects: Record<Emotion, string> = {
    [Emotion.HAPPY]: 'border-yellow-300/50 animate-pulse-slow',
    [Emotion.FOCUSED]: 'border-cyan-400/70 shadow-lg shadow-cyan-400/50',
    [Emotion.SAD]: 'border-blue-400/30',
    [Emotion.STRESSED]: 'border-red-500/60 animate-shake-fast',
    [Emotion.ANGRY]: 'border-red-600/80 animate-shake-fast',
    [Emotion.TIRED]: 'border-transparent vignette',
    [Emotion.SURPRISED]: 'border-indigo-400/80 animate-ping-once',
    [Emotion.NEUTRAL]: 'border-transparent',
};

const emotionFilterEffects: Partial<Record<Emotion, string>> = {
    [Emotion.SAD]: 'saturate-[.75] brightness-90',
    [Emotion.TIRED]: 'brightness-90',
};


const InfoCard: React.FC<{ title: string; content: string; icon: React.ReactNode; }> = ({ title, content, icon }) => (
    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 md:p-6 shadow-lg border border-white/20">
        <div className="flex items-center mb-2">
            <div className="text-2xl mr-3">{icon}</div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        <p className="text-gray-200 text-sm md:text-base">{content}</p>
    </div>
);


const App: React.FC = () => {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [lastSpokenMessage, setLastSpokenMessage] = useState<string>('');
    const [surpriseKey, setSurpriseKey] = useState(0);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const intervalRef = useRef<number | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const { speak } = useSpeechSynthesis();

    const currentEmotion = analysisResult?.emotion || Emotion.NEUTRAL;
    const { gradient, icon, title } = emotionConfig[currentEmotion];
    const visualEffectClass = (isAnalyzing && analysisResult) ? emotionVisualEffects[currentEmotion] : emotionVisualEffects[Emotion.NEUTRAL];
    const filterEffectClass = (isAnalyzing && analysisResult) ? (emotionFilterEffects[currentEmotion] ?? '') : '';
    
    const startWebcam = async () => {
        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    streamRef.current = stream;
                }
            } else {
                 setError("Your browser does not support camera access.");
            }
        } catch (err) {
            console.error("Error accessing webcam:", err);
            setError("Could not access camera. Please check permissions.");
        }
    };

    const stopWebcam = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    };

    const captureAndAnalyze = useCallback(async () => {
        if (isLoading || !videoRef.current || !canvasRef.current) return;
        
        setIsLoading(true);
        setError(null);
        
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const context = canvas.getContext('2d');
        if (context) {
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const base64Image = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
            
            try {
                const result = await analyzeImage(base64Image);
                setAnalysisResult(result);
                if (result.emotion === Emotion.SURPRISED) {
                    setSurpriseKey(Date.now());
                }
                if (result.encouragingMessage !== lastSpokenMessage) {
                    speak(result.encouragingMessage);
                    setLastSpokenMessage(result.encouragingMessage);
                }
            } catch (err) {
                setError((err as Error).message);
                setIsAnalyzing(false); // Stop on error
            }
        }
        
        setIsLoading(false);
    }, [isLoading, speak, lastSpokenMessage]);

    useEffect(() => {
        if (isAnalyzing) {
            startWebcam();
            intervalRef.current = window.setInterval(() => {
                captureAndAnalyze();
            }, 5000);
        } else {
            stopWebcam();
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        }

        return () => {
            stopWebcam();
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAnalyzing]);


    const handleStart = () => {
        setError(null);
        setAnalysisResult(null);
        setIsAnalyzing(true);
    };

    const handleStop = () => {
        setIsAnalyzing(false);
    };

    return (
        <main className={`min-h-screen w-full text-white p-4 md:p-8 transition-all duration-1000 bg-gradient-to-br ${gradient}`}>
            <div className="container mx-auto max-w-6xl flex flex-col items-center">
                <header className="text-center mb-6 md:mb-8">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Smart Emotion Mirror</h1>
                    <p className="text-lg md:text-xl mt-2 text-white/80">Reflecting your mood, empowering your day.</p>
                </header>

                <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                    <div className="lg:col-span-2 w-full aspect-video bg-black/30 rounded-2xl shadow-2xl overflow-hidden relative flex items-center justify-center border-2 border-white/20">
                        <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover transform -scale-x-100 transition-all duration-1000 ${filterEffectClass}`}></video>
                        
                        {isAnalyzing && analysisResult && (
                             <div
                                key={currentEmotion === Emotion.SURPRISED ? surpriseKey : undefined}
                                className={`absolute inset-0 transition-all duration-1000 pointer-events-none rounded-[14px] border-4 ${visualEffectClass}`}
                            ></div>
                        )}

                        {!isAnalyzing && (
                            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-center p-4">
                                 <h2 className="text-2xl font-semibold mb-4">Ready to see yourself?</h2>
                                 <p className="text-gray-300 mb-6 max-w-md">Click 'Start Analysis' to activate your camera and begin real-time emotion detection.</p>
                            </div>
                        )}
                        {isLoading && (
                            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                                <Spinner />
                                <p className="mt-4 text-lg">Analyzing your reflection...</p>
                            </div>
                        )}
                    </div>
                    <div className="w-full flex flex-col gap-4 md:gap-6">
                        {analysisResult ? (
                            <>
                                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 text-center shadow-lg border border-white/20">
                                    <span className="text-6xl">{icon}</span>
                                    <h2 className="text-3xl font-bold mt-2">{title}</h2>
                                </div>
                                <InfoCard title="Environment" content={analysisResult.environmentAnalysis} icon="🌳" />
                                <InfoCard title="Friendly Advice" content={analysisResult.encouragingMessage} icon="💬" />
                                <InfoCard title="Productivity Tip" content={analysisResult.productivityTip} icon="💡" />
                            </>
                        ) : (
                           <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 h-full flex flex-col items-center justify-center text-center shadow-lg border border-white/20">
                               <p className="text-2xl mb-4">✨</p>
                                <h3 className="text-xl font-semibold mb-2">Your Insights Appear Here</h3>
                                <p className="text-gray-300">Start the analysis to receive personalized feedback based on your mood and environment.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-8">
                    {!isAnalyzing ? (
                        <button onClick={handleStart} className="px-8 py-4 bg-green-500 hover:bg-green-600 rounded-full text-lg font-semibold shadow-lg transform hover:scale-105 transition-transform">
                            Start Analysis
                        </button>
                    ) : (
                        <button onClick={handleStop} className="px-8 py-4 bg-red-500 hover:bg-red-600 rounded-full text-lg font-semibold shadow-lg transform hover:scale-105 transition-transform">
                            Stop Analysis
                        </button>
                    )}
                </div>
                
                {error && <p className="mt-4 text-center bg-red-500/50 p-3 rounded-lg">{error}</p>}
                
                <canvas ref={canvasRef} className="hidden"></canvas>
            </div>
        </main>
    );
};

export default App;
