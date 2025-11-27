export enum Category {
  Tops = '上装',
  Bottoms = '下装',
  Dresses = '裙装',
  Outerwear = '外套',
  Shoes = '鞋履',
  Accessories = '配饰',
  Unspecified = '其他'
}

export interface ClothingItem {
  id: string;
  imageUrl: string;
  category: Category;
  color: string;
  description: string;
  tags: string[];
  createdAt: number;
}

export interface ModelProfile {
  id: string;
  name: string;
  imageUrl: string;
  isUser: boolean; // true if it's the user's own photo
}

export interface OutfitRecommendation {
  id: string;
  title: string;
  description: string;
  items: string[]; // Display names
  relatedItemIds: string[]; // IDs of the actual items in wardrobe
  reasoning: string;
  generatedImageUrl?: string; // Cache for the generated look
}

export enum AppView {
  Wardrobe = 'wardrobe',
  Models = 'models',
  TryOn = 'tryon',
  Inspire = 'inspire'
}