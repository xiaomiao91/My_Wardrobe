import React from 'react';
import { ClothingItem } from '../types';
import { IconTrash } from './Icons';

interface Props {
  item: ClothingItem;
  onDelete?: (id: string) => void;
  selected?: boolean;
  onClick?: () => void;
}

export const ClothingCard: React.FC<Props> = ({ item, onDelete, selected, onClick }) => {
  return (
    <div 
      className={`relative group rounded-xl overflow-hidden shadow-sm bg-white border-2 transition-all cursor-pointer ${selected ? 'border-accent ring-2 ring-accent/20' : 'border-transparent'}`}
      onClick={onClick}
    >
      <div className="aspect-[3/4] w-full relative bg-gray-100">
        <img src={item.imageUrl} alt={item.description} className="w-full h-full object-cover" />
        <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {onDelete && (
             <button 
             onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
             className="bg-white/80 p-1.5 rounded-full text-red-500 hover:bg-white shadow-sm"
           >
             <IconTrash className="w-4 h-4" />
           </button>
          )}
        </div>
      </div>
      <div className="p-3">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-xs font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-full">
              {item.category}
            </span>
            <p className="text-sm text-gray-700 font-medium mt-1 truncate w-28" title={item.description}>
              {item.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};