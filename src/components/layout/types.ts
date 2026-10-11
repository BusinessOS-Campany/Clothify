export type BranchOption = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
};

export type AppNotification = {
  id: string;
  text: string;
  textAr?: string;
  href?: string;
  tone?: "default" | "warning" | "danger" | "success";
};

export type HeaderData = {
  branches: BranchOption[];
  notifications: AppNotification[];
};