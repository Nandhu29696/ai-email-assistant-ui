declare module "react-notifications" {
  export const NotificationContainer: React.ComponentType;
  export const NotificationManager: {
    success: (message: string, title?: string, timeout?: number) => void;
    error: (message: string, title?: string, timeout?: number) => void;
    info: (message: string, title?: string, timeout?: number) => void;
    warning: (message: string, title?: string, timeout?: number) => void;
  };
}