import React from 'react';

interface KotakNeoLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
}

export const KotakNeoLogo: React.FC<KotakNeoLogoProps> = ({
  className = '',
  size = 'md',
}) => {
  const heightMap = {
    sm: 'h-6 sm:h-7',
    md: 'h-8 sm:h-9',
    lg: 'h-11 sm:h-12',
    xl: 'h-14 sm:h-16',
  };

  const imgHeight = heightMap[size];

  return (
    <div className={`inline-flex items-center ${className}`}>
      {/* Official Kotak Neo SVG */}
      <img
        src="/Kotak_Neo_Website_dark_mode.svg"
        alt="Kotak Neo"
        className={`${imgHeight} w-auto object-contain select-none`}
        loading="eager"
      />
    </div>
  );
};

export default KotakNeoLogo;
