import React from 'react';

interface KotakNeoLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
}

export const KotakNeoLogo: React.FC<KotakNeoLogoProps> = ({
  className = '',
  size = 'md',
  showSubtitle = true,
}) => {
  const heightMap = {
    sm: { img: 'h-6 sm:h-7', subtitle: 'text-[9px]' },
    md: { img: 'h-8 sm:h-9', subtitle: 'text-[10px]' },
    lg: { img: 'h-11 sm:h-12', subtitle: 'text-xs' },
    xl: { img: 'h-14 sm:h-16', subtitle: 'text-xs' },
  };

  const { img: imgHeight, subtitle: subSize } = heightMap[size];

  return (
    <div className={`inline-flex flex-col items-start ${className}`}>
      <div className="flex items-center space-x-2">
        {/* Official Kotak Neo SVG from https://www.kotakneo.com/assets/Kotak_Neo_Website_dark_mode.svg */}
        <img
          src="/Kotak_Neo_Website_dark_mode.svg"
          alt="Kotak Neo"
          className={`${imgHeight} w-auto object-contain select-none`}
          loading="eager"
        />
        {/* Algo Terminal Badge */}
        <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-white/10 text-white/90 border border-white/20">
          Algo
        </span>
      </div>
      {showSubtitle && (
        <span className={`text-gray-400 font-semibold tracking-wider uppercase mt-1 ${subSize}`}>
          Algorithmic Trading & Research Terminal
        </span>
      )}
    </div>
  );
};

export default KotakNeoLogo;
