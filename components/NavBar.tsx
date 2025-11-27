import React from 'react';
import { AppView } from '../types';
import { IconShirt, IconUser, IconWand, IconSparkles } from './Icons';

interface Props {
  currentView: AppView;
  onChange: (view: AppView) => void;
}

export const NavBar: React.FC<Props> = ({ currentView, onChange }) => {
  const navItems = [
    { id: AppView.Wardrobe, label: '衣橱', icon: IconShirt },
    { id: AppView.Models, label: '模特', icon: IconUser },
    { id: AppView.TryOn, label: '试穿', icon: IconWand },
    { id: AppView.Inspire, label: '灵感', icon: IconSparkles },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 pb-safe px-4 py-2 shadow-lg z-50">
      <div className="flex justify-around items-center max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                isActive ? 'text-accent' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <item.icon className={`w-6 h-6 ${isActive ? 'fill-current' : ''}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};