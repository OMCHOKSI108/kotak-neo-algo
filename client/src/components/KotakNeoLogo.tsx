import React from 'react';

interface KotakNeoLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
}

export const KotakNeoLogo: React.FC<KotakNeoLogoProps> = ({
  className = '',
  size = 'md',
}) => {
  const sizeMap = {
    xs: 'w-6 h-6',
    sm: 'w-7 h-7',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
    xl: 'w-12 h-12',
  };

  const imgSize = sizeMap[size] || 'w-8 h-8';

  return (
    <div className={`inline-flex items-center shrink-0 ${className}`}>
      {/* Official Kotak circular icon */}
      <img
        src="/favicon.svg"
        alt="Kotak Neo"
        className={`${imgSize} object-contain select-none shrink-0`}
        loading="eager"
      />
    </div>
  );
};

export default KotakNeoLogo;
