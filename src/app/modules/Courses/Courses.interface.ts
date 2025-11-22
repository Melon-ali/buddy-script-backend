export interface ICourse {
  teacherId: string;
  name: string;
  price: number;
  thumbnailUrl: string;
  description: string;
  level: string;
}

export interface updateICourse {
  name?: string;
  price?: number;
  category?: string;
  thumbnailUrl?: string;
  categoryId?: string;
  description?: string;
  activeStatus?: string;
}

export type ICourseFilterRequest = {
  name?: string | undefined;
  category?: string | undefined;
  price?: number | undefined;
  searchTerm?: string | undefined;
  description?: string | undefined;
}