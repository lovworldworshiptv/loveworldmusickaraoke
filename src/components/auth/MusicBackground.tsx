const MusicBackground = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
    <svg className="absolute w-full h-full" viewBox="0 0 400 800" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Floating music notes */}
      <g className="animate-[float1_8s_ease-in-out_infinite]" opacity="0.07">
        <text x="40" y="200" fontSize="64" fill="currentColor" className="text-gold">♪</text>
      </g>
      <g className="animate-[float2_10s_ease-in-out_infinite]" opacity="0.05">
        <text x="320" y="150" fontSize="48" fill="currentColor" className="text-gold">♫</text>
      </g>
      <g className="animate-[float3_12s_ease-in-out_infinite]" opacity="0.06">
        <text x="280" y="600" fontSize="56" fill="currentColor" className="text-gold">♪</text>
      </g>
      <g className="animate-[float1_9s_ease-in-out_infinite_1s]" opacity="0.04">
        <text x="60" y="500" fontSize="72" fill="currentColor" className="text-gold">♩</text>
      </g>
      <g className="animate-[float2_11s_ease-in-out_infinite_2s]" opacity="0.06">
        <text x="180" y="720" fontSize="40" fill="currentColor" className="text-gold">♬</text>
      </g>
      <g className="animate-[float3_7s_ease-in-out_infinite_0.5s]" opacity="0.05">
        <text x="350" y="400" fontSize="52" fill="currentColor" className="text-gold">♪</text>
      </g>

      {/* Sound wave lines */}
      <g opacity="0.04" className="animate-[wave1_4s_ease-in-out_infinite]">
        <path d="M0 300 Q50 280 100 300 Q150 320 200 300 Q250 280 300 300 Q350 320 400 300" stroke="currentColor" strokeWidth="1.5" className="text-gold" fill="none" />
      </g>
      <g opacity="0.03" className="animate-[wave2_5s_ease-in-out_infinite]">
        <path d="M0 500 Q50 470 100 500 Q150 530 200 500 Q250 470 300 500 Q350 530 400 500" stroke="currentColor" strokeWidth="1.5" className="text-gold" fill="none" />
      </g>

      {/* Circular rings */}
      <circle cx="340" cy="100" r="30" stroke="currentColor" strokeWidth="0.8" fill="none" opacity="0.04" className="text-gold animate-[ring1_6s_ease-in-out_infinite]" />
      <circle cx="340" cy="100" r="50" stroke="currentColor" strokeWidth="0.5" fill="none" opacity="0.03" className="text-gold animate-[ring1_6s_ease-in-out_infinite_0.5s]" />
      <circle cx="60" cy="680" r="25" stroke="currentColor" strokeWidth="0.8" fill="none" opacity="0.04" className="text-gold animate-[ring2_7s_ease-in-out_infinite]" />
      <circle cx="60" cy="680" r="45" stroke="currentColor" strokeWidth="0.5" fill="none" opacity="0.03" className="text-gold animate-[ring2_7s_ease-in-out_infinite_0.5s]" />

      {/* Headphone silhouette */}
      <g opacity="0.03" className="animate-[float2_14s_ease-in-out_infinite_3s]">
        <path d="M160 350 Q160 310 200 310 Q240 310 240 350" stroke="currentColor" strokeWidth="2" fill="none" className="text-gold" strokeLinecap="round" />
        <rect x="152" y="345" width="12" height="20" rx="6" fill="currentColor" className="text-gold" />
        <rect x="236" y="345" width="12" height="20" rx="6" fill="currentColor" className="text-gold" />
      </g>

      {/* Microphone silhouette */}
      <g opacity="0.03" className="animate-[float1_13s_ease-in-out_infinite_2s]">
        <rect x="90" y="380" width="16" height="28" rx="8" fill="currentColor" className="text-gold" />
        <path d="M86 400 Q86 418 98 418 Q110 418 110 400" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-gold" />
        <line x1="98" y1="418" x2="98" y2="430" stroke="currentColor" strokeWidth="1.5" className="text-gold" />
        <line x1="90" y1="430" x2="106" y2="430" stroke="currentColor" strokeWidth="1.5" className="text-gold" strokeLinecap="round" />
      </g>
    </svg>

    {/* Gradient orbs */}
    <div className="absolute top-20 -left-20 w-60 h-60 rounded-full bg-gold/[0.03] blur-3xl animate-pulse" style={{ animationDuration: "4s" }} />
    <div className="absolute bottom-32 -right-20 w-72 h-72 rounded-full bg-gold/[0.03] blur-3xl animate-pulse" style={{ animationDuration: "5s", animationDelay: "1s" }} />
  </div>
);

export default MusicBackground;
