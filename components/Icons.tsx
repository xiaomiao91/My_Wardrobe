import React from 'react';
import { Shirt, User, Sparkles, Camera, Plus, Trash2, X, Wand2, ArrowRight, Loader2, Upload } from 'lucide-react';

export const IconShirt = ({ className }: { className?: string }) => <Shirt className={className} />;
export const IconUser = ({ className }: { className?: string }) => <User className={className} />;
export const IconSparkles = ({ className }: { className?: string }) => <Sparkles className={className} />;
export const IconCamera = ({ className }: { className?: string }) => <Camera className={className} />;
export const IconPlus = ({ className }: { className?: string }) => <Plus className={className} />;
export const IconTrash = ({ className }: { className?: string }) => <Trash2 className={className} />;
export const IconClose = ({ className }: { className?: string }) => <X className={className} />;
export const IconWand = ({ className }: { className?: string }) => <Wand2 className={className} />;
export const IconArrowRight = ({ className }: { className?: string }) => <ArrowRight className={className} />;
export const IconLoading = ({ className }: { className?: string }) => <Loader2 className={`animate-spin ${className}`} />;
export const IconUpload = ({ className }: { className?: string }) => <Upload className={className} />;
