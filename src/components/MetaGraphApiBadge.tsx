import React from 'react';

interface MetaGraphApiIconProps {
  className?: string;
  size?: number;
}

export const MetaGraphApiIcon: React.FC<MetaGraphApiIconProps> = ({ className = 'w-4 h-4', size }) => {
  const style = size ? { width: size, height: size } : undefined;
  return (
    <svg 
      viewBox="0 0 48 48" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <defs>
        <linearGradient id="metaBadgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0064e0" />
          <stop offset="50%" stopColor="#0081fb" />
          <stop offset="100%" stopColor="#00c6ff" />
        </linearGradient>
        <linearGradient id="nodeBadgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00c6ff" />
          <stop offset="100%" stopColor="#0081fb" />
        </linearGradient>
      </defs>

      {/* Meta Official Infinity Loop Path */}
      <path 
        d="M33.6 14.5c-3.1 0-5.7 1.6-8.1 4.5c-2.4-2.9-5-4.5-8.1-4.5C11.1 14.5 6 19.3 6 25.1c0 6.8 5.4 12.4 11.4 12.4c3.4 0 6.1-1.6 8.2-4.6c2.1 3 4.8 4.6 8.2 4.6c6 0 11.4-5.6 11.4-12.4c0-5.8-5.1-10.6-11.6-10.6zm-16.2 19.8c-4.4 0-7.8-4.2-7.8-9.2c0-3.9 2.8-7.2 6.8-7.2c2.7 0 4.9 1.8 6.9 4.8c-2.2 4.1-4.5 11.6-5.9 11.6zm16.4 0c-1.4 0-3.7-7.5-5.9-11.6c2-3 4.2-4.8 6.9-4.8c4 0 6.8 3.3 6.8 7.2c0 5-3.4 9.2-7.8 9.2z" 
        fill="url(#metaBadgeGrad)"
      />

      {/* Graph API Connected Nodes */}
      <circle cx="39" cy="11" r="3.2" fill="url(#nodeBadgeGrad)" stroke="#ffffff" strokeWidth="1" />
      <line x1="33" y1="15" x2="38" y2="11.5" stroke="#00c6ff" strokeWidth="1.4" strokeDasharray="1.5 1.5" />
      
      <circle cx="9" cy="12" r="2.8" fill="url(#nodeBadgeGrad)" stroke="#ffffff" strokeWidth="1" />
      <line x1="14" y1="15" x2="9.5" y2="12.5" stroke="#00c6ff" strokeWidth="1.4" strokeDasharray="1.5 1.5" />

      <circle cx="24" cy="24" r="2.2" fill="#ffffff" />
    </svg>
  );
};

interface MetaGraphApiBadgeProps {
  variant?: 'header' | 'compact';
  className?: string;
  onClick?: () => void;
}

export const MetaGraphApiBadge: React.FC<MetaGraphApiBadgeProps> = ({
  variant = 'header',
  className = '',
  onClick,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-950/70 via-neutral-900 to-sky-950/70 border border-blue-500/40 hover:border-blue-400 text-xs text-neutral-200 transition shadow-sm hover:shadow-blue-900/30 cursor-pointer ${className}`}
      title="Meta Official Graph API v22.0 Connected - Click to view connection status"
    >
      <div className="relative flex items-center justify-center shrink-0">
        <MetaGraphApiIcon className="w-4 h-4" />
        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
      </div>
      <span className="hidden sm:flex font-semibold tracking-tight text-white items-center gap-1.5">
        <span className="hidden md:inline">Connected via</span>
        <span className="bg-gradient-to-r from-blue-400 to-sky-300 bg-clip-text text-transparent font-bold">
          Meta Graph API
        </span>
      </span>
      <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-mono border border-blue-500/30">
        v22.0
      </span>
    </button>
  );
};
