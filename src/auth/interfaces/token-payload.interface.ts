export interface TokenPayload {
  correo: string;
  sub: number; // id_usuario
  rol: number; // 1=Paciente, 2=Psicologo, 3=Administrador
  iat?: number;
  exp?: number;
}