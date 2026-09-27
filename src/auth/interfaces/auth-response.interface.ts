export interface AuthResponse {
  success: boolean;
  statusCode: number;
  message?: string;
  error?: string;
  requiresLogin?: boolean;
  requiresRefresh?: boolean;
  data?: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: string;
    user: {
      idUsuario: number;
      correo: string;
      rol: number; // 1=Paciente, 2=Psicologo, 3=Administrador
    };
  } | null;
}